// Tách từ cho bài đọc (mục 9.11c): khớp dài nhất theo từ điển của chính người học
// (từ vựng đã nạp). Không có trong từ điển → tách từng chữ, hoặc (icu) theo bộ tách từ của trình duyệt.

const HAN = /\p{Script=Han}/u;
export const isHanChar = (ch) => HAN.test(ch);

/** Từ điển hanzi → danh sách thẻ (một chữ có thể có nhiều nghĩa/thẻ). */
export function buildDictionary(cards) {
  const dict = new Map();
  let maxLen = 1;
  for (const c of cards) {
    const key = (c.hanzi || '').trim();
    // Bỏ các mục kiểu "角（毛）", "没（有）": lấy phần trước ngoặc làm khóa.
    const variants = new Set([key, key.replace(/[（(].*?[）)]/g, ''), key.replace(/[（()）]/g, '')]);
    for (const k of variants) {
      if (!k || ![...k].every(isHanChar)) continue;
      if (!dict.has(k)) dict.set(k, []);
      if (!dict.get(k).includes(c)) dict.get(k).push(c);
      maxLen = Math.max(maxLen, [...k].length);
    }
  }
  return { map: dict, maxLen: Math.min(maxLen, 8) };
}

/**
 * Ranh giới từ theo bộ tách từ của trình duyệt (Intl.Segmenter, ICU): vị trí bắt đầu (code point) → độ dài.
 * Chỉ giữ từ ≥ 2 chữ Hán. Không hỗ trợ → Map rỗng.
 */
function icuWords(text) {
  const out = new Map();
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return out;
  let seg;
  try { seg = new Intl.Segmenter('zh', { granularity: 'word' }); } catch { return out; }
  let cp = 0;
  for (const s of seg.segment(text)) {
    const n = [...s.segment].length;
    if (n > 1 && [...s.segment].every(isHanChar)) out.set(cp, n);
    cp += n;
  }
  return out;
}

/** Đại từ, trợ từ: luôn đứng riêng, không gộp vào cụm ICU. */
const FUNC = new Set([...'你我他她它您的得地了着过吗呢吧啊呀嘛']);

/** Cụm ICU tách được hết thành các từ đã có trong từ điển (我爱你 → 我/爱/你) thì không gộp. */
function splitsIntoKnown(chars, dictionary) {
  let i = 0;
  while (i < chars.length) {
    let len = Math.min(dictionary?.maxLen || 1, chars.length - i);
    for (; len > 0; len--) if (dictionary?.map.has(chars.slice(i, i + len).join(''))) break;
    if (!len) return false;
    i += len;
  }
  return true;
}

/**
 * Tách câu thành token: [{ text, start, end, word: boolean }]
 * start/end tính theo chỉ số code point; ghép lại các token = câu gốc (không mất ký tự).
 * icu: chữ ngoài từ điển thì nhờ bộ tách từ của trình duyệt gộp thành từ (幸福, 月亮) thay vì tách từng chữ.
 */
export function segmentSentence(text, dictionary, { icu = false } = {}) {
  const chars = [...text];
  const out = [];
  const icuAt = icu ? icuWords(text) : new Map();
  let i = 0;
  while (i < chars.length) {
    if (!isHanChar(chars[i])) {
      let j = i;
      while (j < chars.length && !isHanChar(chars[j])) j++;
      out.push({ text: chars.slice(i, j).join(''), start: i, end: j, word: false });
      i = j;
      continue;
    }
    let len = Math.min(dictionary?.maxLen || 1, chars.length - i);
    for (; len > 1; len--) {
      const slice = chars.slice(i, i + len);
      if (slice.every(isHanChar) && dictionary.map.has(slice.join(''))) break;
    }
    if (len === 1 && icuAt.has(i)) {
      let w = chars.slice(i, i + icuAt.get(i));
      // ICU hay gộp cả đại từ/trợ từ (祝你, 笑得): bỏ chúng ở hai đầu cụm
      if (!FUNC.has(w[0])) while (w.length > 1 && FUNC.has(w[w.length - 1])) w = w.slice(0, -1);
      if (w.length > 1 && !FUNC.has(w[0]) && !splitsIntoKnown(w, dictionary)) len = w.length;
    }
    out.push({ text: chars.slice(i, i + len).join(''), start: i, end: i + len, word: true });
    i += len;
  }
  return out;
}

/** Kiểm tra token khớp câu gốc (dùng cho validate). */
export function tokensValid(text, tokens) {
  const n = [...text].length;
  return tokens.every((t) => Number.isInteger(t.start) && Number.isInteger(t.end) && t.start >= 0 && t.end <= n && t.start < t.end);
}
