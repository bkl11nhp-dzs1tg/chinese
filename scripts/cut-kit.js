// Cắt đồ họa trang trí từ bộ "Chinese Learning App UI Asset Kit.png" → public/art/deco/*.webp, xóa nền sáng
// (chuyển màu nền → trong suốt, giữ viền mềm). Chữ và icon trong bộ kit được bỏ qua.
// Chạy: node scripts/cut-kit.js [đường dẫn ảnh]   (mặc định art/illustrations/kit.png)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = process.argv[2] || 'art/illustrations/kit.png';
// [tên, x, y, w, h, xóa nền?]
const CROPS = [
  ['branch', 522, 788, 266, 104, true],
  ['flower', 533, 932, 70, 62, true],
  ['petals', 640, 898, 160, 165, true],
  ['mountains', 806, 788, 228, 92, true],
  ['clouds', 804, 932, 214, 68, true],
  ['pagoda', 1024, 784, 174, 198, true],
  ['wave', 734, 1088, 452, 80, true],
  ['scene', 16, 50, 325, 541, false],
  ['scene-plain', 352, 50, 208, 541, false],
];
mkdirSync('public/art/deco', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const out = await page.evaluate(async ({ src, crops }) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const res = {};
  for (const [name, x, y, w, h, clear] of crops) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, x, y, w, h, 0, 0, w, h);
    if (clear) {
      const d = g.getImageData(0, 0, w, h);
      const p = d.data;
      // Màu nền: trung bình viền ngoài cùng.
      let br = 0, bg = 0, bb = 0, n = 0;
      for (let i = 0; i < w; i++) for (const j of [0, h - 1]) { const k = (j * w + i) * 4; br += p[k]; bg += p[k + 1]; bb += p[k + 2]; n++; }
      for (let j = 0; j < h; j++) for (const i of [0, w - 1]) { const k = (j * w + i) * 4; br += p[k]; bg += p[k + 1]; bb += p[k + 2]; n++; }
      const B = [br / n, bg / n, bb / n];
      // Mặt nạ mềm theo độ "tối hơn nền" (bỏ nhiễu sáng của ảnh nén), giữ nguyên màu gốc.
      const lo = 10, hi = 34;
      const alpha = new Float32Array(w * h);
      for (let i = 0, k = 0; k < p.length; k += 4, i++) {
        let d = 0;
        for (let ch = 0; ch < 3; ch++) d = Math.max(d, B[ch] - p[k + ch]);
        const t = Math.min(1, Math.max(0, (d - lo) / (hi - lo)));
        alpha[i] = t * t * (3 - 2 * t);
      }
      // Làm mịn mặt nạ 3×3 để mép không lởm chởm.
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) { sum += alpha[yy * w + xx]; n++; }
        }
        p[(y * w + x) * 4 + 3] = Math.round((sum / n) * 255);
      }
      g.putImageData(d, 0, 0);
    }
    res[name] = c.toDataURL('image/webp', 0.9);
  }
  return res;
}, { src: `data:image/png;base64,${readFileSync(SRC).toString('base64')}`, crops: CROPS });
await browser.close();
for (const [name, url] of Object.entries(out)) writeFileSync(`public/art/deco/${name}.webp`, Buffer.from(url.split(',')[1], 'base64'));
console.log('Đã cắt:', Object.keys(out).join(', '));
