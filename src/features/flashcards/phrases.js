// Trang Thẻ – tab Câu (câu trong bài khóa) và Mẫu câu (điểm ngữ pháp + ví dụ). Lọc theo bài, tìm kiếm.

import { h, noteLines } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';

const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
const PAGE = 60;

export function phrasesView({ kind, lessons, rate }) {
  let lesson = '';
  let shown = PAGE;
  const items = kind === 'sentences'
    ? lessons.flatMap((l) => (l.texts || []).flatMap((t) => t.lines.map((ln) => ({ lesson: l, zh: ln.zh, py: ln.pinyin, vi: ln.vi, speaker: ln.speaker }))))
    : lessons.flatMap((l) => (l.grammar_points || []).map((g) => ({ lesson: l, title: g.title, note: g.note, examples: g.examples || (g.example ? [{ zh: g.example }] : []) })));

  const search = h('input', { type: 'search', placeholder: kind === 'sentences' ? 'Tìm câu…' : 'Tìm mẫu câu…', 'aria-label': 'Tìm' });
  const chips = h('div', { class: 'chip-scroll', role: 'group', 'aria-label': 'Lọc theo bài' },
    [{ id: '', label: 'Tất cả bài' }, ...lessons.filter((l) => items.some((x) => x.lesson === l)).map((l) => ({ id: l.id, label: `Bài ${l.unit ?? l.id}` }))]
      .map((x) => h('button', { class: 'chip opt', type: 'button', dataset: { id: x.id }, onclick: () => { lesson = x.id; shown = PAGE; draw(); } }, x.label)));
  const countEl = h('p', { class: 'muted small', style: { margin: '14px 4px 8px' } });
  const list = h('div', { class: 'phrase-list' });
  const more = h('button', { class: 'btn block', type: 'button', style: { marginTop: '14px' }, onclick: () => { shown += PAGE; draw(); } }, 'Xem thêm');
  const say = (zh) => h('button', { class: 'say-btn', type: 'button', 'aria-label': 'Nghe', onclick: () => speak(zh, rate) }, icon('speaker'));
  const tag = (l) => h('a', { class: 'ph-tag', href: `#/lesson/${encodeURIComponent(l.id)}` }, `Bài ${l.unit ?? l.id}`);

  function row(x) {
    if (kind === 'sentences') {
      return h('div', { class: 'ph-row' },
        say(x.zh),
        h('div', { class: 'ph-body' },
          h('div', { class: 'han ph-zh', lang: 'zh-CN' }, x.speaker ? h('span', { class: 'ph-spk' }, `${x.speaker}：`) : null, x.zh),
          x.py ? h('div', { class: 'ph-py' }, x.py) : null,
          x.vi ? h('div', { class: 'ph-vi' }, x.vi) : null),
        tag(x.lesson));
    }
    return h('div', { class: 'ph-row pattern' },
      h('div', { class: 'ph-body' },
        h('div', { class: 'ph-head' }, h('strong', {}, x.title), tag(x.lesson)),
        x.note ? noteLines(x.note, 'ph-note note-lines') : null,
        x.examples.map((e) => h('div', { class: 'ph-ex' }, say(e.zh),
          h('div', {}, h('div', { class: 'han', lang: 'zh-CN' }, e.zh), e.pinyin ? h('div', { class: 'ph-py' }, e.pinyin) : null, e.vi ? h('div', { class: 'ph-vi' }, e.vi) : null)))));
  }

  function draw() {
    chips.querySelectorAll('.chip').forEach((b) => b.classList.toggle('selected', b.dataset.id === lesson));
    const raw = search.value.trim();
    const q = fold(raw);
    const rows = items.filter((x) => {
      if (lesson && x.lesson.id !== lesson) return false;
      if (!q) return true;
      const hay = kind === 'sentences' ? [x.zh, x.py, x.vi] : [x.title, x.note, ...x.examples.flatMap((e) => [e.zh, e.vi])];
      return hay.some((t) => t && (t.includes(raw) || fold(t).includes(q)));
    });
    countEl.textContent = `${rows.length} ${kind === 'sentences' ? 'câu' : 'mẫu câu'}`;
    list.replaceChildren(...(rows.length ? rows.slice(0, shown).map(row) : [h('p', { class: 'muted center' }, 'Không có kết quả.')]));
    more.classList.toggle('hidden', rows.length <= shown);
  }
  search.addEventListener('input', () => { shown = PAGE; draw(); });
  draw();
  return [h('div', { class: 'filters' }, search, chips), countEl, list, more];
}
