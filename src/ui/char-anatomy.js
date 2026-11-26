// Khung "Cấu tạo chữ": mỗi chữ → âm Hán Việt, kiểu cấu tạo (hình thanh/hội ý/tượng hình), bố cục, các thành phần
// (bộ thủ, phần chỉ nghĩa, phần gợi âm), gợi ý nhớ. Từ nhiều chữ có thêm dòng ghép nghĩa: 健 kiện + 康 khang → sức khỏe.
// Dữ liệu content/decomp.json (Make Me a Hanzi, LGPL; âm Hán Việt theo Thiều Chửu qua hanviet-pinyin-wordlist, MIT) – tải một lần khi cần.

import { h } from './dom.js';
import { describeChar, splitSyllables } from '../core/decomp.js';

let dataP = null;
export function loadDecomp() {
  if (!dataP) dataP = fetch('./content/decomp.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return dataP;
}

const HAN = /[㐀-鿿]/;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const short = (m) => String(m || '').split(',')[0].trim();

/** word: chữ/từ; pinyin, meaning (của cả từ) để chọn đúng âm đọc và dựng dòng ghép nghĩa. */
export function charAnatomy(word, { pinyin = '', meaning = '' } = {}) {
  const wrap = h('div', { class: 'anatomy' });
  loadDecomp().then((data) => {
    const chars = [...word].filter((c) => HAN.test(c));
    const syl = splitSyllables(pinyin, chars, data);
    const items = chars.map((ch, i) => describeChar(ch, data, syl[i] || '')).filter(Boolean);
    if (!items.length) { wrap.remove(); return; }

    // Ghép nghĩa cho từ nhiều chữ
    const hvWord = items.every((d) => d.hv) ? cap(items.map((d) => d.hv).join(' ')) : '';
    const sameAsVi = hvWord && meaning && hvWord.toLowerCase() === String(meaning).trim().toLowerCase();
    const sum = chars.length >= 2 && items.length === chars.length ? h('div', { class: 'an-sum' },
      h('div', { class: 'as-row' }, items.map((d, k) => [
        k ? h('span', { class: 'as-plus' }, '+') : null,
        h('span', { class: 'as-chip' },
          h('span', { class: 'han', lang: 'zh-CN' }, d.ch),
          d.hv ? h('b', {}, d.hv) : null,
          short(d.meaning) ? h('small', {}, short(d.meaning)) : null)])),
      h('div', { class: 'as-out' },
        hvWord ? h('span', { class: 'as-hv' }, hvWord) : null,
        hvWord && meaning && !sameAsVi ? h('span', { class: 'as-eq' }, '=') : null,
        meaning && !sameAsVi ? h('span', { class: 'as-vi' }, meaning) : null)) : null;

    wrap.replaceChildren(sum || '', ...items.map((d) => h('div', { class: 'an-char' },
      h('div', { class: 'an-head' },
        h('span', { class: 'an-big han', lang: 'zh-CN' }, d.ch),
        h('div', { class: 'an-meta' },
          d.hv ? h('span', { class: 'an-hv' }, cap(d.hv)) : null,
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
