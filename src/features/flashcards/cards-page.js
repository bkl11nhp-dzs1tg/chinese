// Trang "Thẻ": tổng quan mức nhớ, lọc theo trạng thái/bài, lưới thẻ từ; bấm thẻ để xem chi tiết và nghe.

import { h, mount, toast } from '../../ui/dom.js';
import { icon, artOr } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { cardStatus } from '../../core/srs.js';
import { cue } from '../../ui/feedback.js';
import { TOPICS } from '../../core/topics.js';
import { phrasesView } from './phrases.js';

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
  // Đánh dấu của người học: 'weak' (chưa nhớ – tô màu khi gặp trong bài) | 'known' (đã nhớ).
  const marks = await ctx.repo.wordMarks();
  if (!data.cards.length) {
    mount(root, h('div', { class: 'large-title' }, h('h1', {}, 'Thẻ')), h('p', { class: 'notice' }, 'Chưa có từ vựng.'));
    return;
  }
  const view = ['sentences', 'patterns'].includes(query.v) ? query.v : 'words';
  const viewSeg = h('div', { class: 'seg seg-fit', role: 'tablist', 'aria-label': 'Loại thẻ' },
    [['words', 'Từ vựng'], ['sentences', 'Câu'], ['patterns', 'Mẫu câu']].map(([id, label]) => h('a', {
      class: ['seg-btn', view === id ? 'on' : ''], role: 'tab', 'aria-selected': String(view === id), href: id === 'words' ? '#/cards' : `#/cards?v=${id}`,
    }, label)));
  const titleRow = (sub) => h('div', { class: 'large-title' },
    h('div', {}, h('div', { class: 'sub' }, sub), h('h1', {}, 'Thẻ')),
    h('a', { class: 'icon-btn tinted-round', href: '#/games', 'aria-label': 'Trò chơi', title: 'Trò chơi' }, icon('game')));
  if (view !== 'words') {
    const n = view === 'sentences' ? data.lessons.reduce((a, l) => a + (l.texts || []).reduce((b, t) => b + t.lines.length, 0), 0) : data.lessons.reduce((a, l) => a + (l.grammar_points?.length || 0), 0);
    mount(root, titleRow(`${n} ${view === 'sentences' ? 'câu' : 'mẫu câu'}`), viewSeg, phrasesView({ kind: view, lessons: data.lessons, rate }));
    return;
  }
  const lessonOrder = new Map(data.lessons.map((l, i) => [l.id, i]));
  const all = [...data.cards].sort((a, b) => (lessonOrder.get(a.lesson_id) ?? 1e9) - (lessonOrder.get(b.lesson_id) ?? 1e9));
  const counts = { new: 0, learning: 0, mastered: 0 };
  for (const c of all) counts[cardStatus(data.statesById.get(c.id))]++;
  const due = data.states.filter((s) => s.due_at <= now).length;

  let status = STATUS[query.s] ? query.s : '';
  let lesson = query.l || '';
  let topic = query.t || '';
  let groupBy = topic ? 'topic' : 'lesson';
  let shown = PAGE;
  let onlyWeak = query.m === 'weak';

  const search = h('input', { type: 'search', placeholder: 'Tìm chữ Hán, pinyin hoặc nghĩa…', 'aria-label': 'Tìm từ', value: query.q || '' });
  const gridEl = h('div', { class: 'word-list' });
  const countEl = h('p', { class: 'muted small', style: { margin: '14px 4px 8px' } });
  const moreBtn = h('button', { class: 'btn block', type: 'button', style: { marginTop: '14px' }, onclick: () => { shown += PAGE; draw(); } }, 'Xem thêm');

  // Tổng quan gọn: một thanh tỉ lệ + các nút lọc nhỏ (thay cho 3 ô số lớn).
  const pct = (n) => `${(n / all.length) * 100}%`;
  const meter = h('div', { class: 'cp-meter', role: 'img', 'aria-label': `Đã thuộc ${counts.mastered}, đang học ${counts.learning}, mới ${counts.new}` },
    h('i', { class: 'mastered', style: { width: pct(counts.mastered) } }),
    h('i', { class: 'learning', style: { width: pct(counts.learning) } }));
  const statusTiles = Object.entries(STATUS).map(([k, v]) => h('button', {
    class: ['cp-pill', k], type: 'button', 'aria-pressed': 'false',
    onclick: () => { status = status === k ? '' : k; shown = PAGE; draw(); },
  }, h('span', { class: 'dot' }), v.label, h('b', {}, String(counts[k]))));

  const weakChip = h('button', { class: 'cp-pill weak weak-chip', type: 'button', onclick: () => { onlyWeak = !onlyWeak; shown = PAGE; draw(); } });
  const topicCount = new Map();
  for (const c of all) topicCount.set(c.topic, (topicCount.get(c.topic) || 0) + 1);
  const topicChips = h('div', { class: 'chip-scroll', role: 'group', 'aria-label': 'Lọc theo chủ đề' },
    [{ id: '', label: 'Tất cả chủ đề' }, ...TOPICS.filter((t) => topicCount.get(t.id)).map((t) => ({ id: t.id, label: `${t.label} · ${topicCount.get(t.id)}` }))]
      .map((x) => h('button', { class: 'chip opt', type: 'button', dataset: { id: x.id }, onclick: () => { topic = x.id; shown = PAGE; draw(); } }, x.label)));
  const groupSeg = h('div', { class: 'seg small-seg group-seg', role: 'tablist', 'aria-label': 'Lọc theo' },
    [['lesson', 'Theo bài'], ['topic', 'Theo chủ đề']].map(([id, label]) => h('button', {
      class: 'seg-btn', type: 'button', role: 'tab', dataset: { id },
      onclick: () => { groupBy = id; if (id === 'lesson') topic = ''; else lesson = ''; shown = PAGE; draw(); },
    }, label)));
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
      markRow(c),
      h('div', { class: 'row nowrap', style: { marginTop: '14px' } },
        lessonRef ? h('a', { class: 'btn', style: { flex: 1 }, href: `#/lesson/${encodeURIComponent(lessonRef.id)}`, onclick: () => dlg.close() }, icon('lessons'), `Bài ${lessonRef.unit}`) : null,
        h('button', { class: 'btn primary', type: 'button', style: { flex: 1 }, onclick: () => dlg.close() }, 'Đóng')));
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
    dlg.showModal();
  }

  function markRow(c) {
    const box = h('div', { class: 'mark-row', role: 'group', 'aria-label': 'Đánh dấu từ', style: { marginTop: '14px' } });
    const paint = () => {
      const m = marks.get(c.hanzi);
      box.replaceChildren(
        h('button', { class: ['mark-btn', 'weak', m === 'weak' ? 'on' : ''], type: 'button', 'aria-pressed': String(m === 'weak'), onclick: () => set('weak') }, icon('flag'), 'Chưa nhớ'),
        h('button', { class: ['mark-btn', 'known', m === 'known' ? 'on' : ''], type: 'button', 'aria-pressed': String(m === 'known'), onclick: () => set('known') }, icon('check'), 'Đã nhớ'));
    };
    async function set(kind) {
      const next = marks.get(c.hanzi) === kind ? null : kind;
      await ctx.repo.markWord(c.hanzi, next);
      if (next) marks.set(c.hanzi, next); else marks.delete(c.hanzi);
      cue(next === 'known' ? 'good' : 'tap');
      if (next === 'weak') toast('Từ này sẽ được tô màu khi gặp trong bài khóa.');
      paint();
      draw();
    }
    paint();
    return box;
  }

  function draw() {
    const weakCount = all.filter((c) => marks.get(c.hanzi) === 'weak').length;
    weakChip.replaceChildren(h('span', { class: 'dot' }), 'Chưa nhớ', h('b', {}, String(weakCount)));
    weakChip.classList.toggle('selected', onlyWeak);
    statusTiles.forEach((t, i) => {
      const on = Object.keys(STATUS)[i] === status;
      t.classList.toggle('selected', on);
      t.setAttribute('aria-pressed', String(on));
    });
    lessonChips.querySelectorAll('.chip:not(.weak-chip)').forEach((b) => b.classList.toggle('selected', b.dataset.id === lesson));
    topicChips.querySelectorAll('.chip').forEach((b) => b.classList.toggle('selected', b.dataset.id === topic));
    groupSeg.querySelectorAll('.seg-btn').forEach((b) => { const on = b.dataset.id === groupBy; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    lessonChips.classList.toggle('hidden', groupBy !== 'lesson');
    topicChips.classList.toggle('hidden', groupBy !== 'topic');
    const raw = search.value.trim();
    const q = fold(raw);
    const qn = q.replace(/\s+/g, '');
    const rows = all.filter((c) => {
      if (lesson && c.lesson_id !== lesson) return false;
      if (topic && c.topic !== topic) return false;
      if (onlyWeak && marks.get(c.hanzi) !== 'weak') return false;
      if (status && cardStatus(data.statesById.get(c.id)) !== status) return false;
      if (!q) return true;
      return c.hanzi.includes(raw) || fold(c.pinyin).replace(/\s+/g, '').includes(qn) || fold(c.meaning).includes(q);
    });
    countEl.textContent = `${rows.length} từ${status ? ` · ${STATUS[status].label.toLowerCase()}` : ''}${onlyWeak ? ' · chưa nhớ' : ''}`;
    gridEl.replaceChildren(...(rows.length ? rows.slice(0, shown).map((c) => {
      const st = data.statesById.get(c.id);
      const m = marks.get(c.hanzi);
      return h('button', { class: ['word-row', cardStatus(st), m === 'weak' ? 'weak' : ''], type: 'button', onclick: () => openDetail(c) },
        h('span', { class: 'han wr-hanzi', lang: 'zh-CN' }, c.hanzi),
        h('span', { class: 'wr-text' }, h('span', { class: 'wr-pinyin' }, c.pinyin), h('span', { class: 'wr-meaning' }, c.meaning)),
        m ? h('span', { class: ['mark-tag', m] }, m === 'weak' ? 'Chưa nhớ' : 'Đã nhớ') : dots(strength(st)));
    }) : [h('div', { class: 'empty-art', style: { gridColumn: '1 / -1' } }, artOr('empty'), h('p', { class: 'muted center' }, 'Không có từ phù hợp.'))]));
    moreBtn.classList.toggle('hidden', rows.length <= shown);
  }
  search.addEventListener('input', () => { shown = PAGE; draw(); });

  mount(root,
    titleRow(`${all.length} từ vựng`),
    viewSeg,
    h('section', { class: 'cp-summary glass' },
      h('div', { class: 'cp-head' }, h('strong', {}, `${Math.round((counts.mastered / all.length) * 100)}% đã thuộc`), h('span', { class: 'muted small' }, `${counts.learning} đang học`)),
      meter,
      h('div', { class: 'cp-pills' }, statusTiles, weakChip)),
    due ? h('a', { class: 'due-banner', href: '#/session?mode=review' },
      h('span', { class: 'st-ic' }, icon('repeat')),
      h('span', { class: 'grow' }, h('strong', {}, `${due} thẻ đến hạn ôn`), h('span', { class: 'muted small' }, 'Ôn ngay để giữ trí nhớ')),
      icon('chevron')) : null,
    h('div', { class: 'filters' }, search, groupSeg, lessonChips, topicChips),
    countEl, gridEl, moreBtn);
  draw();
  if (lesson) lessonChips.querySelector('.selected')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function dots(n) {
  return h('span', { class: 'dots', 'aria-label': `Mức nhớ ${n}/4`, title: `Mức nhớ ${n}/4` },
    [0, 1, 2, 3].map((i) => h('i', { class: i < n ? 'on' : '' })));
}
