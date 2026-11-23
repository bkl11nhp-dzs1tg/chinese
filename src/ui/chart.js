// Biểu đồ đơn giản bằng SVG: cột dọc một chuỗi (thời gian theo ngày) và thanh ngang (số thẻ).
// Một màu cho một chuỗi, nhãn số trực tiếp, tooltip khi rê chuột/chạm, kèm bảng số liệu cho trình đọc màn hình.

import { h } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
};

let tipEl;
function showTip(text, x, y) {
  if (!tipEl) { tipEl = h('div', { class: 'chart-tip', role: 'presentation' }); document.body.append(tipEl); }
  tipEl.textContent = text;
  tipEl.style.display = 'block';
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
  tipEl.style.top = `${Math.max(8, y - r.height - 10)}px`;
}
function hideTip() { if (tipEl) tipEl.style.display = 'none'; }

/** Bước trục đẹp: 1, 2, 5 × 10^n. */
function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * data: [{ label, value, tip }]. valueFmt: định dạng nhãn số.
 * Chỉ ghi nhãn số trên cột lớn nhất và cột cuối (nhãn chọn lọc), còn lại xem bằng tooltip/bảng.
 */
export function columnChart(data, { height = 180, valueFmt = String, caption = '', unit = '' } = {}) {
  const W = 640, H = height, padL = 32, padR = 8, padT = 22, padB = 24;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const iw = W - padL - padR, ih = H - padT - padB;
  const step = iw / data.length;
  const bw = Math.max(4, Math.min(28, step - 2)); // ≥2px khoảng hở giữa các cột
  const y = (v) => padT + ih - (v / max) * ih;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': caption });
  for (const t of [0, max / 2, max]) {
    svg.append(s('line', { class: 'gridline', x1: padL, x2: W - padR, y1: y(t), y2: y(t) }));
    svg.append(s('text', { class: 'axis-label', x: padL - 6, y: y(t) + 4, 'text-anchor': 'end' }, valueFmt(t)));
  }
  const maxIdx = data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0);
  data.forEach((d, i) => {
    const cx = padL + step * i + step / 2;
    const g = s('g');
    if (d.value > 0) {
      const top = y(d.value), hgt = padT + ih - top, r = Math.min(4, hgt, bw / 2);
      // Đầu cột bo 4px, chân cột vuông, bám vào đường đáy.
      const x0 = cx - bw / 2, x1 = cx + bw / 2, base = padT + ih;
      g.append(s('path', { class: 'barmark', d: `M${x0} ${base}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x1 - r}Q${x1} ${top} ${x1} ${top + r}V${base}Z` }));
      if ((i === maxIdx || i === data.length - 1) && d.value > 0) {
        g.append(s('text', { class: 'value-label', x: cx, y: top - 6, 'text-anchor': 'middle' }, valueFmt(d.value)));
      }
    }
    if (data.length <= 14 || i % 2 === data.length % 2) {
      g.append(s('text', { class: 'axis-label', x: cx, y: H - 6, 'text-anchor': 'middle' }, d.label));
    }
    const hit = s('rect', { class: 'hit', x: padL + step * i, y: padT, width: step, height: ih });
    const tip = d.tip || `${d.label}: ${valueFmt(d.value)}${unit}`;
    hit.addEventListener('pointerenter', (e) => showTip(tip, e.clientX, e.clientY));
    hit.addEventListener('pointermove', (e) => showTip(tip, e.clientX, e.clientY));
    hit.addEventListener('pointerleave', hideTip);
    g.prepend(hit);
    svg.append(g);
  });
  svg.append(s('line', { x1: padL, x2: W - padR, y1: padT + ih, y2: padT + ih, stroke: 'currentColor', 'stroke-width': 1, opacity: 0.5 }));

  const table = h('details', {},
    h('summary', {}, 'Xem bảng số liệu'),
    h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Ngày'), h('th', { class: 'num' }, caption))),
      h('tbody', {}, data.map((d) => h('tr', {}, h('td', {}, d.tip?.split(':')[0] || d.label), h('td', { class: 'num' }, `${valueFmt(d.value)}${unit}`))))));
  return h('figure', { style: { margin: 0 } }, svg, table);
}

/** Thanh ngang có nhãn + số: [{ label, value }]. */
export function hbars(rows, { total } = {}) {
  const max = total ?? Math.max(1, ...rows.map((r) => r.value));
  return h('div', { role: 'list' }, rows.map((r) =>
    h('div', { class: 'hbar', role: 'listitem' },
      h('span', {}, r.label),
      h('div', { class: 'track', 'aria-hidden': 'true' }, h('div', { class: 'fill', style: { width: `${(r.value / max) * 100}%` } })),
      h('span', { class: 'num' }, r.display ?? r.value))));
}
