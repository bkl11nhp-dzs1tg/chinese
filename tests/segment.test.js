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

describe('sentencePinyin theo pinyin trong sách', () => {
  const d = buildDictionary([
    { id: 'a', hanzi: '时候', pinyin: 'shíhou' }, { id: 'b', hanzi: '汉语', pinyin: 'Hànyǔ' },
    { id: 'c', hanzi: '我', pinyin: 'wǒ' }, { id: 'd', hanzi: '谁', pinyin: 'shéi / shuí' },
  ]);
  it('dùng pinyin của từ trong từ vựng (thanh nhẹ, viết hoa tên riêng)', () => {
    expect(sentencePinyin('我学汉语的时候。', segmentSentence('我学汉语的时候。', d), d)).toBe('Wǒ xué Hànyǔ de shíhou.');
  });
  it('得 sau động từ đọc de', () => {
    expect(sentencePinyin('他跑得很快。', segmentSentence('他跑得很快。', d), d)).toMatch(/pǎo de hěn kuài/);
  });
});

describe('tách từ ngoài từ điển bằng Intl.Segmenter (icu)', () => {
  const dict = buildDictionary(['我', '爱', '你', '的', '心'].map((hanzi, i) => ({ id: String(i), hanzi })));
  const words = (t, o) => segmentSentence(t, dict, o).filter((x) => x.word).map((x) => x.text);
  it('gộp từ chưa học thành cụm: 幸福', () => {
    expect(words('祝你幸福', { icu: true })).toEqual(['祝', '你', '幸福']);
  });
  it('tách đại từ/trợ từ khỏi cụm ICU: 祝你, 笑得', () => {
    expect(words('祝你幸福', { icu: true })).toEqual(['祝', '你', '幸福']);
    expect(words('你笑得甜蜜蜜', { icu: true })).toEqual(['你', '笑', '得', '甜蜜蜜']);
  });
  it('cụm ghép từ các từ đã học thì vẫn tách: 我爱你', () => {
    expect(words('我爱你', { icu: true })).toEqual(['我', '爱', '你']);
  });
  it('không bật icu thì tách từng chữ như cũ', () => {
    expect(words('幸福')).toEqual(['幸', '福']);
  });
  it('ghép lại các token = câu gốc', () => {
    const t = '月亮代表我的心。';
    expect(segmentSentence(t, dict, { icu: true }).map((x) => x.text).join('')).toBe(t);
  });
});
