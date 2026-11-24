// Phản hồi cảm giác: rung nhẹ (Android) và âm báo ngắn tự tổng hợp (không cần file âm thanh).
// Bật/tắt trong Cài đặt (sound_enabled). iOS Safari không hỗ trợ rung: bỏ qua, không lỗi.

let enabled = true;
let ctx = null;

export function setFeedbackEnabled(v) { enabled = v !== false; }

function tone(freqs, dur = 0.09, gap = 0.07) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const start = t0 + i * gap;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(start);
      o.stop(start + dur + 0.02);
    });
  } catch { /* không có Web Audio: bỏ qua */ }
}

export function cue(kind) {
  if (kind === 'done') celebrate();
  if (!enabled) return;
  if (kind === 'good') { tone([660, 880]); navigator.vibrate?.(15); }
  else if (kind === 'bad') { tone([220, 180], 0.14, 0.1); navigator.vibrate?.([30, 40, 30]); }
  else if (kind === 'done') { tone([523, 659, 784, 1046], 0.12, 0.09); navigator.vibrate?.(40); }
  else if (kind === 'tap') navigator.vibrate?.(5);
}

// ---------------------------------------------------------------- hiệu ứng hình (không phụ thuộc âm thanh)
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#e8344f', '#ff7d93', '#f7a8bd', '#ffd1dc', '#ffb347', '#1f8a52'];

/** Mưa giấy màu + cánh hoa anh đào khi hoàn thành. */
export function celebrate(n = 70) {
  if (reduced() || typeof document === 'undefined') return;
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const petal = i % 3 === 0;
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = petal ? '#f7a8bd' : COLORS[i % COLORS.length];
    if (petal) { p.style.width = '13px'; p.style.height = '13px'; p.style.borderRadius = '13px 0'; }
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 220}px`);
    p.style.setProperty('--r', `${(Math.random() * 2 - 1) * 720}deg`);
    p.style.setProperty('--d', `${1.3 + Math.random() * 1.4}s`);
    p.style.animationDelay = `${Math.random() * 0.35}s`;
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3200);
}

/** Chữ lớn bay lên giữa màn hình (combo). */
export function flashText(text) {
  if (reduced() || typeof document === 'undefined') return;
  document.querySelector('.combo-flash')?.remove();
  const el = document.createElement('div');
  el.className = 'combo-flash';
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 850);
}

/** Số liệu nảy nhẹ khi thay đổi. */
export function bump(el) {
  const box = el?.closest?.('.gh-stat') || el;
  if (!box) return;
  box.classList.remove('bump');
  void box.offsetWidth;
  box.classList.add('bump');
}
