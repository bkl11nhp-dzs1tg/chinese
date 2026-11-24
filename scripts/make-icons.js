// Tạo icon web/PWA từ đúng logo ở đầu trang (ô đỏ, viền hồng, chữ 中 trắng).
// Chạy: npm run icons → public/icons/icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const RED = '#e8344f';
// Giống icon('logo') trong src/ui/icons.js (viewBox 24).
const glyph = '<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="3.6" fill="none" stroke="#ffd1dc" stroke-width="1.1"/>'
  + '<path d="M6.8 8.4h10.4v6.4H6.8z" fill="none" stroke="#fff" stroke-width="2.1" stroke-linejoin="round"/>'
  + '<path d="M12 4.8v14.6" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/>';

// Favicon: ô bo góc như logo.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="5" fill="${RED}"/>${glyph}</svg>`;
// Icon cài app: phủ kín nền đỏ (hệ điều hành tự bo góc), logo ở giữa.
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="${RED}"/><g transform="translate(1.2 1.2) scale(0.9)">${glyph}</g></svg>`;
// Maskable: logo thu nhỏ vào vùng an toàn 60% ở giữa.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="${RED}"/><g transform="translate(4.8 4.8) scale(0.6)">${glyph}</g></svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon.svg', favicon);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const [name, svg, size] of [['icon-192.png', full, 192], ['icon-512.png', full, 512], ['icon-maskable-512.png', maskable, 512]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('Đã tạo icon trong public/icons/');
