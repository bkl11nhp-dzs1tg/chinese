// Tạo src/features/basics/pinyin-chars.json: mỗi âm tiết pinyin → chữ đại diện cho từng thanh (để giọng máy đọc đúng âm).
// Ưu tiên chữ có trong từ vựng của sách, rồi chữ thông dụng cấp 1 GB2312 (3755 chữ), rồi cấp 2.
// Chạy: node scripts/build-pinyin-chars.js

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HAN = /^[一-鿿]$/;

// Chữ trong từ vựng (giữ thứ tự xuất hiện).
const vocabChars = [];
for (const f of readdirSync(join(root, 'data/vocab')).filter((x) => x.endsWith('.csv'))) {
  for (const line of readFileSync(join(root, 'data/vocab', f), 'utf8').split(/\r?\n/).slice(1)) {
    const hz = line.split(',')[1] || '';
    for (const ch of hz) if (HAN.test(ch)) vocabChars.push(ch);
  }
}

function gbRange(hiFrom, hiTo) {
  const td = new TextDecoder('gbk');
  const out = [];
  for (let hi = hiFrom; hi <= hiTo; hi++) for (let lo = 0xa1; lo <= 0xfe; lo++) {
    const ch = td.decode(Buffer.from([hi, lo]));
    if (HAN.test(ch)) out.push(ch);
  }
  return out;
}
const level1 = gbRange(0xb0, 0xd7);
const level2 = gbRange(0xd8, 0xf7);

const out = {};
const seen = new Set();
for (const ch of [...vocabChars, ...level1, ...level2]) {
  if (seen.has(ch)) continue;
  seen.add(ch);
  const num = pinyin(ch, { toneType: 'num' });
  const m = /^([a-zü]+)([0-4])$/.exec(num);
  if (!m) continue;
  const [, syl, tone] = m;
  out[syl] ||= {};
  if (!out[syl][tone]) out[syl][tone] = [ch, pinyin(ch)];
}

const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
writeFileSync(join(root, 'src/features/basics/pinyin-chars.json'), JSON.stringify(sorted));
console.log(`${Object.keys(sorted).length} âm tiết`);
