// Trò chơi ngắn (mục 9.5). Mỗi trò < 2 phút. Kết quả ghi review_events với activity = "game",
// ảnh hưởng SRS chỉ bằng nửa (repo.recordReview mode 'light').

import { h, mount } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak, chineseVoice, ttsSupported } from '../../ui/speech.js';
import { shuffle } from '../../core/exercises.js';

export const GAMES = [
  { id: 'match', title: 'Nối cặp', desc: '6 cặp chữ – nghĩa, càng nhanh càng tốt.' },
  { id: 'race', title: 'Đua thời gian', desc: '60 giây, đoán nghĩa từ hiện ra.' },
  { id: 'build', title: 'Xây câu', desc: 'Sắp xếp các mảnh thành câu, không tính điểm.' },
  { id: 'listen', title: 'Nghe chọn chữ', desc: 'Nghe phát âm, chọn chữ Hán đúng.' },
];

/** Chọn thẻ cho trò chơi: ưu tiên thẻ đã học; thiếu thì lấy thêm thẻ của bài đang học. */
export function gameCards(data, n) {
  const learned = data.cards.filter((c) => data.statesById.get(c.id)?.last_reviewed_at != null);
  let pool = shuffle(learned);
  if (pool.length < n) {
    const extra = (data.active ? data.active.vocab_ids.map((id) => data.cardsById.get(id)) : data.cards)
      .filter((c) => c && !pool.includes(c));
    pool = [...pool, ...shuffle(extra)];
  }
  if (pool.length < n) pool = [...pool, ...shuffle(data.cards.filter((c) => !pool.includes(c)))];
  return pool.slice(0, n);
}

const fmtSec = (ms) => `${(ms / 1000).toFixed(1)} giây`;

// ---------------------------------------------------------------- Nối cặp
export function matchGame({ cards, onResult, onDone }) {
  const pairs = cards.slice(0, 6);
  const root = h('div', { class: 'stack' });
  if (pairs.length < 2) { mount(root, h('p', {}, 'Cần ít nhất 2 từ để chơi.')); setTimeout(() => onDone({ skipped: true }), 0); return { el: root, destroy() {} }; }
  const t0 = performance.now();
  let selected = null;
  let matched = 0;
  let mistakes = 0;
  const missedOnce = new Set();
  const clock = h('span', { class: 'timer-pill' }, '0.0');
  const tick = setInterval(() => { clock.textContent = ((performance.now() - t0) / 1000).toFixed(1); }, 100);

  const tiles = shuffle([
    ...pairs.map((c) => ({ id: c.id, text: c.hanzi, han: true })),
    ...pairs.map((c) => ({ id: c.id, text: c.meaning, han: false })),
  ]).map((t) => {
    const b = h('button', { class: ['chip', t.han ? 'han' : ''], type: 'button' }, t.text);
    b.onclick = () => pick(t, b);
    return b;
  });

  function pick(t, b) {
    if (b.disabled) return;
    if (!selected) { selected = { t, b }; b.classList.add('selected'); return; }
    if (selected.b === b) { b.classList.remove('selected'); selected = null; return; }
    if (selected.t.han === t.han) { selected.b.classList.remove('selected'); selected = { t, b }; b.classList.add('selected'); return; }
    const a = selected;
    selected = null;
    a.b.classList.remove('selected');
    if (a.t.id === t.id) {
      [a.b, b].forEach((x) => { x.disabled = true; x.classList.add('correct'); });
      matched++;
      onResult?.(t.id, !missedOnce.has(t.id));
      if (matched === pairs.length) finish();
    } else {
      mistakes++;
      missedOnce.add(a.t.id);
      missedOnce.add(t.id);
      [a.b, b].forEach((x) => { x.classList.add('wrong'); setTimeout(() => x.classList.remove('wrong'), 400); });
    }
  }
  function finish() {
    clearInterval(tick);
    onDone({ ms: performance.now() - t0, mistakes, pairs: pairs.length });
  }
  mount(root, h('div', { class: 'row between' }, h('h2', { style: { margin: 0 } }, 'Nối cặp'), clock),
    h('p', { class: 'muted small' }, 'Chọn một chữ Hán rồi chọn nghĩa của nó.'),
    h('div', { class: 'options' }, tiles));
  return { el: root, destroy: () => clearInterval(tick) };
}

