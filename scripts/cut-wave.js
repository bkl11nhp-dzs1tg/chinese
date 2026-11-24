// Sóng đáy trang: art/illustrations/wave2.png (nền ô caro trắng/xám giả) → public/art/deco/wave.webp trong suốt.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = process.argv[2] || 'art/illustrations/wave2.png';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const url = await page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h); const p = d.data;
  // Nền caro: điểm xám trung tính rất sáng (R≈G≈B, ≥ 225). Sóng tím/vàng/trắng hồng có độ bão hòa.
  for (let k = 0; k < p.length; k += 4) {
    const r = p[k], gg = p[k + 1], b = p[k + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const sat = mx - mn;
    const light = (r + gg + b) / 3;
    // độ "là nền": sáng và gần xám
    const bgness = Math.min(1, Math.max(0, (light - 215) / 25)) * Math.min(1, Math.max(0, (14 - sat) / 10));
    p[k + 3] = Math.round((1 - bgness) * 255);
  }
  g.putImageData(d, 0, 0);
  // Cắt sát phần có hình.
  let y0 = h, y1 = 0, x0 = w, x1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[(y * w + x) * 4 + 3] > 60) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o.toDataURL('image/webp', 0.88);
}, `data:image/png;base64,${readFileSync(SRC).toString('base64')}`);
await browser.close();
writeFileSync('public/art/deco/wave.webp', Buffer.from(url.split(',')[1], 'base64'));
console.log('ok');
