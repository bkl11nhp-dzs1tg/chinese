// Bính âm cho câu (dùng pinyin-pro, MIT). Lấy bính âm theo ngữ cảnh cả câu (để 了 đọc le, 得 đọc de…),
// rồi ghép các âm tiết trong cùng một từ, viết hoa đầu câu, đổi dấu câu Trung sang dấu câu Latin.

import { pinyin } from 'pinyin-pro';
import { isHanChar } from './segment.js';

const PUNCT = { '，': ',', '。': '.', '？': '?', '！': '!', '：': ':', '；': ';', '、': ',', '“': '"', '”': '"', '‘': "'", '’': "'", '（': '(', '）': ')', '《': '«', '》': '»', '…': '…', '—': '—' };

/** Bính âm từng chữ theo ngữ cảnh câu: mảng cùng độ dài [...text]. */
export function charPinyin(text) {
  const all = pinyin(text, { type: 'all' });
  return all.map((x) => (x.isZh ? x.pinyin : ''));
}

/** Bính âm của một từ đứng riêng (dùng khi tra từ). */
export function wordPinyin(word) {
  return charPinyin(word).join('');
}

/** Bính âm in trong sách cho từ ≥ 2 chữ (giữ thanh nhẹ, viết hoa tên riêng). Chỉ dùng khi không mơ hồ. */
function bookPinyin(word, dictionary) {
  if (!dictionary || [...word].length < 2) return null;
  const cards = dictionary.map.get(word);
  if (!cards?.length) return null;
  const set = new Set(cards.map((c) => (c.pinyin || '').trim()).filter((p) => p && !p.includes('/') && !/[（(]/.test(p)));
  return set.size === 1 ? [...set][0].replace(/\s+/g, '') : null;
}

/** text: câu gốc; tokens: kết quả segmentSentence(text); dictionary (tùy chọn): buildDictionary(cards). */
export function sentencePinyin(text, tokens, dictionary = null) {
  const py = charPinyin(text);
  const chars = [...text];
  // 得 sau động từ/tính từ là trợ từ bổ ngữ: đọc nhẹ "de" (trừ 得到, 得了 bệnh…).
  chars.forEach((ch, i) => {
    if (ch === '得' && i > 0 && isHanChar(chars[i - 1]) && chars[i + 1] !== '到' && py[i] === 'dé') py[i] = 'de';
  });
  let out = '';
  let capitalize = true;
  for (const t of tokens) {
    const chars = [...t.text];
    if (t.word && chars.every(isHanChar)) {
      let p = bookPinyin(t.text, dictionary) ?? py.slice(t.start, t.end).join('');
      if (capitalize) p = p.charAt(0).toUpperCase() + p.slice(1);
      capitalize = false;
      out += (out && !/[\s("«]$/.test(out) ? ' ' : '') + p;
    } else {
      const s = chars.map((ch) => PUNCT[ch] ?? ch).join('');
      out += /^[A-Za-z0-9]/.test(s) && out && !/\s$/.test(out) ? ` ${s}` : s;
      if (/[.!?]["»]?\s*$/.test(s)) capitalize = true;
      if (/[,.!?:;»)]$/.test(s)) out += ' ';
    }
  }
  return out.replace(/\s+/g, ' ').replace(/ ([,.!?:;)»])/g, '$1').trim();
}