// ---------------------------------------------------------------- Đua thời gian
export function raceGame({ cards, pool, onResult, onDone, seconds = 60 }) {
  const root = h('div', { class: 'stack' });
  const queue = shuffle(cards);
  let qi = 0, correct = 0, total = 0, left = seconds, over = false;
  const clock = h('span', { class: 'timer-pill' }, `${left}s`);
  const score = h('span', { class: 'badge' }, '0 đúng');
  const stage = h('div');
  const tick = setInterval(() => { left--; clock.textContent = `${left}s`; if (left <= 0) end(); }, 1000);

  function show() {
    if (over) return;
    if (qi >= queue.length) { queue.push(...shuffle(cards)); }
    const c = queue[qi++];
    const others = shuffle(pool.filter((x) => x.id !== c.id && x.meaning !== c.meaning)).slice(0, 3).map((x) => x.meaning);
    const opts = shuffle([c.meaning, ...new Set(others)]);
    const btns = opts.map((o, k) => h('button', { class: 'chip', type: 'button', 'aria-keyshortcuts': String(k + 1), onclick: () => answer(o) }, o));
    function answer(o) {
      if (over) return;
      const ok = o === c.meaning;
      total++;
      if (ok) correct++;
      score.textContent = `${correct} đúng`;
      onResult?.(c.id, ok);
      btns.forEach((b) => { b.disabled = true; if (b.textContent === c.meaning) b.classList.add('correct'); else if (b.textContent === o) b.classList.add('wrong'); });
      setTimeout(show, ok ? 250 : 900);
    }
    stage.replaceChildren(h('div', { class: 'game-hanzi', lang: 'zh-CN' }, c.hanzi), h('div', { class: 'options' }, btns));
    keyFn = (e) => { const n = Number(e.key); if (n >= 1 && n <= btns.length && !btns[n - 1].disabled) btns[n - 1].click(); };
  }
  let keyFn = null;
  const onKey = (e) => keyFn?.(e);
  window.addEventListener('keydown', onKey);
  function end() {
    if (over) return;
    over = true;
    clearInterval(tick);
    window.removeEventListener('keydown', onKey);
    onDone({ correct, total });
  }
  mount(root, h('div', { class: 'row between' }, h('h2', { style: { margin: 0 } }, 'Đua thời gian'), h('div', { class: 'row' }, score, clock)), stage);
  show();
  return { el: root, destroy: () => { over = true; clearInterval(tick); window.removeEventListener('keydown', onKey); } };
}

// ---------------------------------------------------------------- Xây câu
export function buildGame({ sentences, onDone }) {
  const root = h('div', { class: 'stack' });
  const list = shuffle(sentences).slice(0, 8);
  let i = 0, done = 0;
  function show() {
    if (i >= list.length) { onDone({ done, total: list.length }); return; }
    const s = list[i];
    const pieces = shuffle(s.options.map((t, k) => ({ t, k })));
    const chosen = [];
    const area = h('div', { class: 'build-area' });
    const bank = h('div', { class: 'row' });
    const msg = h('div', { 'aria-live': 'polite' });
    const want = Array.isArray(s.answer) ? s.answer.join('') : s.answer;
    const redraw = () => {
      area.replaceChildren(...chosen.map((p, idx) => h('button', { class: 'chip han', type: 'button', onclick: () => { chosen.splice(idx, 1); redraw(); } }, p.t)));
      bank.replaceChildren(...pieces.map((p) => h('button', { class: ['chip', 'han', chosen.includes(p) ? 'used' : ''], type: 'button', onclick: () => { chosen.push(p); redraw(); check(); } }, p.t)));
    };
    const check = () => {
      if (chosen.length !== pieces.length) return;
      if (chosen.map((p) => p.t).join('') === want) {
        done++;
        msg.replaceChildren(h('div', { class: 'feedback ok' }, h('strong', {}, 'Hoàn thành!'), s.explanation || ''));
        setTimeout(() => { i++; show(); }, 900);
      } else msg.replaceChildren(h('div', { class: 'feedback no' }, 'Chưa đúng thứ tự, bấm mảnh trong câu để sửa.'));
    };
    redraw();
    mount(root, h('div', { class: 'row between' }, h('h2', { style: { margin: 0 } }, 'Xây câu'), h('span', { class: 'badge' }, `${done}/${list.length} câu`)),
      s.prompt ? h('p', {}, s.prompt) : null, area, bank, msg,
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { i++; show(); } }, 'Bỏ qua'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(want) }, icon('speaker'), 'Nghe câu')));
  }
  show();
  return { el: root, destroy() {} };
}

// ---------------------------------------------------------------- Nghe chọn chữ
export function listenGame({ cards, pool, rate = 1, onResult, onDone, rounds = 10 }) {
  const root = h('div', { class: 'stack' });
  const qs = shuffle(cards).slice(0, rounds);
  let i = 0, correct = 0;
  function show() {
    if (i >= qs.length) { onDone({ correct, total: qs.length }); return; }
    const c = qs[i];
    const others = shuffle(pool.filter((x) => x.hanzi !== c.hanzi)).slice(0, 3);
    const opts = shuffle([c, ...others]);
    const btns = opts.map((o) => h('button', { class: 'chip han', type: 'button', onclick: () => answer(o) }, o.hanzi));
    const fb = h('div', { 'aria-live': 'polite' });
    function answer(o) {
      const ok = o.hanzi === c.hanzi;
      if (ok) correct++;
      onResult?.(c.id, ok);
      btns.forEach((b, k) => { b.disabled = true; if (opts[k].hanzi === c.hanzi) b.classList.add('correct'); else if (opts[k] === o) b.classList.add('wrong'); });
      fb.replaceChildren(h('div', { class: ['feedback', ok ? 'ok' : 'no'] }, h('span', { class: 'han' }, c.hanzi), ` ${c.pinyin} — ${c.meaning}`));
      setTimeout(() => { i++; show(); }, ok ? 900 : 1800);
    }
    mount(root, h('div', { class: 'row between' }, h('h2', { style: { margin: 0 } }, 'Nghe chọn chữ'), h('span', { class: 'badge' }, `Câu ${i + 1}/${qs.length}`)),
      h('div', { class: 'center' }, h('button', { class: 'btn primary big', type: 'button', onclick: () => speak(c.hanzi, rate) }, icon('speaker'), 'Nghe lại'),
        ' ', h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(c.hanzi, 0.7) }, 'Chậm 0.7×')),
      h('div', { class: 'options' }, btns), fb);
    speak(c.hanzi, rate);
  }
  show();
  return { el: root, destroy: () => { if (ttsSupported()) speechSynthesis.cancel(); } };
}

export { chineseVoice, fmtSec };
