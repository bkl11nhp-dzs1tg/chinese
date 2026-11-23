import { describe, it, expect } from 'vitest';
import { buildDictionary, segmentSentence, tokensValid } from '../src/core/segment.js';
import { sentencePinyin } from '../src/core/pinyin-text.js';

// Câu mẫu tự viết, không dùng nội dung sách.
const cards = ['我', '早饭', '吃', '就', '来', '了', '留学生', '学生', '学', '没（有）', '角（毛）'].map((h, i) => ({ id: `c${i}`, hanzi: h }));
const dict = buildDictionary(cards);

describe('segmentSentence', () => {
  it('khớp từ dài nhất, không mất ký tự, offset khớp chuỗi gốc', () => {
    const s = '我吃了早饭就来了。';
    const t = segmentSentence(s, dict);
    expect(t.map((x) => x.text)).toEqual(['我', '吃', '了', '早饭', '就', '来', '了', '。']);
    expect(t.map((x) => x.text).join('')).toBe(s);
    for (const tok of t) expect([...s].slice(tok.start, tok.end).join('')).toBe(tok.text);
    expect(tokensValid(s, t)).toBe(true);
  });

  it('ưu tiên từ dài: 留学生 thay vì 留 + 学生', () => {
    expect(segmentSentence('他们是留学生吗？', dict).map((x) => x.text)).toContain('留学生');
  });

  it('khóa từ điển bỏ phần trong ngoặc: 没（有） → 没有, 没', () => {
    expect(dict.map.has('没有')).toBe(true);
    expect(dict.map.has('角')).toBe(true);
  });

  it('chữ không có trong từ điển → tách từng chữ; chữ Latin và số gộp lại', () => {
    const t = segmentSentence('你好DVD 601。', dict);
    expect(t.map((x) => x.text)).toEqual(['你', '好', 'DVD 601。']);
    expect(t[2].word).toBe(false);
  });

  it('không có từ điển vẫn tách được', () => {
    expect(segmentSentence('你好', null).map((x) => x.text)).toEqual(['你', '好']);
  });
});

describe('sentencePinyin', () => {
  it('ghép âm tiết theo từ, viết hoa đầu câu, dấu câu Latin', () => {
    const p = sentencePinyin('我吃了早饭就来了。', segmentSentence('我吃了早饭就来了。', dict));
    expect(p).toBe('Wǒ chī le zǎofàn jiù lái le.');
  });
  it('viết hoa lại sau dấu chấm', () => {
    const p = sentencePinyin('我来了。我吃了。', segmentSentence('我来了。我吃了。', dict));
    expect(p).toBe('Wǒ lái le. Wǒ chī le.');
  });
});

describe('sentencePinyin theo bính âm trong sách', () => {
  const d = buildDictionary([
    { id: 'a', hanzi: '时候', pinyin: 'shíhou' }, { id: 'b', hanzi: '汉语', pinyin: 'Hànyǔ' },
    { id: 'c', hanzi: '我', pinyin: 'wǒ' }, { id: 'd', hanzi: '谁', pinyin: 'shéi / shuí' },
  ]);
  it('dùng bính âm của từ trong từ vựng (thanh nhẹ, viết hoa tên riêng)', () => {
    expect(sentencePinyin('我学汉语的时候。', segmentSentence('我学汉语的时候。', d), d)).toBe('Wǒ xué Hànyǔ de shíhou.');
  });
  it('得 sau động từ đọc de', () => {
    expect(sentencePinyin('他跑得很快。', segmentSentence('他跑得很快。', d), d)).toMatch(/pǎo de hěn kuài/);
  });
});
