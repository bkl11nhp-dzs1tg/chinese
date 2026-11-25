// Bàn phím tiếng Trung nổi: khi đang gõ vào một ô chữ, hiện nút "中" ở góc; bấm → bảng gõ pinyin, chọn chữ chèn vào ô.
// Từ điển dựng từ từ vựng + chữ trong bài khóa/bài đọc (core/ime.js), chạy offline.

import { h } from './dom.js';
import { icon } from './icons.js';
import { buildIme } from '../core/ime.js';

const PUNCT = ['，', '。', '？', '！', '、', '：', '“', '”'];
let imePromise = null;

async function loadIme(ctx) {
  if (imePromise) return imePromise;
  imePromise = (async () => {
    const data = await ctx.loadAll();
    const entries = data.cards.map((c) => ({ hanzi: c.hanzi, pinyin: c.pinyin, weight: c.lesson_id ? 3 : 1 }));
    // Chữ lẻ: mọi chữ trong từ vựng, bài khóa, bài đọc → pinyin theo pinyin-pro.
    const chars = new Map();
    const add = (t, w = 1) => { for (const ch of String(t || '')) if (/[㐀-鿿]/.test(ch)) chars.set(ch, (chars.get(ch) || 0) + w); };
    data.cards.forEach((c) => add(c.hanzi, 2));
    data.lessons.forEach((l) => (l.texts || []).forEach((t) => t.lines.forEach((ln) => add(ln.zh))));
    (await ctx.repo.getAll('readings')).forEach((r) => r.paragraphs?.forEach((p) => p.sentences.forEach((s) => add(s.hanzi))));
    try {
      const { wordPinyin } = await import('../core/pinyin-text.js');
      for (const [ch, n] of chars) entries.push({ hanzi: ch, pinyin: wordPinyin(ch), weight: Math.min(4, Math.log2(n + 1)) });
    } catch { /* thiếu pinyin-pro: chỉ dùng từ vựng */ }
    return buildIme(entries);
  })();
  return imePromise;
}

const editable = (el) => el && ((el.tagName === 'TEXTAREA') || (el.tagName === 'INPUT' && ['text', 'search', ''].includes(el.type))) && !el.readOnly && !el.disabled && !el.closest('.zhk');

export function initZhKeyboard(ctx) {
  let target = null;
  let sel = [0, 0];
  const fab = h('button', { class: 'zhk-fab hidden', type: 'button', 'aria-label': 'Bàn phím tiếng Trung', title: 'Bàn phím tiếng Trung' }, h('span', { class: 'han' }, '中'));
  const pyIn = h('input', { class: 'zhk-py', type: 'text', placeholder: 'pinyin', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': 'Pinyin' });
  const cands = h('div', { class: 'zhk-cands', role: 'listbox', 'aria-label': 'Chữ gợi ý' });
  const panel = h('div', { class: 'zhk hidden', role: 'dialog', 'aria-label': 'Bàn phím tiếng Trung' },
    h('div', { class: 'zhk-top' },
      pyIn,
      h('button', { class: 'zhk-key', type: 'button', 'aria-label': 'Xóa chữ', onclick: () => backspace() }, '⌫'),
      h('button', { class: 'zhk-key', type: 'button', 'aria-label': 'Đóng', onclick: () => close() }, icon('close'))),
    cands,
    h('div', { class: 'zhk-punct' }, PUNCT.map((p) => h('button', { class: 'zhk-key han', type: 'button', onclick: () => insert(p) }, p))));
  document.body.append(fab, panel);

  const remember = () => { if (target) sel = [target.selectionStart ?? target.value.length, target.selectionEnd ?? target.value.length]; };
  function insert(text) {
    if (!target) return;
    const v = target.value;
    const [a, b] = sel;
    target.value = v.slice(0, a) + text + v.slice(b);
    sel = [a + text.length, a + text.length];
    target.dispatchEvent(new Event('input', { bubbles: true }));
    try { target.setSelectionRange(sel[0], sel[1]); } catch { /* bỏ qua */ }
  }
  function backspace() {
    if (pyIn.value) { pyIn.value = pyIn.value.slice(0, -1); paint(); return; }
    if (!target) return;
    const [a, b] = sel;
    const v = target.value;
    const last = [...v.slice(0, a)].pop() || '';
    const from = a === b ? a - last.length : a;
    target.value = v.slice(0, from) + v.slice(b);
    sel = [from, from];
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
  let list = [];
  async function paint() {
    const ime = await loadIme(ctx);
    list = pyIn.value.trim() ? ime.lookup(pyIn.value, 30) : [];
    cands.replaceChildren(...(list.length
      ? list.map((w, k) => h('button', { class: 'zhk-cand han', type: 'button', role: 'option', onclick: () => pick(w) }, k < 9 ? h('small', {}, String(k + 1)) : null, w))
      : [h('span', { class: 'zhk-empty' }, pyIn.value.trim() ? '—' : '')]));
  }
  function pick(w) { insert(w); pyIn.value = ''; paint(); pyIn.focus(); }
  pyIn.addEventListener('input', paint);
  pyIn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && list.length) { e.preventDefault(); pick(list[0]); }
    else if (e.key === 'Backspace' && !pyIn.value) { e.preventDefault(); backspace(); }
    else if (e.key === 'Escape') close();
  });

  function open() { remember(); panel.classList.remove('hidden'); fab.classList.add('hidden'); pyIn.value = ''; paint(); pyIn.focus(); }
  function close() { panel.classList.add('hidden'); if (target) { target.focus(); try { target.setSelectionRange(sel[0], sel[1]); } catch { /* bỏ qua */ } } }
  fab.addEventListener('pointerdown', (e) => e.preventDefault()); // giữ con trỏ ở ô đang gõ
  fab.addEventListener('click', open);

  document.addEventListener('focusin', (e) => {
    if (editable(e.target)) { target = e.target; remember(); if (panel.classList.contains('hidden')) fab.classList.remove('hidden'); }
  });
  document.addEventListener('focusout', (e) => {
    if (!editable(e.target)) return;
    remember();
    setTimeout(() => { if (!editable(document.activeElement) && !panel.contains(document.activeElement)) fab.classList.add('hidden'); }, 150);
  });
  for (const ev of ['keyup', 'click', 'select']) document.addEventListener(ev, (e) => { if (e.target === target) remember(); });
  window.addEventListener('hashchange', () => { panel.classList.add('hidden'); fab.classList.add('hidden'); target = null; });
}
