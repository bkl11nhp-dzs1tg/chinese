// Kiểm tra cuối bài: đề trộn từ vựng của bài (chữ → nghĩa, nghĩa → chữ, pinyin → chữ, nghe → chữ)
// và các câu của bài (điền chỗ trống, sắp xếp câu). Chấm ở cuối, không gợi ý trong lúc làm.
// Đạt ngưỡng (mặc định 70%) thì bài được tính là hoàn thành.

import { shuffle } from './exercises.js';

export const TEST_VOCAB_MAX = 10;
export const TEST_SENTENCE_MAX = 3;
export const TEST_TEXT_MAX = 4;

/**
 * Câu hỏi lấy từ bài khóa: sắp xếp câu (câu ngắn) và chọn nghĩa của câu.
 * lines: [{ zh, vi, tokens }] (tokens: từ segmentSentence, bỏ dấu câu cuối).
 */
export function textQuestions(lines, { rand = Math.random, max = TEST_TEXT_MAX } = {}) {
  const usable = lines.filter((l) => l.zh && l.vi);
  const out = [];
  const reorderable = shuffle(usable.filter((l) => {
    const words = (l.tokens || []).filter((t) => t.word);
    return words.length >= 3 && words.length <= 7 && !/[，,、]/.test(l.zh.replace(/[。？！]$/, ''));
  }), rand);
  for (const l of reorderable.slice(0, Math.ceil(max / 2))) {
    const pieces = l.tokens.filter((t) => t.word).map((t) => t.text);
    if (new Set(pieces).size !== pieces.length) continue; // tránh mảnh trùng gây mơ hồ
    out.push({ id: `text-r-${l.zh}`, type: 'reorder', prompt: `Sắp xếp thành câu: “${l.vi}”`, options: pieces, answer: pieces, explanation: `${l.zh} — ${l.vi}` });
  }
  const meaningPool = usable.map((l) => l.vi);
  for (const l of shuffle(usable.filter((x) => [...x.zh].length <= 20), rand)) {
    if (out.length >= max) break;
    const others = shuffle(meaningPool.filter((m) => m !== l.vi), rand).slice(0, 3);
    if (others.length < 2) break;
    out.push({ id: `text-m-${l.zh}`, type: 'choose', prompt: `Câu “${l.zh}” nghĩa là gì?`, options: shuffle([l.vi, ...others], rand), answer: l.vi, explanation: l.zh });
  }
  return out;
}

function pickDistractors(pool, card, key, n, rand) {
  const seen = new Set([card[key]]);
  const out = [];
  for (const c of shuffle(pool, rand)) {
    if (out.length >= n) break;
    if (c.id !== card.id && c[key] && !seen.has(c[key])) { seen.add(c[key]); out.push(c[key]); }
  }
  return out;
}

/**
 * @param {Array} lessonCards  từ của bài
 * @param {Array} pool         kho từ để lấy phương án nhiễu (ưu tiên cùng sách)
 * @param {Array} sentenceExercises  bài tập câu của bài (fill/reorder/choose)
 * @param {{rand?:()=>number, listen?:boolean, vocabMax?:number, sentenceMax?:number}} opts
 */
export function buildLessonTest(lessonCards, pool, sentenceExercises = [], opts = {}) {
  const { rand = Math.random, listen = false, vocabMax = TEST_VOCAB_MAX, sentenceMax = TEST_SENTENCE_MAX, textLines = [] } = opts;
  const kinds = ['hanzi-meaning', 'meaning-hanzi', 'pinyin-hanzi', ...(listen ? ['listen'] : [])];
  const cards = shuffle(lessonCards, rand).slice(0, vocabMax);
  const questions = [];
  cards.forEach((card, i) => {
    const kind = kinds[i % kinds.length];
    const key = kind === 'hanzi-meaning' ? 'meaning' : 'hanzi';
    const answer = card[key];
    const others = pickDistractors(pool, card, key, 3, rand);
    if (!others.length) return;
    const base = { id: `test-${card.id}-${kind}`, card_ids: [card.id], options: shuffle([answer, ...others], rand), answer, explanation: `${card.hanzi} (${card.pinyin}): ${card.meaning}` };
    if (kind === 'hanzi-meaning') questions.push({ ...base, type: 'choose', prompt: `“${card.hanzi}” nghĩa là gì?` });
    else if (kind === 'meaning-hanzi') questions.push({ ...base, type: 'choose', prompt: `Chữ nào nghĩa là “${card.meaning}”?` });
    else if (kind === 'pinyin-hanzi') questions.push({ ...base, type: 'choose', prompt: `Chữ nào đọc là “${card.pinyin}”?` });
    else questions.push({ ...base, type: 'listen', speak: card.hanzi, prompt: 'Nghe và chọn chữ đúng' });
  });
  const sentences = shuffle(sentenceExercises.filter((e) => ['fill', 'reorder', 'choose'].includes(e.type)), rand).slice(0, sentenceMax);
  return [...questions, ...sentences, ...textQuestions(textLines, { rand })];
}

/** results: [{ question, correct:boolean, response }] → điểm và danh sách câu sai. */
export function scoreTest(results, threshold = 0.7) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const score = total ? correct / total : 0;
  return { total, correct, score, passed: total > 0 && score >= threshold, wrong: results.filter((r) => !r.correct) };
}
