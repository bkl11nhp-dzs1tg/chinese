import { describe, it, expect } from 'vitest';
import { normalizeAnswer, grade, autoExercises, mulberry32, relatedCardIds, answerText } from '../src/core/exercises.js';

describe('chấm bài tập', () => {
  it('fill: bỏ khoảng trắng thừa, dấu câu cuối, hoa thường', () => {
    expect(normalizeAnswer('  我 是  学生。 ')).toBe('我是学生');
    expect(grade({ type: 'fill', answer: '是' }, ' 是 ')).toBe(true);
    expect(grade({ type: 'fill', answer: ['shì', '是'] }, 'SHÌ')).toBe(true);
    expect(grade({ type: 'fill', answer: '是' }, '')).toBe(false);
  });

  it('choose / reorder / match', () => {
    expect(grade({ type: 'choose', answer: 'B' }, 'B')).toBe(true);
    expect(grade({ type: 'choose', answer: 'B' }, 'A')).toBe(false);
    expect(grade({ type: 'reorder', answer: ['我', '是', '学生'] }, ['我', '是', '学生'])).toBe(true);
    expect(grade({ type: 'reorder', answer: '我是学生' }, ['是', '我', '学生'])).toBe(false);
    const m = { type: 'match', pairs: [{ left: '你', right: 'bạn' }, { left: '好', right: 'tốt' }] };
    expect(grade(m, { 你: 'bạn', 好: 'tốt' })).toBe(true);
    expect(grade(m, new Map([['你', 'tốt'], ['好', 'bạn']]))).toBe(false);
    expect(answerText(m)).toBe('你 = bạn · 好 = tốt');
  });
});

describe('autoExercises', () => {
  const cards = [
    { id: 'a', hanzi: '你', pinyin: 'nǐ', meaning: 'bạn', lesson_id: 'L1' },
    { id: 'b', hanzi: '好', pinyin: 'hǎo', meaning: 'tốt', lesson_id: 'L1' },
    { id: 'c', hanzi: '我', pinyin: 'wǒ', meaning: 'tôi', lesson_id: 'L1' },
    { id: 'd', hanzi: '是', pinyin: 'shì', meaning: 'là', lesson_id: 'L2' },
  ];

  it('mỗi từ một câu, đáp án có trong lựa chọn, không trùng lựa chọn', () => {
    const ex = autoExercises(cards.slice(0, 3), cards, { rand: mulberry32(1) });
    expect(ex).toHaveLength(3);
    for (const e of ex) {
      expect(e.options).toContain(e.answer);
      expect(new Set(e.options).size).toBe(e.options.length);
      expect(e.options.length).toBe(4);
    }
  });

  it('cùng hạt giống → cùng kết quả', () => {
    expect(autoExercises(cards, cards, { rand: mulberry32(7) })).toEqual(autoExercises(cards, cards, { rand: mulberry32(7) }));
  });

  it('thẻ liên quan: ưu tiên card_ids, nếu không thì tìm chữ trong đề/đáp án', () => {
    expect(relatedCardIds({ card_ids: ['x'] }, cards)).toEqual(['x']);
    expect(relatedCardIds({ type: 'fill', prompt: '__学生', answer: '我是' }, cards).sort()).toEqual(['c', 'd']);
  });
});
