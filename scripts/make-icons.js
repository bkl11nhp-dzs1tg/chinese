// Tạo icon PWA dạng pixel (chữ 中 trên nền đỏ) mà không cần thư viện ảnh: tự ghi PNG bằng zlib.
// Chạy: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const GLYPH = ['...##...', '########', '#..##..#', '#..##..#', '########', '...##...', '...##...', '...##...'];
const BG = [0xe8, 0x34, 0x4f];
const FG = [0xff, 0xff, 0xff];
const ACCENT = [0xff, 0xc4, 0xd2];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, maskable) {
  // Lưới 12×12: glyph 8×8 ở giữa (vùng an toàn cho icon maskable), viền dưới màu nhấn.
  const grid = 12, cell = size / grid, off = 2;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cell) - off, gy = Math.floor(y / cell) - off;
      let c = BG;
      if (gx >= 0 && gx < 8 && gy >= 0 && gy < 8 && GLYPH[gy][gx] === '#') c = FG;
      if (!maskable && Math.floor(y / cell) === grid - 1) c = ACCENT;
      raw.set(c, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, false));
writeFileSync('public/icons/icon-512.png', png(512, false));
writeFileSync('public/icons/icon-maskable-512.png', png(512, true));
let d = '';
GLYPH.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') d += `M${x + 2} ${y + 2}h1v1h-1z`; }));
writeFileSync('public/icons/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" shape-rendering="crispEdges"><rect width="12" height="12" fill="#1f2a44"/><rect y="11" width="12" height="1" fill="#e0864a"/><path fill="#f4eddc" d="${d}"/></svg>\n`);
console.log('Đã tạo icon trong public/icons/');
