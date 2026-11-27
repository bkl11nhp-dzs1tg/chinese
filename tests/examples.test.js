import { describe, it, expect } from 'vitest';
import { exampleSources, pickExample } from '../src/core/examples.js';

const lessons = [
  { id: 'L01', texts: [{ lines: [{ zh: '你好！', vi: 'Chào bạn!' }] }] },
  { id: 'L02', texts: [{ lines: [{ zh: '谢谢！', vi: 'Cảm ơn!' }, { zh: '你忙吗？', vi: 'Bạn bận không?' }, { zh: '我很忙，谢谢你。', vi: 'Tôi rất bận, cảm ơn bạn.' }] }],
    grammar_points: [{ examples: [{ zh: '他不忙。', vi: 'Anh ấy không bận.', pinyin: 'Tā bù máng.' }] }] },
  { id: 'L03', texts: [{ lines: [{ zh: '老师很忙。', vi: 'Thầy rất bận.' }] }] },
];
const src = exampleSources(lessons);

describe('câu ví dụ cho thẻ', () => {
  it('ưu tiên câu của chính bài, câu không chỉ có mỗi từ đó', () => {
    expect(pickExample({ hanzi: '谢谢', lesson_id: 'L02' }, src, 1).zh).toBe('我很忙，谢谢你。');
  });
  it('ví dụ ngữ pháp có sẵn pinyin được ưu tiên khi ngang nhau', () => {
    const ex = pickExample({ hanzi: '忙' }, src, 1);
    expect(ex.zh.includes('忙')).toBe(true);
    expect([...'你忙吗？他不忙。我很忙，谢谢你。']).toBeTruthy();
  });
  it('câu bài sau chỉ dùng khi không có câu bài này/bài trước', () => {
    expect(pickExample({ hanzi: '老师' }, src, 0).zh).toBe('老师很忙。');
    expect(pickExample({ hanzi: '飞机' }, src, 0)).toBeNull();
  });
  it('bỏ phần chú thích trong ngoặc của từ', () => {
    expect(pickExample({ hanzi: '你（们）' }, src, 0).zh).toBe('你好！');
  });
});

describe('ví dụ: từ đứng riêng', () => {
  it('không lấy câu mà từ chỉ là một phần của từ dài hơn', () => {
    const src2 = exampleSources([{ id: 'L1', texts: [{ lines: [{ zh: '苹果多少钱？', vi: 'Táo bao nhiêu tiền?' }, { zh: '人很多。', vi: 'Người rất đông.' }] }] }]);
    const words = (s) => (s.zh.includes('多少') ? ['苹果', '多少', '钱'] : ['人', '很', '多']);
    expect(pickExample({ hanzi: '多', lesson_id: 'L1' }, src2, 0, words).zh).toBe('人很多。');
  });
});
