import { describe, it, expect } from 'vitest';
import { SKILLS, buildSkillSet, toneVariants, gradePinyin, normalizePinyin, gradeSpeech, stripTones } from '../src/core/practice.js';
import { mulberry32 } from '../src/core/exercises.js';
import { buildDictionary, segmentSentence } from '../src/core/segment.js';

const words = [
  ['你好', 'nǐ hǎo', 'xin chào'], ['学校', 'xuéxiào', 'trường học'], ['妈妈', 'māma', 'mẹ'], ['老师', 'lǎoshī', 'giáo viên'],
  ['苹果', 'píngguǒ', 'táo'], ['朋友', 'péngyou', 'bạn bè'], ['谁', 'shéi / shuí', 'ai'], ['去', 'qù', 'đi'], ['女', 'nǚ', 'nữ'],
].map(([hanzi, pinyin, meaning], i) => ({ id: `w${i}`, hanzi, pinyin, meaning }));
const dict = buildDictionary(words.concat(['我', '是', '很', '好'].map((h, i) => ({ id: `x${i}`, hanzi: h, pinyin: '', meaning: '' }))));
const mk = (zh, vi) => ({ zh, vi, tokens: segmentSentence(zh.replace(/[。？！]$/, ''), dict) });
const lines = [mk('我去学校。', 'Tôi đến trường.'), mk('你好！', 'Xin chào!'), mk('妈妈是老师。', 'Mẹ là giáo viên.'), mk('朋友很好。', 'Bạn bè rất tốt.')];

describe('pinyin', () => {
  it('bỏ dấu thanh giữ ü; chuẩn hóa câu gõ', () => {
    expect(stripTones('nǚ lǜ')).toBe('nü lü');
    expect(normalizePinyin('Nǐ hǎo')).toBe('nihao');
    expect(normalizePinyin('ni3 hao3')).toBe('nihao');
    expect(normalizePinyin('nü')).toBe('nv');
  });
  it('chấm gõ pinyin: bỏ qua dấu thanh/khoảng trắng, nhận cách viết thay thế', () => {
    expect(gradePinyin('nihao', 'nǐ hǎo')).toBe(true);
    expect(gradePinyin('xue xiao', 'xuéxiào')).toBe(true);
    expect(gradePinyin('shui', 'shéi / shuí')).toBe(true);
    expect(gradePinyin('nv', 'nǚ')).toBe(true);
    expect(gradePinyin('jiao', 'jiǎo (máo)')).toBe(true);
    expect(gradePinyin('nihoa', 'nǐ hǎo')).toBe(false);
    expect(gradePinyin('', 'nǐ')).toBe(false);
  });
  it('phương án nhiễu thanh điệu khác đáp án, cùng mặt chữ khi bỏ dấu', () => {
    const v = toneVariants('xuéxiào', 3, mulberry32(4));
    expect(v.length).toBe(3);
    for (const x of v) {
      expect(x).not.toBe('xuéxiào');
      expect(stripTones(x)).toBe('xuexiao');
    }
    expect(toneVariants('ma', 3)).toEqual([]);
  });
});

describe('buildSkillSet', () => {
  for (const s of SKILLS) {
    it(`kỹ năng ${s.id}: có câu hỏi, đáp án hợp lệ`, () => {
      const qs = buildSkillSet(s.id, { cards: words, lines, rand: mulberry32(7), n: 6 });
      expect(qs.length).toBeGreaterThan(0);
      for (const q of qs) {
        if (q.options && q.type !== 'reorder') expect(q.options).toContain(q.answer);
        if (q.type === 'reorder') expect([...q.answer].sort()).toEqual([...q.options].sort());
        expect(q.id).toMatch(/^p-/);
      }
    });
  }
  it('không dùng từ có nghĩa/pinyin mơ hồ làm câu hỏi', () => {
    const qs = buildSkillSet('vocab', { cards: words, lines, rand: mulberry32(1), n: 20 });
    expect(qs.some((q) => q.answer === 'ai' || q.answer === '谁')).toBe(false);
  });
});

describe('gradeSpeech', () => {
  it('chấp nhận nhận dạng gần đúng, từ chối sai hẳn', () => {
    expect(gradeSpeech('你好。', '你好')).toBe(true);
    expect(gradeSpeech('我去学校', '我去学校。')).toBe(true);
    expect(gradeSpeech('我去学', '我去学校。')).toBe(true);
    expect(gradeSpeech('他是老师', '我去学校。')).toBe(false);
    expect(gradeSpeech('', '你好')).toBe(false);
  });
});
