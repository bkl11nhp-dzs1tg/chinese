// Điền bính âm còn thiếu cho bài khóa, ví dụ ngữ pháp và câu bài đọc (không ghi đè bính âm có sẵn).
import { buildDictionary, segmentSentence } from './segment.js';
import { sentencePinyin } from './pinyin-text.js';

export function fillPinyin({ cards = [], lessons = [], readings = [] }) {
  const dict = buildDictionary(cards);
  const py = (zh) => sentencePinyin(zh, segmentSentence(zh, dict), dict);
  let filled = 0;
  for (const l of lessons) {
    for (const t of l.texts || []) for (const ln of t.lines || []) if (!ln.pinyin) { ln.pinyin = py(ln.zh); filled++; }
    for (const g of l.grammar_points || []) for (const e of g.examples || []) if (!e.pinyin) { e.pinyin = py(e.zh); filled++; }
  }
  for (const r of readings) for (const p of r.paragraphs) for (const s of p.sentences) if (!s.pinyin) { s.pinyin = py(s.hanzi); filled++; }
  return filled;
}
