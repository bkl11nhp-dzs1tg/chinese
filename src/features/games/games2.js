// Trò chơi mới: Chọn nhanh (phản xạ), Ghép chữ Hán (kéo thả thành phần), Đấu trường 2 người (chia đôi màn hình).
// Mọi trò lấy dữ liệu từ từ vựng giáo trình người học đã học (gameCards).

import { h, mount } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { shuffle } from '../../core/exercises.js';
import { cue, flashText, bump } from '../../ui/feedback.js';
import { parseIds, leaves } from '../../core/decomp.js';

/** Sao 0–3 theo tỉ lệ đúng (và thời gian nếu có). */
export function starsFor(ratio) { return ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : ratio >= 0.4 ? 1 : 0; }

const hud = (title, ...items) => h('div', { class: 'game-hud glass' }, h('strong', { class: 'gh-title' }, title), h('div', { class: 'gh-items' }, items));
const stat = (label, el) => h('span', { class: 'gh-stat' }, h('small', {}, label), el);
const clean = (s) => String(s || '').replace(/（.*?）|\(.*?\)/g, '').trim();

// ---------------------------------------------------------------- Chọn nhanh
/** Đề: nghĩa hoặc pinyin; 6 ô chữ Hán, chọn đúng càng nhanh càng nhiều điểm (tối đa 10 câu, mỗi câu 6 giây). */
export function quickGame({ cards, pool, onResult, onDone, onProgress, rounds = 10, perQ = 6 }) {
  const root = h('div', { class: 'stack' });
  const qs = cards.slice(0, rounds);
  let i = 0, correct = 0, points = 0, combo = 0, timer = null, t0 = 0;
  const ptsEl = h('b', {}, '0'), comboEl = h('b', {}, '×0');
  const bar = h('div', { class: 'time-bar' }, h('span', { style: { width: '100%' } }));
  const ask = h('div', { class: 'qk-ask' });
  const grid = h('div', { class: 'mg-grid qk-grid' });
  mount(root, hud('Chọn nhanh', stat('Điểm', ptsEl), stat('Combo', comboEl)), bar, ask, grid);
  function next() {
    clearInterval(timer);
    onProgress?.(i / qs.length, `${Math.min(i + 1, qs.length)}/${qs.length}`);
    if (i >= qs.length) { onDone({ correct, total: qs.length, points }); return; }
    const c = qs[i];
    const byPinyin = i % 2 === 1;
    ask.replaceChildren(h('small', {}, byPinyin ? 'Pinyin' : 'Nghĩa'), h('div', { class: ['qk-main', byPinyin ? 'py' : ''] }, byPinyin ? c.pinyin : c.meaning));
    const opts = shuffle([c, ...shuffle(pool.filter((x) => x.id !== c.id && clean(x.hanzi) !== clean(c.hanzi)), Math.random).slice(0, 5)], Math.random);
    grid.replaceChildren(...opts.map((o) => h('button', { class: 'mg-tile han', type: 'button', onclick: (e) => answer(o, e.currentTarget) }, clean(o.hanzi))));
    t0 = performance.now();
    const fill = bar.firstChild;
    fill.style.transition = 'none'; fill.style.width = '100%';
    requestAnimationFrame(() => { fill.style.transition = `width ${perQ}s linear`; fill.style.width = '0%'; });
    timer = setTimeout(() => answer(null, null), perQ * 1000);
  }
  let locked = false;
  function answer(o, btn) {
    if (locked) return;
    locked = true;
    clearTimeout(timer);
    const c = qs[i];
    const ok = o && o.id === c.id;
    const sec = (performance.now() - t0) / 1000;
    if (ok) { correct++; combo++; points += Math.max(10, Math.round(100 - sec * 12)) + (combo >= 3 ? 20 : 0); if (combo >= 3) flashText(`Combo ×${combo}!`); }
    else combo = 0;
    ptsEl.textContent = String(points); comboEl.textContent = `×${combo}`; bump(ptsEl);
    cue(ok ? 'good' : 'bad');
    grid.querySelectorAll('.mg-tile').forEach((b) => { if (b.textContent === clean(c.hanzi)) b.classList.add('correct'); });
    if (btn && !ok) btn.classList.add('wrong');
    onResult?.(c.id, ok);
    speak(clean(c.hanzi));
    setTimeout(() => { locked = false; i++; next(); }, ok ? 550 : 1100);
  }
  next();
  return { el: root, destroy() { clearTimeout(timer); } };
}

