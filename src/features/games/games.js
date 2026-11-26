// Trò chơi ngắn (mục 9.5). Mỗi trò < 2 phút. Kết quả ghi review_events với activity = "game",
// ảnh hưởng SRS chỉ bằng nửa (repo.recordReview mode 'light').

import { h, mount } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak, chineseVoice, ttsSupported } from '../../ui/speech.js';
import { shuffle } from '../../core/exercises.js';
import { freshOrder, markSeen } from '../../core/variety.js';
import { flashText, bump } from '../../ui/feedback.js';

// 6 trò chính (Nối cặp và Đua thời gian giữ lại trong code: buổi học vẫn dùng Nối cặp ở cuối buổi).
export const GAMES = [
  { id: 'memory', title: 'Lật thẻ ghi nhớ', desc: 'Lật 2 thẻ tìm cặp chữ – nghĩa, càng ít lượt càng tốt.' },
  { id: 'quick', title: 'Chọn nhanh', desc: 'Nhìn nghĩa / pinyin, chạm đúng chữ thật nhanh.' },
  { id: 'compose', title: 'Ghép chữ Hán', desc: 'Kéo thả bộ thủ, thành phần thành chữ.' },
  { id: 'listen', title: 'Nghe chọn chữ', desc: 'Nghe phát âm, chọn chữ Hán đúng.' },
  { id: 'build', title: 'Sắp xếp câu', desc: 'Sắp các từ thành câu đúng ngữ pháp.' },
  { id: 'duel', title: 'Đấu trường 2 người', desc: 'Chia đôi màn hình, ai đúng trước được điểm.' },
];

/**
 * Chọn thẻ cho trò chơi: từ các bài đã qua tới bài đang học (cộng từ đã học ở bài khác),
 * ưu tiên từ lâu chưa gặp trong trò chơi / luyện tập để không lặp mãi vài từ đầu sách.
 */
export function gameCards(data, n) {
  const learned = (c) => data.statesById.get(c.id)?.last_reviewed_at != null;
  const activeIdx = data.active ? data.lessons.indexOf(data.active) : -1;
  const upto = new Set(data.lessons.slice(0, Math.max(1, activeIdx + 1)).flatMap((l) => l.vocab_ids));
  let pool = data.cards.filter((c) => upto.has(c.id) || learned(c));
  if (pool.length < n) pool = data.cards;
  const now = Date.now();
  const picked = freshOrder(pool, 'w', {
    bonus: (c) => { const st = data.statesById.get(c.id); return !st?.last_reviewed_at ? -0.5 : st.due_at <= now ? 0.8 : 0.3; },
  }).slice(0, n);
  markSeen('w', picked.map((c) => c.id));
  return picked;
}

const fmtSec = (ms) => `${(ms / 1000).toFixed(1)} giây`;

/** Thanh trạng thái trò chơi: tên + các ô số liệu. */
function hud(title, ...items) {
  return h('div', { class: 'game-hud glass' }, h('strong', { class: 'gh-title' }, title), h('div', { class: 'gh-items' }, items));
}
const stat = (label, el) => h('span', { class: 'gh-stat' }, h('small', {}, label), el);
function popFx(parent, text, good = true) {
  const fx = h('span', { class: ['pop-fx', good ? 'good' : 'bad'] }, text);
  parent.append(fx);
  setTimeout(() => fx.remove(), 700);
}

