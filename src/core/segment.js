// Tách từ cho bài đọc (mục 9.11c): khớp dài nhất theo từ điển của chính người học
// (từ vựng đã nạp). Không có trong từ điển → tách từng chữ. Không đoán nghĩa.

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
 * Tách câu thành token: [{ text, start, end, word: boolean }]
 * start/end tính theo chỉ số code point; ghép lại các token = câu gốc (không mất ký tự).
 */
export function segmentSentence(text, dictionary) {
  const chars = [...text];
  const out = [];
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