// ---------------------------------------------------------------- Ghép chữ Hán (kéo thả)
/** Thành phần bị xáo trộn (gồm cả thành phần nhiễu); kéo/thả hoặc chạm vào ô theo đúng bố cục để ghép thành chữ. */
export function composeGame({ cards, decomp, onResult, onDone, onProgress, rounds = 8 }) {
  const root = h('div', { class: 'stack' });
  const items = [];
  for (const c of cards) {
    for (const ch of [...clean(c.hanzi)]) {
      const x = decomp[ch];
      if (!x?.d) continue;
      const { op, parts } = parseIds(x.d);
      // Bỏ chữ bị tách thành nét đơn (一, 丨…) – không phải thành phần thật.
      if (parts.length < 2 || parts.some((p) => [...p].length !== 1 || /[？?一丨丿丶乙亅⺀]/.test(p))) continue;
      if (items.some((it) => it.ch === ch)) continue;
      items.push({ ch, op, parts, card: c });
      break;
    }
    if (items.length >= rounds) break;
  }
  if (!items.length) { mount(root, h('p', { class: 'notice' }, 'Chưa đủ chữ để ghép.')); setTimeout(() => onDone({ correct: 0, total: 0, skipped: true }), 0); return { el: root, destroy() {} }; }
  const allParts = [...new Set(Object.values(decomp).flatMap((x) => leaves(x.d)).filter((p) => [...p].length === 1))];
  let i = 0, correct = 0, tries = 0;
  const scoreEl = h('b', {}, '0');
  const stageEl = h('div', { class: 'cg-stage' });
  mount(root, hud('Ghép chữ Hán', stat('Đúng', scoreEl)), stageEl);
  function next() {
    onProgress?.(i / items.length, `${Math.min(i + 1, items.length)}/${items.length}`);
    if (i >= items.length) { onDone({ correct, total: items.length }); return; }
    const it = items[i];
    tries = 0;
    const vertical = it.op === '⿱' || it.op === '⿳';
    const slots = it.parts.map(() => h('div', { class: 'cg-slot', 'aria-label': 'Ô ghép' }));
    const extras = shuffle(allParts.filter((p) => !it.parts.includes(p)), Math.random).slice(0, Math.max(2, 5 - it.parts.length));
    const tiles = shuffle([...it.parts, ...extras], Math.random).map((p) => h('button', { class: 'cg-tile han', type: 'button', draggable: 'true', dataset: { p } }, p));
    const bank = h('div', { class: 'cg-bank' }, tiles);
    const frame = h('div', { class: ['cg-frame', vertical ? 'v' : 'hz'] }, slots);
    stageEl.replaceChildren(
      h('div', { class: 'ask-card' }, h('div', { class: 'ask-cap' }, h('span', {}, 'Ghép chữ có nghĩa'), h('span', { class: 'ask-n' }, `${it.parts.length} phần`)),
        h('div', { class: 'ask-main' }, it.card.meaning), h('div', { class: 'ask-sub' }, `${it.card.pinyin} · trong 「${clean(it.card.hanzi)}」`)),
      frame, bank);
    const place = (tile, slot) => {
      if (slot.firstChild) bank.append(slot.firstChild);
      slot.append(tile);
      if (slots.every((s) => s.firstChild)) check();
    };
    const firstEmpty = () => slots.find((s) => !s.firstChild);
    for (const t of tiles) {
      t.onclick = () => { if (t.parentNode === bank) { const s = firstEmpty(); if (s) place(t, s); } else bank.append(t); };
      t.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', t.dataset.p); t.classList.add('dragging'); });
      t.addEventListener('dragend', () => t.classList.remove('dragging'));
      // Kéo bằng ngón tay (cảm ứng)
      t.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const ghost = t.cloneNode(true); ghost.classList.add('cg-ghost'); document.body.append(ghost);
        const mv = (ev) => { ghost.style.left = `${ev.clientX - 28}px`; ghost.style.top = `${ev.clientY - 28}px`; };
        mv(e);
        const up = (ev) => {
          window.removeEventListener('pointermove', mv); ghost.remove();
          const s = slots.find((sl) => { const r = sl.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; });
          if (s) { ev.preventDefault(); place(t, s); t.dataset.dropped = '1'; setTimeout(() => delete t.dataset.dropped, 50); }
        };
        window.addEventListener('pointermove', mv);
        window.addEventListener('pointerup', up, { once: true });
      });
      t.addEventListener('click', (e) => { if (t.dataset.dropped) e.stopImmediatePropagation(); }, true);
    }
    for (const s of slots) {
      s.addEventListener('dragover', (e) => { e.preventDefault(); s.classList.add('over'); });
      s.addEventListener('dragleave', () => s.classList.remove('over'));
      s.addEventListener('drop', (e) => { e.preventDefault(); s.classList.remove('over'); const t = tiles.find((x) => x.dataset.p === e.dataTransfer.getData('text/plain')); if (t) place(t, s); });
    }
    function check() {
      const got = slots.map((s) => s.firstChild?.dataset.p);
      const ok = got.every((p, k) => p === it.parts[k]);
      tries++;
      if (ok || tries >= 2) {
        if (ok && tries === 1) correct++;
        scoreEl.textContent = String(correct); bump(scoreEl);
        onResult?.(it.card.id, ok && tries === 1);
        cue(ok ? 'good' : 'bad');
        frame.classList.add(ok ? 'ok' : 'no');
        frame.after(h('div', { class: 'cg-answer' }, h('span', { class: 'han' }, it.ch), ok ? 'Đúng rồi!' : `Đáp án: ${it.parts.join(' + ')}`));
        speak(it.ch);
        setTimeout(() => { i++; next(); }, 1300);
      } else {
        cue('bad');
        frame.classList.add('shake'); setTimeout(() => frame.classList.remove('shake'), 400);
        slots.forEach((s, k) => { if (s.firstChild?.dataset.p !== it.parts[k]) bank.append(s.firstChild); });
      }
    }
  }
  next();
  return { el: root, destroy() {} };
}

