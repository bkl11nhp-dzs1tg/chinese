// Chép MP3 của sách vào data/audio/LXX.mp3 (đặt tên theo mã bài) để app tự lấy, không cần nạp tay.
// Chạy: npm run audio [-- <thư mục 1> <thư mục 2> …]   (mặc định ../MP3 Q1 và ../MP3 Q2)
import { readdirSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lessonIdFromAudioName } from '../src/core/audio.js';

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['../MP3 Q1', '../MP3 Q2'];
mkdirSync('data/audio', { recursive: true });
let n = 0;
for (const d of dirs) {
  if (!existsSync(d)) { console.log(`Bỏ qua (không có): ${d}`); continue; }
  for (const f of readdirSync(d)) {
    if (!/\.mp3$/i.test(f)) continue;
    const id = lessonIdFromAudioName(f);
    if (!id) { console.log(`Không đọc được số bài: ${f}`); continue; }
    const dest = join('data/audio', `${id}.mp3`);
    if (existsSync(dest) && statSync(dest).size === statSync(join(d, f)).size) continue;
    copyFileSync(join(d, f), dest);
    n++;
  }
}
console.log(`Đã chép ${n} file vào data/audio/.`);
