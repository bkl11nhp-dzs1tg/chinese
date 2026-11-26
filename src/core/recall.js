// Luyện nhớ chủ động cho một bài: người học phải tự viết, tự nhớ thay vì chỉ chọn đáp án. Hàm thuần.
// Trình tự (theo khung buổi 20 phút):
//   1. Xem từ mới (chữ, pinyin, nghĩa, nghe, thứ tự nét) → viết theo mẫu         ~ học + luyện viết
//   2. Ẩn mẫu, nhìn nghĩa tự viết lại                                          ~ tự nhớ & viết
//   3. Nghe rồi viết                                                            ~ luyện nghe
//   4. Kiểm tra tổng hợp: nhìn pinyin viết, điền chữ còn thiếu, xen từ cũ đã học ~ kiểm tra

import { shuffle } from './exercises.js';
import { buildComposeChars } from './decomp.js';

const HAN = /^[㐀-鿿]+$/;
const clean = (s) => String(s || '').replace(/（.*?）|\(.*?\)/g, '').trim();

/** Từ dùng được cho bài viết: chỉ chữ Hán, 1–3 chữ. */
export const writable = (c) => { const hz = clean(c.hanzi); return HAN.test(hz) && [...hz].length <= 3; };

/**
 * lessonCards: từ của bài; reviewCards: từ cũ đã học (để xen kẽ); pool: mọi thẻ (lấy chữ nhiễu).
 * Trả về mảng câu hỏi cho exerciseRunner.
 */
export function buildRecallSet(lessonCards, { reviewCards = [], pool = [], rand = Math.random, maxNew = 5, maxReview = null, decomp = null, lines = [], ordered = false } = {}) {
  // ordered: lessonCards đã xếp theo ưu tiên (vd. lâu chưa luyện) → lấy từ đầu; không thì chọn ngẫu nhiên.
  const src = lessonCards.filter(writable);
  const words = (ordered ? src : shuffle(src, rand)).slice(0, maxNew).map((c) => ({ ...c, hanzi: clean(c.hanzi) }));
  const nw = words.length;
  // Số câu theo số từ: ít từ thì bài ngắn.
  const nListen = Math.min(nw, Math.max(2, Math.ceil(nw / 2)));
  const nReview = maxReview ?? Math.min(4, Math.max(1, Math.round(nw / 2)));
  const nCompose = Math.min(3, Math.max(1, Math.round(nw / 3)));
  const nSentence = nw >= 6 ? 2 : 1;
  if (!words.length) return [];
  const q = (c, extra) => ({ hanzi: c.hanzi, pinyin: c.pinyin, meaning: c.meaning, answer: c.hanzi, card_ids: [c.id], explanation: `${c.hanzi} (${c.pinyin}): ${c.meaning}`, ...extra });
  const out = [];
  // 1. Xem + viết theo mẫu
  for (const c of words) {
    out.push(q(c, { type: 'study', prompt: '' }));
    out.push(q(c, { type: 'draw', mode: 'trace', prompt: `Viết theo mẫu: ${c.meaning}` }));
  }
  // 2. Tự nhớ: nhìn nghĩa viết lại (thứ tự xáo trộn)
  for (const c of shuffle(words, rand)) out.push(q(c, { type: 'draw', mode: 'meaning', prompt: 'Viết chữ Hán có nghĩa:', activity: 'recall-write' }));
  // 3. Nghe rồi viết
  for (const c of shuffle(words, rand).slice(0, nListen)) out.push(q(c, { type: 'draw', mode: 'listen', prompt: 'Nghe rồi viết chữ', activity: 'recall-listen' }));
  // 4. Kiểm tra tổng hợp: pinyin → viết, điền chữ thiếu, xen từ cũ
  const test = [];
  const chars = [...new Set(pool.flatMap((c) => [...clean(c.hanzi)]).filter((ch) => HAN.test(ch)))];
  for (const c of shuffle(words, rand)) {
    const cs = [...c.hanzi];
    if (cs.length >= 2) {
      const k = Math.floor(rand() * cs.length);
      const others = shuffle(chars.filter((ch) => ch !== cs[k]), rand).slice(0, 3);
      if (others.length >= 2) {
        test.push(q(c, { type: 'choose', activity: 'recall-missing', prompt: `Điền chữ còn thiếu: ${cs.map((ch, i) => (i === k ? '＿' : ch)).join('')} (${c.pinyin} – ${c.meaning})`, answer: cs[k], options: shuffle([cs[k], ...others], rand) }));
        continue;
      }
    }
    test.push(q(c, { type: 'draw', mode: 'pinyin', prompt: 'Viết chữ Hán có pinyin:', activity: 'recall-pinyin' }));
  }
  for (const c of shuffle(reviewCards.filter(writable), rand).slice(0, nReview)) {
    test.push(q({ ...c, hanzi: clean(c.hanzi) }, { type: 'draw', mode: 'meaning', prompt: 'Từ cũ – viết chữ Hán có nghĩa:', activity: 'recall-review' }));
  }
  // Ghép thành phần thành chữ (cấu tạo chữ)
  if (decomp) test.push(...buildComposeChars(words, decomp, { rand, n: nCompose }));
  out.push(...shuffle(test, rand));
  // 5. Đặt câu tự do với 2 từ (máy kiểm tra có dùng từ + dịch câu để tự đối chiếu)
  for (const c of shuffle(words, rand).slice(0, nSentence)) out.push(freewriteQ(c, lines));
  return out;
}

/** Câu hỏi đặt câu tự do; câu mẫu lấy từ bài khóa có chứa từ. */
export function freewriteQ(c, lines = []) {
  const sample = lines.find((l) => l.zh?.includes(c.hanzi));
  return { type: 'freewrite', activity: 'recall-sentence', word: c.hanzi, pinyin: c.pinyin, meaning: c.meaning, answer: c.hanzi, card_ids: [c.id], prompt: '', sample: sample ? { zh: sample.zh, vi: sample.vi } : null };
}

/** Nhãn kỹ năng nhớ cho thống kê. */
export const RECALL_SKILLS = {
  'recall-write': 'Tự viết (nhìn nghĩa)',
  'recall-listen': 'Nghe rồi viết',
  'recall-pinyin': 'Viết từ pinyin',
  'recall-missing': 'Điền chữ thiếu',
  'recall-review': 'Nhớ từ cũ',
  'recall-compose': 'Cấu tạo chữ',
  'recall-sentence': 'Đặt câu',
};
