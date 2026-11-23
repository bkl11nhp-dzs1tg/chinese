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
  if (!enabled) return;
  if (kind === 'good') { tone([660, 880]); navigator.vibrate?.(15); }
  else if (kind === 'bad') { tone([220, 180], 0.14, 0.1); navigator.vibrate?.([30, 40, 30]); }
  else if (kind === 'done') { tone([523, 659, 784, 1046], 0.12, 0.09); navigator.vibrate?.(40); }
  else if (kind === 'tap') navigator.vibrate?.(5);
}
