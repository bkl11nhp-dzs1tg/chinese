// Thứ tự nét chữ Hán: dữ liệu nét từ hanzi-writer-data (Arphic Public License, tải từ jsDelivr khi cần, lưu Cache).
// Vẽ bằng SVG: mỗi nét là một hình, lộ dần theo đường tâm (median) → thấy rõ thứ tự và hướng viết. Nét thuộc bộ thủ tô màu riêng.

import { h } from './dom.js';
import { icon } from './icons.js';

const CDN = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/';
const mem = new Map();

/** { strokes: [path], medians: [[[x,y]…]], radStrokes?: [index] } hoặc null (offline / không có dữ liệu). */
export async function loadStrokes(ch) {
  if (mem.has(ch)) return mem.get(ch);
  const p = (async () => {
    const url = `${CDN}${encodeURIComponent(ch)}.json`;
    try {
      const cache = await globalThis.caches?.open('chinese-strokes');
      let res = await cache?.match(url);
      if (!res) {
        res = await fetch(url);
        if (!res.ok) return null;
        await cache?.put(url, res.clone());
      }
      return await res.json();
    } catch { return null; }
  })();
  mem.set(ch, p);
  return p;
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const polyLen = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
let uid = 0;

/** Vẽ một chữ. Trả về { svg, play(speed), showAll(), hideAll(), count, radical } */
export function strokeChar(data, { outline = true } = {}) {
  const id = `sk${++uid}`;
  const svg = el('svg', { viewBox: '0 0 1024 1024', class: 'stroke-svg', 'aria-hidden': 'true' });
  // Lưới chữ Mễ
  const grid = el('g', { class: 'sk-grid' });
  for (const [x1, y1, x2, y2] of [[0, 512, 1024, 512], [512, 0, 512, 1024], [0, 0, 1024, 1024], [1024, 0, 0, 1024]]) grid.append(el('line', { x1, y1, x2, y2 }));
  svg.append(grid);
  const g = el('g', { transform: 'matrix(1 0 0 -1 0 900)' });
  const defs = el('defs');
  svg.append(defs, g);
  const rad = new Set(data.radStrokes || []);
  const parts = data.strokes.map((d, i) => {
    if (outline) g.append(el('path', { d, class: 'sk-outline' }));
    const clip = el('clipPath', { id: `${id}-${i}` });
    clip.append(el('path', { d }));
    defs.append(clip);
    const m = data.medians[i];
    const len = polyLen(m) + 140;
    const line = el('polyline', {
      points: m.map((p) => p.join(',')).join(' '), class: ['sk-ink', rad.has(i) ? 'rad' : ''].join(' '),
      'clip-path': `url(#${id}-${i})`, 'stroke-dasharray': `${len} ${len}`, 'stroke-dashoffset': String(len),
    });
    g.append(line);
    return { line, len };
  });
  let run = 0;
  const set = (p, v, dur = 0) => { p.line.style.transition = dur ? `stroke-dashoffset ${dur}ms linear` : 'none'; p.line.style.strokeDashoffset = String(v); };
  return {
    svg,
    count: parts.length,
    radical: rad.size,
    hideAll() { run++; parts.forEach((p) => set(p, p.len)); },
    showAll() { run++; parts.forEach((p) => set(p, 0)); },
    async play(speed = 1) {
      const me = ++run;
      parts.forEach((p) => set(p, p.len));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const p of parts) {
        if (me !== run) return;
        const dur = Math.max(260, (p.len / 1.6) / speed);
        set(p, 0, dur);
        await new Promise((r) => setTimeout(r, dur + 140 / speed));
      }
    },
  };
}

/** Khung xem thứ tự nét cho cả từ: mỗi chữ một ô, nút phát lại, số nét, nét bộ thủ tô màu. */
export function strokeViewer(word, { size = 150, autoplay = true } = {}) {
  const chars = [...word].filter((c) => /[㐀-鿿]/.test(c));
  const boxes = chars.map((ch) => h('div', { class: 'sk-box', style: { width: `${size}px`, height: `${size}px` } }, h('span', { class: 'sk-loading han' }, ch)));
  const info = h('div', { class: 'sk-info' });
  const items = [];
  const replay = h('button', { class: 'btn tinted', type: 'button', onclick: () => playAll() }, icon('play'), 'Xem thứ tự nét');
  async function playAll() { for (const it of items) await it.play(); }
  const wrap = h('div', { class: 'sk-viewer' }, h('div', { class: 'sk-row' }, boxes), info, replay);
  Promise.all(chars.map(loadStrokes)).then((datas) => {
    const notes = [];
    datas.forEach((d, k) => {
      if (!d) return;
      const it = strokeChar(d);
      items.push(it);
      boxes[k].replaceChildren(it.svg);
      notes.push(`${chars[k]}: ${it.count} nét`);
    });
    if (!items.length) { replay.remove(); info.textContent = ''; return; }
    info.replaceChildren(h('span', {}, notes.join(' · ')), h('span', { class: 'sk-legend' }, h('i'), 'nét bộ thủ'));
    if (autoplay) playAll(); else items.forEach((i) => i.showAll());
  });
  return wrap;
}
