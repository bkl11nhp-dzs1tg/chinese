// Màn kết quả dùng chung: vòng điểm, số câu đúng, thời gian.

import { h } from '../../ui/dom.js';
import { formatDuration } from '../../core/stats.js';

export function scoreRing(score, { size = 148, stroke = 14, passed = null } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('class', 'ring');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Điểm ${Math.round(score * 100)}%`);
  const color = passed === false ? 'var(--bad)' : passed === true ? 'var(--good)' : 'var(--accent)';
  svg.innerHTML = `
    <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
    <circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" style="stroke:${color}"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" style="font:900 34px var(--font);fill:var(--ink)">${Math.round(score * 100)}%</text>`;
  return svg;
}

export function resultView({ title, score, correct, total, activeMs, note, passed = null, emoji }) {
  return h('div', { class: 'result' },
    emoji || null,
    h('h1', {}, title),
    h('div', { style: { margin: '20px 0' } }, scoreRing(score, { passed })),
    h('div', { class: 'grid', style: { maxWidth: '360px', margin: '0 auto' } },
      h('div', { class: 'tile px-box' }, h('div', { class: 'value' }, `${correct}/${total}`), h('div', { class: 'label' }, 'câu đúng')),
      h('div', { class: 'tile px-box' }, h('div', { class: 'value' }, activeMs != null ? formatDuration(activeMs) : '—'), h('div', { class: 'label' }, 'thời gian'))),
    note ? h('p', { class: 'muted', style: { marginTop: '20px' } }, note) : null);
}
