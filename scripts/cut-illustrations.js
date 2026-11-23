// Cắt ảnh lưới minh họa (2 cột × 5 hàng, mỗi ảnh 10 tranh) thành public/lessons/LXX.webp.
// Tự dò khe sáng giữa các ô theo từng cột (chiều cao các ô không bằng nhau), bỏ viền trắng/bo góc.
// Chạy: npm run cut-art   (đọc art/illustrations/l1-10.png, l11-20.png, l21-30.png)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.argv[2] || 'art/illustrations';
const OUT = 'public/lessons';
const SHEETS = [['l1-10.png', 1], ['l11-20.png', 11], ['l21-30.png', 21]];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

for (const [file, first] of SHEETS) {
  const path = join(SRC, file);
  if (!existsSync(path)) { console.log(`Bỏ qua (không có): ${path}`); continue; }
  const dataUrl = `data:image/png;base64,${readFileSync(path).toString('base64')}`;
  const crops = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, W, H).data;
    // "Khe" = điểm ảnh gần trắng (khe giữa các ô màu trắng/xám rất nhạt).
    const gap = (x, y) => { const i = (y * W + x) * 4; return px[i] > 238 && px[i + 1] > 238 && px[i + 2] > 238; };
    const colGapRatio = (x, y0, y1) => { let n = 0; for (let y = y0; y < y1; y++) n += gap(x, y); return n / (y1 - y0); };
    const rowGapRatio = (y, x0, x1) => { let n = 0; for (let x = x0; x < x1; x++) n += gap(x, y); return n / (x1 - x0); };
    // Khe dọc giữa hai cột: tìm quanh giữa ảnh.
    let best = -1, bx = Math.round(W / 2);
    for (let x = Math.round(W * 0.4); x < W * 0.6; x++) { const r = colGapRatio(x, 0, H); if (r > best) { best = r; bx = x; } }
    let l = bx, r = bx;
    while (l > 0 && colGapRatio(l - 1, 0, H) > 0.6) l--;
    while (r < W - 1 && colGapRatio(r + 1, 0, H) > 0.6) r++;
    const cols = [[0, l], [r + 1, W]];
    const out = [];
    cols.forEach(([x0, x1], ci) => {
      // Dải khe ngang trong cột này.
      const isGapRow = [];
      for (let y = 0; y < H; y++) isGapRow.push(rowGapRatio(y, x0 + 20, x1 - 20) > 0.85);
      const panels = [];
      let y = 0;
      while (y < H) {
        while (y < H && isGapRow[y]) y++;
        const s = y;
        while (y < H && !isGapRow[y]) y++;
        if (y - s > H * 0.08) panels.push([s, y]);
      }
      // Khe quá mờ → hai ô dính nhau: tách ô cao nhất tại dòng sáng nhất ở khoảng giữa.
      while (panels.length < 5) {
        let ti = 0;
        panels.forEach((pp, k) => { if (pp[1] - pp[0] > panels[ti][1] - panels[ti][0]) ti = k; });
        const [s0, s1] = panels[ti];
        const lum = (yy) => { let t = 0; for (let x = x0 + 20; x < x1 - 20; x += 2) { const i = (yy * W + x) * 4; t += px[i] + px[i + 1] + px[i + 2]; } return t; };
        let by = s0, bv = -1;
        for (let yy = s0 + Math.round((s1 - s0) * 0.3); yy < s1 - (s1 - s0) * 0.3; yy++) { const v = lum(yy); if (v > bv) { bv = v; by = yy; } }
        let g0 = by, g1 = by;
        while (g0 > s0 && lum(g0 - 1) > bv * 0.97) g0--;
        while (g1 < s1 - 1 && lum(g1 + 1) > bv * 0.97) g1++;
        panels.splice(ti, 1, [s0, g0], [g1 + 1, s1]);
      }
      // Bỏ viền sáng hai bên trong mỗi ô; cắt lẹm vào 6px để mất bo góc trắng.
      panels.slice(0, 5).forEach(([y0, y1], ri) => {
        let a = x0, b = x1 - 1;
        while (a < b && colGapRatio(a, y0, y1) > 0.85) a++;
        while (b > a && colGapRatio(b, y0, y1) > 0.85) b--;
        const inset = 6;
        out.push({ index: ri * 2 + ci, x: a + inset, y: y0 + inset, w: b - a - 2 * inset, h: y1 - y0 - 2 * inset });
      });
    });
    out.sort((p, q) => p.index - q.index);
    return out.map((p) => {
      const k = document.createElement('canvas');
      k.width = p.w; k.height = p.h;
      k.getContext('2d').drawImage(c, p.x, p.y, p.w, p.h, 0, 0, p.w, p.h);
      return { ...p, data: k.toDataURL('image/webp', 0.86) };
    });
  }, dataUrl);
  if (crops.length !== 10) console.warn(`${file}: tìm thấy ${crops.length} ô (mong đợi 10)`);
  crops.forEach((p, i) => {
    const id = `L${String(first + i).padStart(2, '0')}`;
    writeFileSync(join(OUT, `${id}.webp`), Buffer.from(p.data.split(',')[1], 'base64'));
    console.log(`${id}: ${p.w}×${p.h} (x${p.x} y${p.y})`);
  });
}
await browser.close();
