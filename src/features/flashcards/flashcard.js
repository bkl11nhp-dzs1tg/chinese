// Thẻ lật (mục 9.2). Mặt trước: chữ Hán lớn, pinyin ẩn (bấm để hiện).
// Mặt sau: pinyin, nghĩa, ví dụ và 3 nút: Chưa nhớ / Đã nhớ / Đã thuộc. Dưới cùng: Quay lại · Bỏ qua.
// Phím tắt: Space lật, 1–3 chọn, ← quay lại, → bỏ qua.

import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { strokeViewer } from '../../ui/strokes.js';
import { review, newCardState, markMastered } from '../../core/srs.js';

// grade: 'again' (chưa nhớ → ôn lại sớm), 'good' (đã nhớ → theo lịch), 'mastered' (đã thuộc → ≥ 21 ngày)
export const GRADES = [
  { grade: 'again', q: 1, label: 'Chưa nhớ', key: '1', cls: 'g-again', icon: 'repeat' },
  { grade: 'good', q: 4, label: 'Đã nhớ', key: '2', cls: 'g-good', icon: 'check' },
  { grade: 'mastered', q: 5, label: 'Đã thuộc', key: '3', cls: 'g-mastered', icon: 'star' },
];

function intervalText(days) {
  if (days <= 1) return '1 ngày';
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1)} năm`;
}

export function speakButton(text, rate, label = 'Nghe phát âm') {
  return h('button', {
    class: 'btn tinted icon-only speak', type: 'button', 'aria-label': label, title: label,
    onclick: (e) => { e.stopPropagation(); speak(text, rate); },
  }, icon('speaker'));
}

/**
 * @param {object} o
 * @param {object} o.card
 * @param {object|null} o.state   trạng thái SRS hiện tại (để xem trước khoảng cách)
 * @param {'new'|'review'|'relearn'} o.kind
 * @param {object} o.settings
 * @param {(q:number)=>void} o.onGrade
 */
export function flashcard({ card, state, kind, settings, onGrade, onBack = null, onSkip = null, example = null, dict = null }) {
  let flipped = false;
  let pinyinShown = !!settings.show_pinyin_front;
  const rate = settings.tts_rate ?? 1;

  const tag = kind === 'new' ? h('span', { class: 'badge doing tag' }, 'MỚI')
    : kind === 'relearn' ? h('span', { class: 'badge tag' }, 'ÔN LẠI') : null;

  const pinyinSlot = h('div', { class: 'pinyin' });
  const back = h('div', { class: 'back hidden' },
    h('div', { class: 'meaning' }, card.meaning),
    card.pos || card.han_viet ? h('div', { class: 'muted small' }, [card.pos ? `(${card.pos})` : '', card.han_viet ? `Hán Việt: ${card.han_viet}` : ''].filter(Boolean).join(' · ')) : null,
    exampleBlock(example || (card.example ? { zh: card.example, vi: card.example_meaning, pinyin: card.example_pinyin } : null), card.hanzi, rate, dict),
  );

  function renderPinyin() {
    if (pinyinShown || flipped) pinyinSlot.replaceChildren(card.pinyin);
    else pinyinSlot.replaceChildren(h('button', { class: 'reveal-pinyin', type: 'button', onclick: (e) => { e.stopPropagation(); pinyinShown = true; renderPinyin(); } }, 'Hiện pinyin'));
  }
  renderPinyin();

  const now = Date.now();
  const base = state || newCardState(card.id, now);
  const nextInterval = (g) => (g.grade === 'mastered' ? markMastered(base, now) : review(base, g.q, now)).interval_days;
  const grades = h('div', { class: 'grades hidden', role: 'group', 'aria-label': 'Bạn nhớ từ này thế nào?' },
    GRADES.map((g) => h('button', {
      class: ['btn', g.cls], type: 'button', 'aria-keyshortcuts': g.key,
      onclick: () => grade(g),
    }, icon(g.icon), g.label, kind === 'relearn' ? null : h('small', {}, g.grade === 'again' ? 'ôn lại ngay' : `ôn sau ${intervalText(nextInterval(g))}`))));
  const navRow = h('div', { class: 'card-nav' },
    h('button', { class: 'btn ghost', type: 'button', disabled: !onBack, onclick: () => onBack?.(), 'aria-keyshortcuts': 'ArrowLeft' }, icon('back'), 'Quay lại'),
    h('button', { class: 'btn ghost', type: 'button', disabled: !onSkip, onclick: () => { if (!graded && onSkip) { graded = true; onSkip(); } }, 'aria-keyshortcuts': 'ArrowRight' }, 'Bỏ qua', icon('chevron')));

  const flipBtn = h('button', { class: 'btn primary big block', type: 'button', onclick: () => flip(), 'aria-keyshortcuts': 'Space' }, 'Lật thẻ', h('span', { class: 'kbd' }, 'Space'));

  // Nét viết: bấm nút bút để xem thứ tự nét ngay trên thẻ, bấm lại để ẩn.
  const hasHan = /[㐀-鿿]/.test(card.hanzi);
  const strokesSlot = h('div', { class: 'fc-strokes hidden', onclick: (e) => e.stopPropagation() });
  const hanziEl = h('div', { class: 'hanzi', lang: 'zh-CN' }, card.hanzi);
  const toggleStrokes = (e) => {
    e.stopPropagation();
    const show = strokesSlot.classList.contains('hidden');
    if (show && !strokesSlot.firstChild) strokesSlot.append(strokeViewer(card.hanzi.replace(/（.*?）|\(.*?\)/g, ''), { size: [...card.hanzi].length > 2 ? 72 : 96 }));
    strokesSlot.classList.toggle('hidden', !show);
    hanziEl.classList.toggle('hidden', show);
    strokeBtn.classList.toggle('on', show);
    strokeBtn.setAttribute('aria-pressed', String(show));
  };
  const strokeBtn = hasHan ? h('button', { class: 'btn tinted icon-only fc-stroke-btn', type: 'button', 'aria-label': 'Xem nét viết', title: 'Xem nét viết', 'aria-pressed': 'false', onclick: toggleStrokes }, icon('pencil')) : null;

  const face = h('div', { class: 'fc px-box', onclick: () => { if (!flipped) flip(); } },
    tag,
    speakButton(card.hanzi, rate),
    strokeBtn,
    hanziEl,
    strokesSlot,
    pinyinSlot,
    back);

  const el = face;
  const actions = h('div', {}, flipBtn, grades, navRow);

  function flip() {
    if (flipped) return;
    flipped = true;
    back.classList.remove('hidden');
    renderPinyin();
    flipBtn.classList.add('hidden');
    grades.classList.remove('hidden');
    grades.querySelector('.g-good')?.focus({ preventScroll: true });
    if (kind === 'new') speak(card.hanzi, rate);
  }

  let graded = false;
  function grade(g) {
    if (!flipped || graded) return;
    graded = true;
    onGrade(g.q, g.grade);
  }

  function onKey(e) {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); flip(); return; }
    if (e.key === 'ArrowLeft' && onBack) { e.preventDefault(); onBack(); return; }
    if (e.key === 'ArrowRight' && onSkip && !graded) { e.preventDefault(); graded = true; onSkip(); return; }
    const g = GRADES.find((x) => x.key === e.key);
    if (g && flipped) { e.preventDefault(); grade(g); }
  }
  window.addEventListener('keydown', onKey);

  return { el, actions, destroy: () => window.removeEventListener('keydown', onKey) };
}

function speakButtonInline(text, rate) {
  return h('button', {
    class: 'btn ghost', type: 'button', 'aria-label': 'Nghe câu ví dụ', title: 'Nghe câu ví dụ',
    style: { minHeight: '32px', padding: '0 8px', verticalAlign: 'middle' },
    onclick: (e) => { e.stopPropagation(); speak(text, rate); },
  }, icon('speaker'));
}

/** Câu ví dụ ở mặt sau thẻ: chữ Hán (tô đậm từ đang học) + nút nghe, pinyin, nghĩa. */
function exampleBlock(ex, word, rate, dict) {
  if (!ex?.zh) return null;
  const w = String(word).replace(/（.*?）|\(.*?\)/g, '').trim();
  const parts = w && ex.zh.includes(w) ? ex.zh.split(w) : [ex.zh];
  const zh = h('div', { class: 'han ex-zh', lang: 'zh-CN' }, parts.flatMap((p, i) => (i ? [h('b', { class: 'ex-word' }, w), p] : [p])));
  const py = h('div', { class: 'ex-py' }, ex.pinyin || '');
  if (!ex.pinyin) {
    // Pinyin theo ngữ cảnh câu, tính khi cần (thư viện pinyin tải riêng).
    Promise.all([import('../../core/pinyin-text.js'), import('../../core/segment.js')]).then(([P, S]) => {
      const text = ex.zh.replace(/[。？！]+$/, '');
      py.textContent = P.sentencePinyin(ex.zh, S.segmentSentence(ex.zh, dict || S.buildDictionary([])), dict);
      if (!py.textContent) py.textContent = P.charPinyin(text).filter(Boolean).join(' ');
    }).catch(() => {});
  }
  return h('div', { class: 'example', onclick: (e) => e.stopPropagation() },
    h('div', { class: 'ex-cap' }, 'Ví dụ'),
    h('div', { class: 'ex-line' }, zh, speakButtonInline(ex.zh, rate)),
    py,
    ex.vi ? h('div', { class: 'muted ex-vi' }, ex.vi) : null);
}
