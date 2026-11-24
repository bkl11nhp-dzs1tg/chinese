// Xóa nền sáng của ảnh cành đào (art/illustrations/branch2.png) → public/art/deco/branch.webp.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = process.argv[2] || 'art/illustrations/branch2.png';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const url = await page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h); const p = d.data;
  // Nền: trung bình viền ngoài.
  let B = [0, 0, 0], n = 0;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const k = (y * w + x) * 4; B[0] += p[k]; B[1] += p[k + 1]; B[2] += p[k + 2]; n++; }
  B = B.map((v) => v / n);
  // Độ khác nền (cả màu hồng nhạt lẫn nâu) → độ đục, giữ mép mềm.
  for (let k = 0; k < p.length; k += 4) {
    const dist = Math.hypot(p[k] - B[0], p[k + 1] - B[1], p[k + 2] - B[2]);
    const t = Math.min(1, Math.max(0, (dist - 8) / 30));
    p[k + 3] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  g.putImageData(d, 0, 0);
  return c.toDataURL('image/webp', 0.92);
}, `data:image/png;base64,${readFileSync(SRC).toString('base64')}`);
await browser.close();
writeFileSync('public/art/deco/branch.webp', Buffer.from(url.split(',')[1], 'base64'));
console.log('ok');