// ---------------------------------------------------------------- Đấu trường 2 người
/** Chia đôi màn hình (xoay ngang: trái/phải; dọc: trên/dưới, nửa trên xoay ngược cho người ngồi đối diện). Cùng câu hỏi, ai đúng trước được điểm. */
export function duelGame({ cards, pool, onDone, onProgress, rounds = 10 }) {
  const root = h('div', { class: 'duel' });
  const qs = cards.slice(0, rounds);
  const P = [{ name: 'Đỏ', cls: 'p1', score: 0, combo: 0 }, { name: 'Xanh', cls: 'p2', score: 0, combo: 0 }];
  let i = 0, locked = false;
  const sides = P.map((p) => {
    const scoreEl = h('b', { class: 'du-score' }, '0');
    const comboEl = h('span', { class: 'du-combo' });
    const askEl = h('div', { class: 'du-ask' });
    const opts = h('div', { class: 'du-opts' });
    const el = h('div', { class: ['du-side', p.cls] }, h('div', { class: 'du-head' }, h('span', { class: 'du-name' }, p.name), comboEl, scoreEl), askEl, opts);
    return { p, el, scoreEl, comboEl, askEl, opts };
  });
  const mid = h('div', { class: 'du-mid' });
  mount(root, sides[0].el, mid, sides[1].el);
  function next() {
    onProgress?.(i / qs.length, `${Math.min(i + 1, qs.length)}/${qs.length}`);
    if (i >= qs.length) { onDone({ scores: P.map((p) => p.score), total: qs.length }); return; }
    locked = false;
    const c = qs[i];
    const kind = ['meaning', 'pinyin', 'listen'][i % 3];
    const opts = shuffle([c, ...shuffle(pool.filter((x) => x.id !== c.id && clean(x.hanzi) !== clean(c.hanzi)), Math.random).slice(0, 3)], Math.random);
    mid.textContent = `Câu ${i + 1}/${qs.length}`;
    if (kind === 'listen') setTimeout(() => speak(clean(c.hanzi)), 200);
    for (const s of sides) {
      s.askEl.replaceChildren(kind === 'listen'
        ? h('button', { class: 'btn tinted', type: 'button', onclick: () => speak(clean(c.hanzi)) }, icon('speaker'), 'Nghe')
        : h('span', { class: kind === 'pinyin' ? 'py' : '' }, kind === 'pinyin' ? c.pinyin : c.meaning));
      s.opts.replaceChildren(...opts.map((o) => h('button', { class: 'du-opt han', type: 'button', onclick: (e) => answer(s, o, e.currentTarget) }, clean(o.hanzi))));
    }
  }
  function answer(s, o, btn) {
    if (locked || btn.disabled) return;
    const c = qs[i];
    if (o.id === c.id) {
      locked = true;
      s.p.combo++;
      s.p.score += 1 + (s.p.combo >= 3 ? 1 : 0);
      const other = sides.find((x) => x !== s); other.p.combo = 0;
      for (const x of sides) { x.scoreEl.textContent = String(x.p.score); x.comboEl.textContent = x.p.combo >= 2 ? `🔥${x.p.combo}` : ''; }
      btn.classList.add('correct'); bump(s.scoreEl); cue('good');
      s.el.classList.add('win'); setTimeout(() => s.el.classList.remove('win'), 700);
      setTimeout(() => { i++; next(); }, 900);
    } else {
      // Sai: khóa riêng bên đó trong câu này
      btn.classList.add('wrong'); cue('bad');
      s.opts.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      s.p.combo = 0; s.comboEl.textContent = '';
      if (sides.every((x) => [...x.opts.querySelectorAll('button')].every((b) => b.disabled))) { locked = true; setTimeout(() => { i++; next(); }, 900); }
    }
  }
  next();
  return { el: root, destroy() {} };
}

