// Tải 30 file MP3 (data/audio/Lxx.mp3, tạo bằng `npm run audio`) lên kho R2 "chinese-audio".
// Chạy: npm run audio:upload   (cần đã `npx wrangler login`)
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const files = readdirSync('data/audio').filter((f) => /^L\d{2}\.mp3$/.test(f)).sort();
if (!files.length) { console.error('Chưa có data/audio/*.mp3 – chạy `npm run audio` trước.'); process.exit(1); }
for (const f of files) {
  console.log('↑', f);
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `chinese-audio/${f}`, '--file', `data/audio/${f}`, '--content-type', 'audio/mpeg', '--remote'], { stdio: 'inherit', shell: true, cwd: process.cwd() });
}
console.log(`Xong: ${files.length} file.`);
