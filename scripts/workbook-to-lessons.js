// Gắn bài tập chép từ sách bài tập 《汉语》练习册 (data/workbook/*.json) vào bài giáo trình theo từ vựng:
// mỗi câu hỏi được tách từ, chỉ giữ câu mà mọi từ (kể cả phương án nhiễu) đều có trong từ vựng giáo trình,
// và gắn vào bài sớm nhất đã dạy đủ các từ đó. Ghi vào data/lessons/Lxx.json (id bắt đầu bằng "-wb").
// Chạy: node scripts/workbook-to-lessons.js
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readContentDir } from './read-content.js';
import { buildDictionary, segmentSentence, isHanChar } from '../src/core/segment.js';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dataDir = join(root, 'data');
const { cards } = readContentDir(dataDir).result;
const lessonFiles = readdirSync(join(dataDir, 'lessons')).filter((f) => /^L\d+\.json$/.test(f)).sort();
const lessons = lessonFiles.map((f) => ({ file: f, data: JSON.parse(readFileSync(join(dataDir, 'lessons', f), 'utf8')) }));
const order = new Map(lessons.map((l, i) => [l.data.id, i]));
const dict = buildDictionary(cards);
const PUNCT = /[，。？！：；、“”‘’（）…—\s,.?!:;()_\-]/;

// Bài sớm nhất dạy một từ (có thể có nhiều thẻ trùng chữ).
const firstLesson = new Map();
for (const c of cards) {
  // Tên riêng không gắn bài (王, 玛丽…): dùng được từ bài 1.
  const i = order.get(c.lesson_id) ?? ((c.tags || []).includes('tên riêng') ? 0 : null);
  if (i == null) continue;
  if (!firstLesson.has(c.hanzi) || firstLesson.get(c.hanzi) > i) firstLesson.set(c.hanzi, i);
}
// Thẻ gốc có dạng "面条儿", "角（毛）"…: thêm các biến thể để khớp khi tách từ.
for (const [w, i] of [...firstLesson]) {
  const plain = w.replace(/（.*?）|\(.*?\)/g, '');
  for (const v of [plain, plain.replace(/儿$/, '')]) if (v && !firstLesson.has(v)) firstLesson.set(v, i);
}
for (const w of firstLesson.keys()) if (!dict.map.has(w)) dict.map.set(w, []);
// Chữ lẻ: bài sớm nhất có một từ chứa chữ đó (vd 老 trong 老师).
const firstChar = new Map();
for (const [w, i] of firstLesson) for (const ch of w) if (isHanChar(ch) && (!firstChar.has(ch) || firstChar.get(ch) > i)) firstChar.set(ch, i);

/** Bài sớm nhất đủ từ cho một đoạn chữ Hán; null nếu có từ ngoài giáo trình. */
function needLesson(text) {
  let max = -1;
  for (const t of segmentSentence(text, dict)) {
    if (!t.word || ![...t.text].some(isHanChar) || PUNCT.test(t.text)) continue;
    let i = firstLesson.get(t.text);
    if (i == null) {
      // Từ ghép không có trong từ vựng: chấp nhận nếu từng chữ đều đã học (vd 学校 + 们 …).
      const parts = [...t.text].map((ch) => firstLesson.get(ch) ?? firstChar.get(ch));
      if (parts.some((p) => p == null)) return null;
      i = Math.max(...parts);
    }
    max = Math.max(max, i);
  }
  return max;
}
const hanParts = (s) => (String(s).match(/[㐀-鿿]+[㐀-鿿，。？！、]*/g) || []).join('');

function placeItem(it) {
  const texts = [];
  if (it.type === 'reorder') texts.push(it.words.join(''));
  else if (it.type === 'match') for (const p of it.pairs) texts.push(p.left, p.right);
  else { texts.push(it.prompt); for (const o of it.options) texts.push(o); }
  let max = -1;
  for (const t of texts) {
    const h = hanParts(t);
    if (!h) continue;
    const i = needLesson(h);
    if (i == null) return null;
    max = Math.max(max, i);
  }
  return max < 0 ? null : max;
}

function shuffleSeeded(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  if (a.join('') === arr.join('') && a.length > 1) a.push(a.shift());
  return a;
}

function toExercise(it, id, k) {
  const base = { id, source: 'workbook' };
  if (it.type === 'reorder') {
    return { ...base, type: 'reorder', prompt: `Sắp xếp thành câu: “${it.vi}”`, options: shuffleSeeded(it.words, k + 7), answer: it.words, explanation: `${it.words.join('')} — ${it.vi}` };
  }
  if (it.type === 'match') return { ...base, type: 'match', prompt: it.prompt, pairs: it.pairs };
  return { ...base, type: 'choose', prompt: it.prompt, options: it.options, answer: it.answer, ...(it.explanation ? { explanation: it.explanation } : {}) };
}

const files = readdirSync(join(dataDir, 'workbook')).filter((f) => f.endsWith('.json')).sort();
const byLesson = new Map();
let kept = 0, dropped = 0;
const dropLog = [];
for (const f of files) {
  for (const it of JSON.parse(readFileSync(join(dataDir, 'workbook', f), 'utf8'))) {
    const i = placeItem(it);
    if (i == null) { dropped++; dropLog.push(`${f}: ${it.prompt || it.words?.join('') || it.type}`); continue; }
    kept++;
    if (!byLesson.has(i)) byLesson.set(i, []);
    byLesson.get(i).push(it);
  }
}

lessons.forEach((l, i) => {
  const ex = (l.data.exercises || []).filter((e) => !String(e.id).includes('-wb'));
  const items = byLesson.get(i) || [];
  items.forEach((it, k) => ex.push(toExercise(it, `${l.data.id}-wb${k + 1}`, k)));
  l.data.exercises = ex;
  writeFileSync(join(dataDir, 'lessons', l.file), `${JSON.stringify(l.data, null, 2)}\n`);
});
console.log(`Giữ ${kept}, bỏ ${dropped} (có từ ngoài giáo trình).`);
console.log([...byLesson].sort((a, b) => a[0] - b[0]).map(([i, v]) => `${lessons[i].data.id}:${v.length}`).join(' '));
if (process.argv.includes('--dropped')) console.log(dropLog.join('\n'));
