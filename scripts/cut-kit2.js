// Cắt 9 đồ họa từ art/illustrations/kit2.png (nền đã trong suốt nhưng có đốm nhiễu) → public/art/deco/*.webp.
// Làm sạch: bỏ điểm gần trong suốt, rồi chỉ giữ các mảng liền khối đủ lớn (loại đốm lẻ quanh hình), cắt sát viền.
// Chạy: npm run cut-kit
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = process.argv[2] || 'art/illustrations/kit2.png';
// [tên, x, y, w, h]  (theo ảnh 1536×1024)
const CROPS = [
  ['branch', 0, 0, 605, 310],
  ['cloud', 548, 40, 522, 255],
  ['flower', 1080, 0, 456, 325],
  ['mountains', 0, 330, 595, 305],
  ['pavilion', 565, 295, 525, 350],
  ['petals', 1090, 340, 446, 275],
  ['paper', 0, 650, 503, 365],
  ['scene', 505, 650, 528, 365],
  ['wave', 1030, 680, 506, 315],
];
mkdirSync('public/art/deco', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const out = await page.evaluate(async ({ src, crops }) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const res = {};
  for (const [name, x, y, w, h] of crops) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, x, y, w, h, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    const p = d.data;
    const N = w * h;
    const solid = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const a = p[i * 4 + 3];
      if (a < 70) p[i * 4 + 3] = 0; else solid[i] = 1;
    }
    // Mảng liền khối (4 hướng): giữ mảng ≥ 1.2% mảng lớn nhất và ≥ 60 điểm.
    const lab = new Int32Array(N).fill(-1);
    const sizes = [];
    const stack = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      if (!solid[i] || lab[i] >= 0) continue;
      const id = sizes.length;
      let sp = 0, n = 0;
      stack[sp++] = i; lab[i] = id;
      while (sp) {
        const k = stack[--sp]; n++;
        const kx = k % w, ky = (k / w) | 0;
        const nb = [kx > 0 ? k - 1 : -1, kx < w - 1 ? k + 1 : -1, ky > 0 ? k - w : -1, ky < h - 1 ? k + w : -1];
        for (const j of nb) if (j >= 0 && solid[j] && lab[j] < 0) { lab[j] = id; stack[sp++] = j; }
      }
      sizes.push(n);
    }
    const big = Math.max(1, ...sizes);
    const keep = sizes.map((s) => s >= Math.max(60, big * 0.012));
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < N; i++) {
      if (lab[i] >= 0 && keep[lab[i]]) {
        const px = i % w, py = (i / w) | 0;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      } else p[i * 4 + 3] = 0;
    }
    g.putImageData(d, 0, 0);
    // Cắt sát viền (chừa 2px), mép mềm hơn bằng một lượt làm mờ alpha rất nhẹ khi vẽ lại.
    const pad = 2;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const o = document.createElement('canvas');
    o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    res[name] = { url: o.toDataURL('image/webp', 0.9), size: `${o.width}x${o.height}` };
  }
  return res;
}, { src: `data:image/png;base64,${readFileSync(SRC).toString('base64')}`, crops: CROPS });
await browser.close();
for (const [name, { url, size }] of Object.entries(out)) {
  writeFileSync(`public/art/deco/${name}.webp`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(name, size);
}
