// Ô viết chữ Hán bằng tay (canvas + 田字格) và chấm điểm so với chữ mẫu vẽ bằng font.
// Chấm: chuẩn hóa nét vẽ và chữ mẫu theo khung bao về lưới 48×48, so độ phủ có dung sai (core/practice inkScore).

import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { inkScore } from '../../core/practice.js';

const GRID = 48;
/** Điểm tối thiểu để một chữ viết tay được tính là đạt. */
export const PASS_INK = 0.7;
const FONT = '"PingFang SC","Noto Sans SC","Microsoft YaHei","Source Han Sans SC",sans-serif';

/** Một ô viết cho một chữ. Trả về { el, isEmpty(), score(), showAnswer(), clear(), setGuide(on) }. */
export function charPad(ch, { size = 260, onInk } = {}) {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const canvas = h('canvas', { class: 'hw-canvas', width: size * dpr, height: size * dpr, style: { width: `${size}px`, height: `${size}px` }, 'aria-label': `Ô viết chữ ${ch}` });
  const guide = h('span', { class: 'hw-guide han', lang: 'zh-CN', 'aria-hidden': 'true', style: { fontSize: `${size * 0.82}px` } }, ch);
  const wrap = h('div', { class: 'hw-pad', style: { width: `${size}px`, height: `${size}px` } }, guide, canvas);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const lw = size * 0.055;
  const strokes = [];
  let cur = null;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * (size / r.width), (e.clientY - r.top) * (size / r.height)]; };
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#2b1a1e';
  function redraw() {
    g.clearRect(0, 0, size, size);
    g.strokeStyle = ink; g.lineWidth = lw;
    for (const s of strokes) {
      g.beginPath();
      s.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (s.length === 1) g.lineTo(s[0][0] + 0.1, s[0][1]);
      g.stroke();
    }
  }
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); cur = [pos(e)]; strokes.push(cur); redraw(); });
  canvas.addEventListener('pointermove', (e) => { if (!cur) return; cur.push(pos(e)); redraw(); });
  const end = () => { if (cur) { cur = null; onInk?.(); } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.style.touchAction = 'none';

  /** Mặt nạ 0/1 GRID×GRID của một hàm vẽ, chuẩn hóa theo khung bao (giữ tỉ lệ, căn giữa). */
  function mask(draw) {
    const S = 256;
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d');
    draw(x, S);
    const d = x.getImageData(0, 0, S, S).data;
    let x0 = S, y0 = S, x1 = -1, y1 = -1;
    for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) if (d[(yy * S + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    const out = new Uint8Array(GRID * GRID);
    if (x1 < 0) return out;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    // Co giãn riêng từng chiều (chữ viết hơi dẹt/cao vẫn khớp), trừ nét rất mảnh (vd 一, 丨) thì giữ tỉ lệ.
    const big = Math.max(bw, bh), thin = Math.min(bw, bh) < big * 0.25;
    const sx = (GRID - 4) / (thin ? big : bw), sy = (GRID - 4) / (thin ? big : bh);
    const ox = (GRID - bw * sx) / 2, oy = (GRID - bh * sy) / 2;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      if (d[(yy * S + xx) * 4 + 3] <= 40) continue;
      const gx = Math.min(GRID - 1, Math.floor(ox + (xx - x0) * sx)), gy = Math.min(GRID - 1, Math.floor(oy + (yy - y0) * sy));
      out[gy * GRID + gx] = 1;
    }
    return out;
  }
  return {
    el: wrap,
    isEmpty: () => strokes.length === 0,
    strokeCount: () => strokes.length,
    clear() { strokes.length = 0; redraw(); onInk?.(); },
    undo() { strokes.pop(); redraw(); onInk?.(); },
    setGuide(on) { wrap.classList.toggle('show-guide', on); },
    showAnswer(ok) { wrap.classList.add('show-guide', 'answered', ok ? 'ok' : 'no'); },
    score() {
      const f = 256 / size;
      const user = mask((x) => { x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = lw * f; x.strokeStyle = '#000'; for (const s of strokes) { x.beginPath(); s.forEach(([px, py], k) => (k ? x.lineTo(px * f, py * f) : x.moveTo(px * f, py * f))); if (s.length === 1) x.lineTo(s[0][0] * f + 0.1, s[0][1] * f); x.stroke(); } });
      const ref = mask((x, S) => { x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${S * 0.8}px ${FONT}`; x.fillText(ch, S / 2, S / 2); });
      return inkScore(user, ref, GRID, 4);
    },
  };
}

/** Khu viết cho cả từ (1–2 chữ) + nút gợi ý, xóa, hoàn tác. */
/** guide: 'toggle' (có nút tô mẫu) | 'on' (luôn hiện mẫu – viết theo) | 'none' (ẩn mẫu – viết từ trí nhớ) */
export function writeArea(word, { onChange, guide: guideMode = 'toggle' } = {}) {
  const chars = [...word];
  const size = Math.min(chars.length > 1 ? 168 : 260, Math.floor((Math.min(globalThis.innerWidth || 390, 560) - 48) / chars.length));
  const pads = chars.map((ch) => charPad(ch, { size, onInk: () => onChange?.(pads.every((p) => !p.isEmpty())) }));
  let guide = guideMode === 'on';
  if (guide) pads.forEach((p) => p.setGuide(true));
  const guideBtn = h('button', { class: 'chip opt', type: 'button', 'aria-pressed': 'false', onclick: () => { guide = !guide; pads.forEach((p) => p.setGuide(guide)); guideBtn.classList.toggle('selected', guide); guideBtn.setAttribute('aria-pressed', String(guide)); } }, icon('eye'), 'Tô theo mẫu');
  const tools = h('div', { class: 'hw-tools' },
    guideMode === 'toggle' ? guideBtn : null,
    h('button', { class: 'chip opt', type: 'button', onclick: () => pads.forEach((p) => p.undo()) }, icon('back'), 'Hoàn tác'),
    h('button', { class: 'chip opt', type: 'button', onclick: () => pads.forEach((p) => p.clear()) }, icon('trash'), 'Xóa'));
  return {
    el: h('div', { class: 'hw-area' }, h('div', { class: 'hw-pads' }, pads.map((p) => p.el)), tools),
    usedGuide: () => guide && guideMode !== 'on',
    score: () => Math.min(...pads.map((p) => p.score())),
    showAnswer: (ok) => { pads.forEach((p) => p.showAnswer(ok)); tools.remove(); },
  };
}

/**
 * Trang tập viết: viết một từ `reps` lần trên cùng một trang. Các lần đầu có chữ mẫu mờ để tô,
 * các lần sau để trống (tự viết). Mỗi lần là một hàng ô (mỗi chữ một ô).
 * Trả về { el, filled(), scores(), score(), showAnswer() }.
 */
export function sheetArea(word, reps, { onChange } = {}) {
  const chars = [...word];
  const guided = Math.ceil(reps * 0.4);
  const avail = Math.min(globalThis.innerWidth || 390, 640) - 40;
  // Điện thoại: chữ đơn 3 ô một hàng; từ nhiều chữ một lần một hàng. Mỗi ô có viền 12px, cách nhau 12px.
  const cols = chars.length === 1 ? 3 : 1;
  const size = Math.max(80, Math.min(128, Math.floor((avail - cols * 12 - (cols - 1) * 12 - cols * (chars.length - 1) * 6) / (cols * chars.length))));
  const rows = [];
  const changed = () => onChange?.(rows.filter((r) => r.pads.every((p) => !p.isEmpty())).length);
  for (let k = 0; k < reps; k++) {
    const pads = chars.map((ch) => charPad(ch, { size, onInk: changed }));
    if (k < guided) pads.forEach((p) => p.setGuide(true));
    const el = h('div', { class: ['ws-cell', k < guided ? 'guided' : ''] },
      h('span', { class: 'ws-n' }, String(k + 1)),
      h('div', { class: 'ws-pads' }, pads.map((p) => p.el)));
    rows.push({ pads, el });
  }
  const scoreOf = (r) => (r.pads.some((p) => p.isEmpty()) ? 0 : Math.min(...r.pads.map((p) => p.score())));
  const tools = h('div', { class: 'hw-tools' },
    h('button', { class: 'chip opt', type: 'button', onclick: () => { const r = [...rows].reverse().find((x) => x.pads.some((p) => !p.isEmpty())); r?.pads.forEach((p) => p.undo()); } }, icon('back'), 'Hoàn tác'),
    h('button', { class: 'chip opt', type: 'button', onclick: () => rows.forEach((r) => r.pads.forEach((p) => p.clear())) }, icon('trash'), 'Xóa hết'));
  return {
    el: h('div', { class: 'ws-area' }, h('div', { class: ['ws-grid', chars.length > 1 ? 'multi' : ''] }, rows.map((r) => r.el)), tools),
    filled: () => rows.filter((r) => r.pads.every((p) => !p.isEmpty())).length,
    scores: () => rows.map(scoreOf),
    score() { const s = rows.map(scoreOf); return s.reduce((a, b) => a + b, 0) / (s.length || 1); },
    showAnswer() {
      rows.forEach((r) => { const ok = scoreOf(r) >= PASS_INK; r.pads.forEach((p) => p.showAnswer(ok)); r.el.classList.add(ok ? 'ok' : 'no'); });
      tools.remove();
    },
  };
}
