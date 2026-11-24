// Luyện tập theo kỹ năng: tạo bộ câu hỏi từ từ vựng và câu trong bài khóa. Hàm thuần.

import { shuffle } from './exercises.js';

export const SKILLS = [
  { id: 'listen', label: 'Nghe', desc: 'Nghe phát âm, chọn chữ hoặc câu đúng', icon: 'headphones', tone: 'blue' },
  { id: 'speak', label: 'Nói', desc: 'Đọc to từ và câu, máy nghe và chấm', icon: 'mic', tone: 'red' },
  { id: 'reading', label: 'Đọc hiểu', desc: 'Đọc câu trong bài khóa, chọn nghĩa', icon: 'eye', tone: 'green' },
  { id: 'vocab', label: 'Từ vựng', desc: 'Chữ ↔ nghĩa, ghép cặp', icon: 'cards', tone: 'orange' },
  { id: 'tones', label: 'Thanh điệu', desc: 'Chọn pinyin có dấu thanh đúng', icon: 'tone', tone: 'purple' },
  { id: 'typing', label: 'Gõ pinyin', desc: 'Nhìn chữ, gõ cách đọc', icon: 'keyboard', tone: 'navy' },
  { id: 'sentence', label: 'Ghép câu', desc: 'Sắp xếp từ thành câu đúng ngữ pháp', icon: 'blocks', tone: 'teal' },
];

// ---------------------------------------------------------------- pinyin
const TONE_MARKS = ['\u0304', '\u0301', '\u030C', '\u0300']; // thanh 1–4
const TONE_RE = /[\u0304\u0301\u030C\u0300]/;

/** Bỏ dấu thanh, giữ ü. */
export function stripTones(s) {
  return String(s).normalize('NFD').replace(/[\u0304\u0301\u030C\u0300]/g, '').normalize('NFC');
}

