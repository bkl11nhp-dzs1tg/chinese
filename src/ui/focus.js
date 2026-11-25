// Khung học toàn màn hình (buổi học, bài tập, kiểm tra, trò chơi):
// trên cùng là nút ✕ + thanh tiến độ; nội dung ở giữa; nút hành động dính ở đáy (dễ bấm bằng ngón cái);
// phản hồi đúng/sai trượt lên từ dưới.

import { h } from './dom.js';
import { icon } from './icons.js';
import { cue } from './feedback.js';

export function focusShell({ onClose, closeLabel = 'Thoát' } = {}) {
  document.body.classList.add('focus-mode');
  const progress = h('span', { style: { width: '0%' } });
  const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Tiến độ', 'aria-valuemin': 0, 'aria-valuemax': 100 }, progress);
  const count = h('span', { class: 'count' });
  const main = h('div', { class: 'focus-main' });
  const footer = h('div', { class: 'focus-footer' });
  const sheetInner = h('div', { class: 'inner' });
  const sheet = h('div', { class: 'sheet', role: 'status', 'aria-live': 'assertive' }, sheetInner);
  const el = h('div', { class: 'focus' },
    h('div', { class: 'focus-top' },
      h('button', { class: 'focus-close', type: 'button', 'aria-label': closeLabel, onclick: () => onClose?.() }, icon('close')),
      bar, count),
    main, footer, sheet);

  let sheetKey = null;
  function onSheetKey(e) { if (e.key === 'Enter' && sheet.classList.contains('open')) { e.preventDefault(); sheetKey?.(); } }
  window.addEventListener('keydown', onSheetKey);

  return {
    el, main, footer,
    setProgress(frac, label = '') {
      // Luôn hiện một đoạn ngắn ở câu đầu để thấy rõ là thanh tiến độ.
      const pct = frac > 0 || label ? Math.max(5, Math.min(1, frac) * 100) : 0;
      progress.style.width = `${pct}%`;
      bar.setAttribute('aria-valuenow', Math.round(pct));
      // Nhãn nhiều dòng (vd "8/12" + "Câu 1/5"): dòng đầu đậm, các dòng sau nhỏ.
      const [first, ...rest] = String(label).split('\n');
      count.replaceChildren(first, ...rest.map((r) => h('small', {}, r)));
    },
    setFooter(...nodes) { footer.replaceChildren(...nodes.filter(Boolean)); },
    /** Hiện khung phản hồi. ok: true/false/null (null = trung tính). */
    showSheet({ ok, title, detail, button = 'Tiếp tục', onContinue }) {
      if (ok === true || ok === false) cue(ok ? 'good' : 'bad');
      sheet.className = `sheet open ${ok === true ? 'ok' : ok === false ? 'no' : ''}`;
      const btn = h('button', { class: ['btn', 'big', 'block', ok === false ? 'bad' : ok === true ? 'good' : 'primary'], type: 'button' }, button);
      const go = () => { this.hideSheet(); onContinue?.(); };
      btn.onclick = go;
      sheetKey = go;
      sheetInner.replaceChildren(
        h('h3', {}, ok === true ? icon('checkCircle') : ok === false ? icon('xCircle') : null, title),
        detail ? h('div', { class: 'detail' }, detail) : null,
        btn);
      setTimeout(() => btn.focus({ preventScroll: true }), 50);
    },
    hideSheet() { sheet.classList.remove('open'); sheetKey = null; },
    destroy() {
      window.removeEventListener('keydown', onSheetKey);
      document.body.classList.remove('focus-mode');
    },
  };
}