// ---------------------------------------------------------------- Lật thẻ ghi nhớ
/** 12 thẻ úp (6 cặp chữ – nghĩa). Lật 2 thẻ mỗi lượt; khớp thì giữ ngửa. Sao theo số lượt lật. */
export function memoryGame({ cards, onResult, onDone, onProgress, pairs = 6 }) {
  const root = h('div', { class: 'stack' });
  const set = cards.slice(0, pairs);
  const deck = shuffle(set.flatMap((c) => [{ id: c.id, text: clean(c.hanzi), han: true, c }, { id: c.id, text: c.meaning, han: false, c }]), Math.random);
  let open = [], found = 0, moves = 0, busy = false;
  const t0 = performance.now();
  const movesEl = h('b', {}, '0'), foundEl = h('b', {}, `0/${set.length}`);
  const missed = new Set();
  const tiles = deck.map((d) => {
    const b = h('button', { class: 'mem-card', type: 'button', 'aria-label': 'Thẻ úp' },
      h('span', { class: 'mc-back' }, h('span', { class: 'han' }, '?')),
      h('span', { class: ['mc-front', d.han ? 'han' : ''] }, d.text));
    b.onclick = () => flip(b, d);
    return b;
  });
  mount(root, hud('Lật thẻ ghi nhớ', stat('Cặp', foundEl), stat('Lượt', movesEl)), h('div', { class: 'mem-grid' }, tiles));
  function flip(b, d) {
    if (busy || b.classList.contains('up')) return;
    b.classList.add('up');
    if (d.han) speak(d.text);
    open.push({ b, d });
    if (open.length < 2) return;
    moves++; movesEl.textContent = String(moves); bump(movesEl);
    const [a, z] = open; open = [];
    if (a.d.id === z.d.id) {
      found++; foundEl.textContent = `${found}/${set.length}`; cue('good');
      a.b.classList.add('done'); z.b.classList.add('done');
      onResult?.(a.d.id, !missed.has(a.d.id));
      onProgress?.(found / set.length, `${found}/${set.length}`);
      if (found === set.length) setTimeout(() => onDone({ moves, pairs: set.length, ms: performance.now() - t0 }), 600);
    } else {
      busy = true; cue('tap');
      missed.add(a.d.id); missed.add(z.d.id);
      setTimeout(() => { a.b.classList.remove('up'); z.b.classList.remove('up'); busy = false; }, 850);
    }
  }
  onProgress?.(0, `0/${set.length}`);
  return { el: root, destroy() {} };
}