// ---------------------------------------------------------------- Nối cặp
export function matchGame({ cards, onResult, onDone, onProgress }) {
  const pairs = cards.slice(0, 6);
  const root = h('div', { class: 'stack' });
  if (pairs.length < 2) { mount(root, h('p', {}, 'Cần ít nhất 2 từ để chơi.')); setTimeout(() => onDone({ skipped: true }), 0); return { el: root, destroy() {} }; }
  const t0 = performance.now();
  let selected = null;
  let matched = 0;
  let mistakes = 0;
  const missedOnce = new Set();
  const clock = h('b', {}, '0.0s');
  const pairsEl = h('b', {}, `0/${pairs.length}`);
  const comboEl = h('b', {}, '×0');
  let combo = 0;
  const tick = setInterval(() => { clock.textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`; }, 100);

  const tiles = shuffle([
    ...pairs.map((c) => ({ id: c.id, text: c.hanzi, han: true })),
    ...pairs.map((c) => ({ id: c.id, text: c.meaning, han: false })),
  ]).map((t) => {
    const b = h('button', { class: ['mg-tile', t.han ? 'han' : ''], type: 'button' }, h('span', {}, t.text));
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
      [a.b, b].forEach((x) => { x.disabled = true; x.classList.add('correct'); setTimeout(() => x.classList.add('gone'), 450); });
      matched++;
      onProgress?.(matched / pairs.length, `${matched}/${pairs.length}`);
      combo++;
      pairsEl.textContent = `${matched}/${pairs.length}`;
      comboEl.textContent = `×${combo}`;
      if (combo >= 2) popFx(b, `Combo ×${combo}`);
      if (combo >= 3) flashText(`Combo ×${combo}!`);
      bump(comboEl); bump(pairsEl);
      onResult?.(t.id, !missedOnce.has(t.id));
      if (matched === pairs.length) finish();
    } else {
      mistakes++;
      combo = 0;
      comboEl.textContent = '×0';
      missedOnce.add(a.t.id);
      missedOnce.add(t.id);
      [a.b, b].forEach((x) => { x.classList.add('wrong'); setTimeout(() => x.classList.remove('wrong'), 400); });
    }
  }
  function finish() {
    clearInterval(tick);
    onDone({ ms: performance.now() - t0, mistakes, pairs: pairs.length });
  }
  mount(root, hud('Nối cặp', stat('Cặp', pairsEl), stat('Combo', comboEl), stat('Thời gian', clock)),
    h('p', { class: 'muted small center' }, 'Chọn một chữ Hán rồi chọn nghĩa của nó.'),
    h('div', { class: 'mg-grid' }, tiles));
  return { el: root, destroy: () => clearInterval(tick) };
}

// ---------------------------------------------------------------- Đua thời gian
export function raceGame({ cards, pool, onResult, onDone, seconds = 60 }) {
  const root = h('div', { class: 'stack' });
  const queue = shuffle(cards);
  let qi = 0, correct = 0, total = 0, left = seconds, over = false;
  const clock = h('b', {}, `${left}s`);
  const score = h('b', {}, '0');
  const comboEl = h('b', {}, '×0');
  let combo = 0;
  const timeFill = h('span', { style: { width: '100%' } });
  const timeBar = h('div', { class: 'time-bar' }, timeFill);
  const stage = h('div', { class: 'race-stage' });
  const tick = setInterval(() => {
    left--;
    clock.textContent = `${left}s`;
    timeFill.style.width = `${(left / seconds) * 100}%`;
    timeBar.classList.toggle('low', left <= 10);
    if (left <= 0) end();
  }, 1000);

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
      if (ok) { correct++; combo++; } else combo = 0;
      score.textContent = String(correct);
      comboEl.textContent = `×${combo}`;
      bump(comboEl); if (ok) bump(score);
      if (ok && combo > 0 && combo % 5 === 0) flashText(`Combo ×${combo}!`);
      popFx(stage, ok ? (combo >= 3 ? `+1 · combo ×${combo}` : '+1') : 'Sai', ok);
      onResult?.(c.id, ok);
      btns.forEach((b) => { b.disabled = true; if (b.textContent === c.meaning) b.classList.add('correct'); else if (b.textContent === o) b.classList.add('wrong'); });
      setTimeout(show, ok ? 250 : 900);
    }
    stage.replaceChildren(h('div', { class: 'race-card glass' }, h('div', { class: 'game-hanzi', lang: 'zh-CN' }, c.hanzi)), h('div', { class: 'options' }, btns));
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
  mount(root, hud('Đua thời gian', stat('Đúng', score), stat('Combo', comboEl), stat('Còn', clock)), timeBar, stage);
  show();
  return { el: root, destroy: () => { over = true; clearInterval(tick); window.removeEventListener('keydown', onKey); } };
}

// ---------------------------------------------------------------- Xây câu
export function buildGame({ sentences, onDone, onProgress }) {
  const root = h('div', { class: 'stack' });
  const list = shuffle(sentences).slice(0, 8);
  let i = 0, done = 0;
  function show() {
    onProgress?.(i / list.length, `${Math.min(i + 1, list.length)}/${list.length}`);
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
    mount(root, hud('Xây câu', stat('Xong', h('b', {}, `${done}/${list.length}`))),
      s.prompt ? h('p', {}, s.prompt) : null, area, bank, msg,
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { i++; show(); } }, 'Bỏ qua'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(want) }, icon('speaker'), 'Nghe câu')));
  }
  show();
  return { el: root, destroy() {} };
}

// ---------------------------------------------------------------- Nghe chọn chữ
export function listenGame({ cards, pool, rate = 1, onResult, onDone, onProgress, rounds = 10 }) {
  const root = h('div', { class: 'stack' });
  const qs = shuffle(cards).slice(0, rounds);
  let i = 0, correct = 0;
  function show() {
    onProgress?.(i / qs.length, `${Math.min(i + 1, qs.length)}/${qs.length}`);
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
    mount(root, hud('Nghe chọn chữ', stat('Câu', h('b', {}, `${i + 1}/${qs.length}`)), stat('Đúng', h('b', {}, String(correct)))),
      h('div', { class: 'center' }, h('button', { class: 'btn primary big', type: 'button', onclick: () => speak(c.hanzi, rate) }, icon('speaker'), 'Nghe lại'),
        ' ', h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(c.hanzi, 0.5) }, 'Chậm 0.5×')),
      h('div', { class: 'options' }, btns), fb);
    speak(c.hanzi, rate);
  }
  show();
  return { el: root, destroy: () => { if (ttsSupported()) speechSynthesis.cancel(); } };
}

export { chineseVoice, fmtSec };
