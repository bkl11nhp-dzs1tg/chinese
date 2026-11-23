// Trang "Thẻ": tra cứu toàn bộ từ, lọc theo bài/trạng thái, nghe phát âm.

import { h, mount } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { cardStatus } from '../../core/srs.js';

const STATUS = { new: 'Mới', learning: 'Đang học', mastered: 'Đã thuộc' };
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

export async function render(root, ctx, { query }) {
  const data = await ctx.loadAll();
  const now = Date.now();
  const rate = ctx.settings.tts_rate;
  if (!data.cards.length) {
    mount(root, h('h1', {}, 'Thẻ'), h('p', { class: 'notice' }, 'Chưa có từ vựng. Vào ', h('a', { href: '#/settings' }, 'Cài đặt'), ' để nạp nội dung.'));
    return;
  }
  const lessonOrder = new Map(data.lessons.map((l, i) => [l.id, i]));
  const all = [...data.cards].sort((a, b) => (lessonOrder.get(a.lesson_id) ?? 1e9) - (lessonOrder.get(b.lesson_id) ?? 1e9));
  const counts = { new: 0, learning: 0, mastered: 0 };
  for (const c of all) counts[cardStatus(data.statesById.get(c.id))]++;

  const search = h('input', { type: 'search', placeholder: 'Tìm chữ Hán, bính âm hoặc nghĩa…', 'aria-label': 'Tìm từ', value: query.q || '' });
  const lessonSel = h('select', { 'aria-label': 'Lọc theo bài' },
    h('option', { value: '' }, 'Tất cả bài'),
    data.lessons.map((l) => h('option', { value: l.id }, `${l.unit != null ? `Bài ${l.unit}: ` : ''}${l.title}`)));
  const statusSel = h('select', { 'aria-label': 'Lọc theo trạng thái' },
    h('option', { value: '' }, 'Mọi trạng thái'),
    Object.entries(STATUS).map(([k, v]) => h('option', { value: k }, `${v} (${counts[k]})`)));
  const listEl = h('ul', { class: 'list' });
  const countEl = h('p', { class: 'muted small' });

  function draw() {
    const q = fold(search.value.trim());
    const qPinyinless = q.replace(/\s+/g, '');
    const rows = all.filter((c) => {
      if (lessonSel.value && c.lesson_id !== lessonSel.value) return false;
      if (statusSel.value && cardStatus(data.statesById.get(c.id)) !== statusSel.value) return false;
      if (!q) return true;
      return c.hanzi.includes(search.value.trim()) || fold(c.pinyin).replace(/\s+/g, '').includes(qPinyinless) || fold(c.meaning).includes(q);
    });
    countEl.textContent = `${rows.length} từ`;
    listEl.replaceChildren(...rows.slice(0, 300).map((c) => {
      const st = data.statesById.get(c.id);
      const s = cardStatus(st);
      const dueText = st ? (st.due_at <= now ? 'đến hạn' : `ôn sau ${Math.ceil((st.due_at - now) / 86400000)} ngày`) : '';
      return h('li', {}, h('details', {},
        h('summary', { class: 'item', style: { listStyle: 'none', color: 'var(--ink)' } },
          h('span', { class: 'han', lang: 'zh-CN', style: { fontSize: '26px', minWidth: '2.6em' } }, c.hanzi),
          h('span', { style: { flex: 1 } }, h('div', { style: { color: 'var(--accent-ink)', fontWeight: 600 } }, c.pinyin), h('div', {}, c.meaning)),
          h('span', { class: ['badge', s === 'mastered' ? 'done' : s === 'learning' ? 'doing' : 'new'] }, STATUS[s])),
        h('div', { style: { padding: '0 8px 12px' } },
          h('div', { class: 'row' },
            h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(c.hanzi, rate) }, icon('speaker'), 'Nghe'),
            c.example ? h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(c.example, rate) }, icon('speaker'), 'Nghe ví dụ') : null),
          c.example ? h('p', { style: { marginTop: '8px' } }, h('span', { class: 'han', style: { fontSize: '20px' } }, c.example), c.example_pinyin ? h('br') : null, c.example_pinyin || '', c.example_meaning ? h('br') : null, h('span', { class: 'muted' }, c.example_meaning || '')) : null,
          h('p', { class: 'muted small' },
            c.lesson_id ? `Bài: ${c.lesson_id}` : 'Không thuộc bài nào',
            c.hsk_level ? ` · HSK ${c.hsk_level}` : '',
            st ? ` · ôn ${st.repetitions} lần liên tiếp đúng · quên ${st.lapses} lần · ${dueText}` : ''))));
    }));
    if (rows.length > 300) listEl.append(h('li', { class: 'muted small', style: { padding: '8px' } }, `Hiển thị 300/${rows.length} từ, hãy lọc hẹp hơn.`));
  }
  [search, lessonSel, statusSel].forEach((el) => el.addEventListener('input', draw));

  mount(root,
    h('div', { class: 'large-title' }, h('h1', {}, 'Thẻ'), h('a', { class: 'btn tinted', href: '#/games' }, icon('game'), 'Trò chơi')),
    h('p', { class: 'muted' }, `${all.length} từ · ${counts.mastered} đã thuộc · ${counts.learning} đang học · ${counts.new} mới`),
    h('div', { class: 'stack' },
      search,
      h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, lessonSel, statusSel),
      countEl, h('div', { class: 'group' }, listEl)));
  draw();
}
