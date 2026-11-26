// Khung "Cấu tạo chữ": mỗi chữ → kiểu cấu tạo (hình thanh/hội ý/tượng hình), bố cục, các thành phần (bộ thủ, phần chỉ nghĩa, phần gợi âm), gợi ý nhớ.
// Dữ liệu content/decomp.json (Make Me a Hanzi, LGPL) – tải một lần khi cần.

import { h } from './dom.js';
import { describeChar } from '../core/decomp.js';

let dataP = null;
export function loadDecomp() {
  if (!dataP) dataP = fetch('./content/decomp.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return dataP;
}

export function charAnatomy(word) {
  const wrap = h('div', { class: 'anatomy' });
  loadDecomp().then((data) => {
    const items = [...word].map((ch) => describeChar(ch, data)).filter(Boolean);
    if (!items.length) { wrap.remove(); return; }
    wrap.replaceChildren(...items.map((d) => h('div', { class: 'an-char' },
      h('div', { class: 'an-head' },
        h('span', { class: 'an-big han', lang: 'zh-CN' }, d.ch),
        h('div', { class: 'an-meta' },
          h('b', {}, d.meaning || d.pinyin),
          h('div', { class: 'an-tags' }, d.type ? h('span', { class: 'an-tag' }, d.type) : null, d.struct ? h('span', { class: 'an-tag soft' }, d.struct) : null))),
      d.parts.length ? h('div', { class: 'an-parts' }, d.parts.map((p, k) => [
        k ? h('span', { class: 'an-plus' }, '+') : null,
        h('span', { class: ['an-part', p.isRadical ? 'rad' : '', p.role ? `role-${p.role === 'nghĩa' ? 'm' : 's'}` : ''] },
          h('span', { class: 'han', lang: 'zh-CN' }, p.ch),
          p.name ? h('small', {}, p.name) : null,
          p.role ? h('em', {}, p.role === 'nghĩa' ? 'chỉ nghĩa' : 'gợi âm') : p.isRadical ? h('em', {}, 'bộ thủ') : null)])) : d.radical ? h('div', { class: 'an-parts' }, h('span', { class: 'an-part rad' }, h('span', { class: 'han' }, d.radical.ch), h('small', {}, d.radical.name), h('em', {}, 'bộ thủ'))) : null,
      d.hint ? h('p', { class: 'an-hint' }, d.hint) : null)));
  });
  return wrap;
}