/** Chuẩn hóa để so sánh câu trả lời gõ tay: bỏ dấu thanh, số thanh, khoảng trắng, dấu ', ü → v. */
export function normalizePinyin(s) {
  return stripTones(String(s).toLowerCase())
    .replace(/ü|u:/g, 'v')
    .replace(/[\d\s'’·\-.,!?。，？！]/g, '');
}

/** Các cách viết chấp nhận được của một mục pinyin: "shéi / shuí", "jiǎo (máo)", "méi (yǒu)". */
export function pinyinAnswers(pinyin) {
  const out = new Set();
  for (const part of String(pinyin).split('/')) {
    const p = part.trim();
    if (!p) continue;
    out.add(normalizePinyin(p.replace(/\(.*?\)|（.*?）/g, '')));
    out.add(normalizePinyin(p.replace(/[()（）]/g, '')));
  }
  out.delete('');
  return [...out];
}

export function gradePinyin(typed, pinyin) {
  const t = normalizePinyin(typed);
  return t !== '' && pinyinAnswers(pinyin).includes(t);
}

/** Phương án nhiễu cho thanh điệu: đổi dấu thanh của một âm tiết (hoặc bỏ dấu → thanh nhẹ). */
export function toneVariants(pinyin, n = 3, rand = Math.random) {
  const chars = [...String(pinyin).normalize('NFD')];
  const marks = chars.map((c, i) => (TONE_RE.test(c) ? i : -1)).filter((i) => i >= 0);
  const variants = new Set();
  if (!marks.length) return [];
  const target = String(pinyin).normalize('NFC');
  for (let tries = 0; tries < 40 && variants.size < n; tries++) {
    const copy = [...chars];
    const changes = marks.length > 1 && rand() < 0.35 ? 2 : 1;
    for (const pos of shuffle(marks, rand).slice(0, changes)) {
      const options = TONE_MARKS.filter((m) => m !== copy[pos]);
      copy[pos] = options[Math.floor(rand() * options.length)];
    }
    const v = copy.join('').normalize('NFC');
    if (v !== target) variants.add(v);
  }
  return [...variants];
}

// ---------------------------------------------------------------- tạo câu hỏi
const usableCard = (c) => c && c.hanzi && c.meaning && c.pinyin && !/^\(/.test(c.meaning) && !/\//.test(c.pinyin);

function pickOthers(pool, exclude, key, n, rand) {
  const seen = new Set([exclude[key]]);
  const out = [];
  for (const c of shuffle(pool, rand)) {
    if (out.length >= n) break;
    if (c !== exclude && c[key] && !seen.has(c[key])) { seen.add(c[key]); out.push(c[key]); }
  }
  return out;
}

/**
 * @param {string} skill
 * @param {{cards:Array, pool:Array, lines:Array<{zh,vi,tokens?}>, rand?:Function, n?:number}} src
 *   cards: từ trong phạm vi luyện; pool: kho để lấy phương án nhiễu; lines: câu bài khóa trong phạm vi.
 */
export function buildSkillSet(skill, { cards = [], pool = cards, lines = [], rand = Math.random, n = 10 }) {
  const words = cards.filter(usableCard);
  const poolWords = pool.filter(usableCard);
  const shortLines = lines.filter((l) => l.zh && l.vi && [...l.zh].length <= 24);
  const pickWords = (k) => shuffle(words, rand).slice(0, k);
  const out = [];
  const choose = (prompt, answer, others, extra = {}) => {
    if (others.length < 2) return;
    out.push({ type: 'choose', prompt, answer, options: shuffle([answer, ...others], rand), ...extra });
  };

  if (skill === 'vocab') {
    for (const [i, c] of pickWords(n).entries()) {
      if (i % 2) choose(`Chữ nào nghĩa là “${c.meaning}”?`, c.hanzi, pickOthers(poolWords, c, 'hanzi', 3, rand), { card_ids: [c.id], explanation: `${c.hanzi} (${c.pinyin}): ${c.meaning}` });
      else choose(`“${c.hanzi}” nghĩa là gì?`, c.meaning, pickOthers(poolWords, c, 'meaning', 3, rand), { card_ids: [c.id], explanation: `${c.hanzi} (${c.pinyin})` });
    }
    const m = pickWords(5);
    if (m.length >= 3) out.splice(Math.min(out.length, 4), 0, { type: 'match', prompt: 'Nối chữ Hán với nghĩa', pairs: m.map((c) => ({ left: c.hanzi, right: c.meaning })), card_ids: m.map((c) => c.id) });
  } else if (skill === 'listen') {
    const ws = pickWords(Math.ceil(n * 0.6));
    for (const c of ws) {
      const others = pickOthers(poolWords, c, 'hanzi', 3, rand);
      if (others.length >= 2) out.push({ type: 'listen', speak: c.hanzi, prompt: 'Nghe và chọn chữ đúng', answer: c.hanzi, options: shuffle([c.hanzi, ...others], rand), card_ids: [c.id], explanation: `${c.hanzi} (${c.pinyin}): ${c.meaning}` });
    }
    const vis = shuffle(shortLines, rand).slice(0, n - out.length);
    for (const l of vis) {
      const others = shuffle(shortLines.filter((x) => x.vi !== l.vi), rand).slice(0, 3).map((x) => x.vi);
      if (others.length >= 2) out.push({ type: 'listen', speak: l.zh, prompt: 'Nghe câu và chọn nghĩa', answer: l.vi, options: shuffle([l.vi, ...others], rand), explanation: l.zh });
    }
  } else if (skill === 'reading') {
    for (const l of shuffle(shortLines, rand).slice(0, n)) {
      choose(`Câu “${l.zh}” nghĩa là gì?`, l.vi, shuffle(shortLines.filter((x) => x.vi !== l.vi), rand).slice(0, 3).map((x) => x.vi), { explanation: l.zh });
    }
  } else if (skill === 'tones') {
    for (const c of pickWords(n * 2)) {
      if (out.length >= n) break;
      const variants = toneVariants(c.pinyin, 3, rand);
      if (variants.length >= 2) out.push({ type: 'choose', prompt: `Chọn pinyin đúng của “${c.hanzi}” (${c.meaning})`, answer: c.pinyin, options: shuffle([c.pinyin, ...variants], rand), card_ids: [c.id], explanation: `${c.hanzi}: ${c.pinyin}` });
    }
  } else if (skill === 'typing') {
    for (const c of pickWords(n)) {
      out.push({ type: 'pinyin', prompt: `Gõ pinyin của “${c.hanzi}” (${c.meaning})`, hanzi: c.hanzi, answer: c.pinyin, card_ids: [c.id], explanation: 'Không cần gõ dấu thanh; có thể gõ số (ni3hao3) hoặc v thay ü.' });
    }
  } else if (skill === 'sentence') {
    const ok = shuffle(shortLines.filter((l) => {
      const w = (l.tokens || []).filter((t) => t.word).map((t) => t.text);
      return w.length >= 3 && w.length <= 8 && new Set(w).size === w.length && !/[，,、]/.test(l.zh.replace(/[。？！]$/, ''));
    }), rand).slice(0, n);
    for (const l of ok) {
      const pieces = l.tokens.filter((t) => t.word).map((t) => t.text);
      out.push({ type: 'reorder', prompt: `Sắp xếp thành câu: “${l.vi}”`, options: pieces, answer: pieces, explanation: `${l.zh} — ${l.vi}`, speak: l.zh });
    }
  } else if (skill === 'speak') {
    const ws = pickWords(Math.ceil(n / 2));
    for (const c of ws) out.push({ type: 'speak', prompt: 'Đọc to từ này', target: c.hanzi, pinyin: c.pinyin, meaning: c.meaning, card_ids: [c.id] });
    for (const l of shuffle(shortLines.filter((x) => [...x.zh].length <= 12), rand).slice(0, n - out.length)) {
      out.push({ type: 'speak', prompt: 'Đọc to câu này', target: l.zh, meaning: l.vi });
    }
  }
  return shuffle(out, rand).slice(0, n + 1).map((q, i) => ({ id: `p-${skill}-${i}`, ...q }));
}

/** Chấm phần nói: so khớp chữ Hán sau khi bỏ dấu câu; chấp nhận nếu trùng ≥ 70% ký tự theo thứ tự. */
export function gradeSpeech(transcript, target) {
  const clean = (s) => [...String(s).replace(/[^\p{Script=Han}a-zA-Z0-9]/gu, '')];
  const a = clean(transcript);
  const b = clean(target);
  if (!b.length || !a.length) return false;
  // Độ dài dãy con chung dài nhất (LCS)
  const dp = Array(b.length + 1).fill(0);
  for (const ch of a) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = ch === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length] / b.length >= 0.7;
}
