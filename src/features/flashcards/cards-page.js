// Trang "Thẻ": tổng quan mức nhớ, lọc theo trạng thái/bài, lưới thẻ từ; bấm thẻ để xem chi tiết và nghe.

import { h, mount } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { cardStatus } from '../../core/srs.js';

const STATUS = {
  new: { label: 'Mới', hint: 'chưa học', icon: 'sparkle' },
  learning: { label: 'Đang học', hint: 'đang ôn theo lịch', icon: 'repeat' },
  mastered: { label: 'Đã thuộc', hint: 'ôn cách ≥ 21 ngày', icon: 'star' },
};
const PAGE = 60;
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

/** Mức nhớ 0–4 chấm theo khoảng ôn: chưa học 0, <3 ngày 1, <7 ngày 2, <21 ngày 3, ≥21 ngày 4. */
export function strength(st) {
  if (!st || st.last_reviewed_at == null) return 0;
  const d = st.interval_days;
  return d >= 21 ? 4 : d >= 7 ? 3 : d >= 3 ? 2 : 1;
}

export async function render(root, ctx, { query }) {
  const data = await ctx.loadAll();
  const now = Date.now();
  const rate = ctx.settings.tts_rate;
  if (!data.cards.length) {
    mount(root, h('div', { class: 'large-title' }, h('h1', {}, 'Thẻ')), h('p', { class: 'notice' }, 'Chưa có từ vựng.'));
    return;
  }
  const lessonOrder = new Map(data.lessons.map((l, i) => [l.id, i]));
  const all = [...data.cards].sort((a, b) => (lessonOrder.get(a.lesson_id) ?? 1e9) - (lessonOrder.get(b.lesson_id) ?? 1e9));
  const counts = { new: 0, learning: 0, mastered: 0 };
  for (const c of all) counts[cardStatus(data.statesById.get(c.id))]++;
  const due = data.states.filter((s) => s.due_at <= now).length;

  let status = STATUS[query.s] ? query.s : '';
  let lesson = query.l || '';
  let shown = PAGE;

  const search = h('input', { type: 'search', placeholder: 'Tìm chữ Hán, bính âm hoặc nghĩa…', 'aria-label': 'Tìm từ', value: query.q || '' });
  const gridEl = h('div', { class: 'word-grid' });
  const countEl = h('p', { class: 'muted small', style: { margin: '14px 4px 8px' } });
  const moreBtn = h('button', { class: 'btn block', type: 'button', style: { marginTop: '14px' }, onclick: () => { shown += PAGE; draw(); } }, 'Xem thêm');

  const statusTiles = Object.entries(STATUS).map(([k, v]) => h('button', {
    class: ['status-tile', k], type: 'button', 'aria-pressed': 'false',
    onclick: () => { status = status === k ? '' : k; shown = PAGE; draw(); },
  },
  h('span', { class: 'st-ic' }, icon(v.icon)),
  h('span', { class: 'st-num' }, String(counts[k])),
  h('span', { class: 'st-label' }, v.label),
  h('span', { class: 'st-hint' }, v.hint)));

  const lessonChips = h('div', { class: 'chip-scroll', role: 'group', 'aria-label': 'Lọc theo bài' },
    [{ id: '', label: 'Tất cả bài' }, ...data.lessons.map((l) => ({ id: l.id, label: `Bài ${l.unit ?? l.id}` }))]
      .map((x) => h('button', { class: 'chip opt', type: 'button', dataset: { id: x.id }, onclick: () => { lesson = x.id; shown = PAGE; draw(); } }, x.label)));

  function openDetail(c) {
    const st = data.statesById.get(c.id);
    const s = cardStatus(st);
    const lessonRef = data.lessons.find((l) => l.id === c.lesson_id);
    const dlg = h('dialog', { class: 'word-dialog', 'aria-label': `Từ ${c.hanzi}` },
      h('div', { class: 'row between nowrap' },
        h('div', {},
          h('div', { class: 'han', lang: 'zh-CN', style: { fontSize: '52px', lineHeight: 1.1 } }, c.hanzi),
          h('div', { style: { color: 'var(--accent-ink)', fontWeight: 700, fontSize: '20px' } }, c.pinyin)),
        h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe', onclick: () => speak(c.hanzi, rate) }, icon('speaker'))),
      h('p', { style: { fontSize: '19px', fontWeight: 600, margin: '10px 0 2px' } }, c.meaning),
      c.pos ? h('p', { class: 'muted small' }, c.pos) : null,
      c.example ? h('div', { class: 'example-box' },
        h('div', { class: 'row nowrap', style: { alignItems: 'flex-start' } },
          h('div', { style: { flex: 1 } }, h('div', { class: 'han', style: { fontSize: '20px' } }, c.example), c.example_meaning ? h('div', { class: 'muted small' }, c.example_meaning) : null),
          h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': 'Nghe ví dụ', onclick: () => speak(c.example, rate) }, icon('speaker')))) : null,
      h('div', { class: 'detail-meta' },
        h('span', { class: ['badge', s === 'mastered' ? 'done' : s === 'learning' ? 'doing' : 'new'] }, STATUS[s].label),
        dots(strength(st)),
        st ? h('span', { class: 'muted small' }, st.due_at <= now ? 'đến hạn ôn' : `ôn sau ${Math.ceil((st.due_at - now) / 86400000)} ngày`) : null),
      h('div', { class: 'row nowrap', style: { marginTop: '14px' } },
        lessonRef ? h('a', { class: 'btn', style: { flex: 1 }, href: `#/lesson/${encodeURIComponent(lessonRef.id)}`, onclick: () => dlg.close() }, icon('lessons'), `Bài ${lessonRef.unit}`) : null,
        h('button', { class: 'btn primary', type: 'button', style: { flex: 1 }, onclick: () => dlg.close() }, 'Đóng')));
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
    dlg.showModal();
  }

  function draw() {
    statusTiles.forEach((t, i) => {
      const on = Object.keys(STATUS)[i] === status;
      t.classList.toggle('on', on);
      t.setAttribute('aria-pressed', String(on));
    });
    lessonChips.querySelectorAll('.chip').forEach((b) => b.classList.toggle('selected', b.dataset.id === lesson));
    const raw = search.value.trim();
    const q = fold(raw);
    const qn = q.replace(/\s+/g, '');
    const rows = all.filter((c) => {
      if (lesson && c.lesson_id !== lesson) return false;
      if (status && cardStatus(data.statesById.get(c.id)) !== status) return false;
      if (!q) return true;
      return c.hanzi.includes(raw) || fold(c.pinyin).replace(/\s+/g, '').includes(qn) || fold(c.meaning).includes(q);
    });
    countEl.textContent = `${rows.length} từ${status ? ` · ${STATUS[status].label.toLowerCase()}` : ''}`;
    gridEl.replaceChildren(...(rows.length ? rows.slice(0, shown).map((c) => {
      const st = data.statesById.get(c.id);
      return h('button', { class: ['word-tile', cardStatus(st)], type: 'button', onclick: () => openDetail(c) },
        h('span', { class: 'han wt-hanzi', lang: 'zh-CN' }, c.hanzi),
        h('span', { class: 'wt-pinyin' }, c.pinyin),
        h('span', { class: 'wt-meaning' }, c.meaning),
        dots(strength(st)));
    }) : [h('p', { class: 'muted center', style: { gridColumn: '1 / -1' } }, 'Không có từ phù hợp.')]));
    moreBtn.classList.toggle('hidden', rows.length <= shown);
  }
  search.addEventListener('input', () => { shown = PAGE; draw(); });

  mount(root,
    h('div', { class: 'large-title' },
      h('div', {}, h('div', { class: 'sub' }, `${all.length} từ vựng`), h('h1', {}, 'Thẻ')),
      h('a', { class: 'btn tinted', href: '#/games' }, icon('game'), 'Trò chơi')),
    h('div', { class: 'status-row' }, statusTiles),
    due ? h('a', { class: 'due-banner', href: '#/session?mode=review' },
      h('span', { class: 'st-ic' }, icon('repeat')),
      h('span', { class: 'grow' }, h('strong', {}, `${due} thẻ đến hạn ôn`), h('span', { class: 'muted small' }, 'Ôn ngay để giữ trí nhớ')),
      icon('chevron')) : null,
    h('div', { class: 'filters' }, search, lessonChips),
    countEl, gridEl, moreBtn);
  draw();
  if (lesson) lessonChips.querySelector('.selected')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function dots(n) {
  return h('span', { class: 'dots', 'aria-label': `Mức nhớ ${n}/4`, title: `Mức nhớ ${n}/4` },
    [0, 1, 2, 3].map((i) => h('i', { class: i < n ? 'on' : '' })));
}
