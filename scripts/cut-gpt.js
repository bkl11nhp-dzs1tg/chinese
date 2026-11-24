// Cắt tấm minh họa gpt.png (nền trong suốt): hàng đầu 5 hình chung → public/art/{done,pass,retry,empty,sync}.webp,
// 5 hàng × 6 hình bên dưới → public/lessons/L01..L30.webp (thứ tự trái → phải, trên → dưới).
// Chạy: npm run cut-gpt  (mặc định đọc art/illustrations/gpt.png)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'art/illustrations/gpt.png';
const GENERAL = ['done', 'pass', 'retry', 'empty', 'sync'];
mkdirSync('public/art', { recursive: true });
mkdirSync('public/lessons', { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const result = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, H).data;
  const solid = (x, y) => px[(y * W + x) * 4 + 3] > 40;
  const rowFill = (y, x0, x1) => { let n = 0; for (let x = x0; x < x1; x++) n += solid(x, y); return n / (x1 - x0); };
  const colFill = (x, y0, y1) => { let n = 0; for (let y = y0; y < y1; y++) n += solid(x, y); return n / (y1 - y0); };
  const runs = (len, fill, thr, minLen) => {
    const out = [];
    let i = 0;
    while (i < len) {
      while (i < len && fill(i) <= thr) i++;
      const s = i;
      while (i < len && fill(i) > thr) i++;
      if (i - s >= minLen) out.push([s, i]);
    }
    return out;
  };
  const bands = runs(H, (y) => rowFill(y, 0, W), 0.03, 60);
  const cells = bands.map(([y0, y1]) => runs(W, (x) => colFill(x, y0, y1), 0.02, 60).map(([x0, x1]) => {
    // Khung bao sát phần có màu trong ô.
    let a = y1, b = y0;
    for (let y = y0; y < y1; y++) if (rowFill(y, x0, x1) > 0.01) { a = Math.min(a, y); b = Math.max(b, y + 1); }
    return { x: x0, y: a, w: x1 - x0, h: b - a };
  }));
  const crop = (r, inset) => {
    const o = document.createElement('canvas');
    o.width = r.w - inset * 2; o.height = r.h - inset * 2;
    o.getContext('2d').drawImage(c, r.x + inset, r.y + inset, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/webp', 0.92);
  };
  return {
    layout: cells.map((row) => row.map((r) => `${r.w}x${r.h}`)),
    general: (cells[0] || []).map((r) => crop(r, 0)),
    lessons: cells.slice(1).flat().map((r) => crop(r, 3)),
  };
}, `data:image/png;base64,${readFileSync(SRC).toString('base64')}`);
await browser.close();

console.log('Lưới:', JSON.stringify(result.layout));
const save = (file, url) => writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
if (result.general.length === GENERAL.length) GENERAL.forEach((n, i) => save(`public/art/${n}.webp`, result.general[i]));
else console.log(`Hàng đầu có ${result.general.length} hình (cần 5) → không ghi hình chung.`);
// Ảnh bài học chỉ ghi khi chạy với --lessons (mặc định giữ ảnh bài học hiện có).
if (!process.argv.includes('--lessons')) console.log('Giữ nguyên ảnh bài học (thêm --lessons để thay).');
else if (result.lessons.length === 30) result.lessons.forEach((u, i) => save(`public/lessons/L${String(i + 1).padStart(2, '0')}.webp`, u));
else console.log(`Có ${result.lessons.length} hình bài học (cần 30) → không ghi.`);
