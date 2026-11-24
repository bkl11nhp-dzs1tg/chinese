// Gộp data/vocab/*.csv + data/lessons/*.json thành một gói data/pack.json để nạp một lần
// (tiện cho điện thoại: Cài đặt → Nạp nội dung → chọn pack.json). Dừng nếu nội dung có lỗi.
// Chạy: npm run pack
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readContentDir } from './read-content.js';
import { buildPack } from '../src/core/importer.js';
import { fillPinyin } from '../src/core/fill-pinyin.js';

const root = process.argv[2] || 'data';
const { result: r } = readContentDir(root);
if (r.errors.length) {
  console.error(`Có ${r.errors.length} lỗi, chạy "npm run validate" để xem chi tiết. Chưa tạo gói.`);
  process.exit(1);
}
const filled = fillPinyin(r);
const out = join(root, 'pack.json');
const pack = buildPack(r);
pack.content_version = createHash('sha1').update(JSON.stringify(pack)).digest('hex').slice(0, 12);
writeFileSync(out, JSON.stringify(pack));
console.log(`Đã tạo ${out}: ${r.counts.cards} thẻ, ${r.counts.lessons} bài, ${r.counts.exercises} bài tập, ${r.counts.readings} bài đọc (tự điền ${filled} dòng pinyin).`);
