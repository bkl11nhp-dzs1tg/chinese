import { describe, it, expect } from 'vitest';
import { buildLessonTest, scoreTest, textQuestions, TEST_VOCAB_MAX } from '../src/core/lessontest.js';
import { buildDictionary, segmentSentence } from '../src/core/segment.js';
import { mulberry32 } from '../src/core/exercises.js';

const card = (i) => ({ id: `c${i}`, hanzi: `字${i}`, pinyin: `zi${i}`, meaning: `nghĩa ${i}` });
const cards = Array.from({ length: 20 }, (_, i) => card(i));
const sentences = [
  { id: 's1', type: 'fill', prompt: '我___学生', answer: '是' },
  { id: 's2', type: 'reorder', options: ['我', '是'], answer: ['我', '是'] },
  { id: 's3', type: 'match', pairs: [] },
];

describe('buildLessonTest', () => {
  it('giới hạn số câu từ vựng, thêm câu của bài (bỏ dạng không hợp)', () => {
    const t = buildLessonTest(cards, cards, sentences, { rand: mulberry32(3) });
    const vocab = t.filter((q) => q.id.startsWith('test-'));
    expect(vocab).toHaveLength(TEST_VOCAB_MAX);
    expect(t.map((q) => q.id)).toContain('s1');
    expect(t.map((q) => q.id)).not.toContain('s3');
  });

  it('mỗi câu trắc nghiệm có đáp án nằm trong lựa chọn, không trùng lựa chọn', () => {
    const t = buildLessonTest(cards.slice(0, 6), cards, [], { rand: mulberry32(5), listen: true });
    expect(t).toHaveLength(6);
    for (const q of t) {
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
    expect(t.some((q) => q.type === 'listen' && q.speak)).toBe(true);
  });

  it('chỉ đề từ của bài, không lấy từ ngoài bài làm câu hỏi', () => {
    const lesson = cards.slice(0, 4);
    const t = buildLessonTest(lesson, cards, [], { rand: mulberry32(9) });
    for (const q of t) expect(lesson.map((c) => c.id)).toContain(q.card_ids[0]);
  });

  it('cùng hạt giống → cùng đề', () => {
    expect(buildLessonTest(cards, cards, sentences, { rand: mulberry32(1) })).toEqual(buildLessonTest(cards, cards, sentences, { rand: mulberry32(1) }));
  });
});

describe('scoreTest', () => {
  it('tính điểm và đạt/không đạt theo ngưỡng', () => {
    const r = (ok) => ({ question: {}, correct: ok });
    expect(scoreTest([r(true), r(true), r(true), r(false)], 0.7)).toMatchObject({ correct: 3, total: 4, score: 0.75, passed: true });
    expect(scoreTest([r(true), r(false)], 0.7).passed).toBe(false);
    expect(scoreTest([], 0.7).passed).toBe(false);
  });
});

describe('textQuestions (câu hỏi từ bài khóa)', () => {
  const dict = buildDictionary(['我', '是', '学生', '你', '去', '哪儿', '他', '很', '忙'].map((h, i) => ({ id: `w${i}`, hanzi: h })));
  const mk = (zh, vi) => ({ zh, vi, tokens: segmentSentence(zh.replace(/[。？！]$/, ''), dict) });
  const lines = [mk('我是学生。', 'Tôi là học sinh.'), mk('你去哪儿？', 'Bạn đi đâu?'), mk('他很忙。', 'Anh ấy rất bận.')];
  it('tạo câu sắp xếp đúng mảnh và câu chọn nghĩa có đáp án trong lựa chọn', () => {
    const qs = textQuestions(lines, { rand: mulberry32(2), max: 4 });
    const r = qs.filter((q) => q.type === 'reorder');
    expect(r.length).toBeGreaterThan(0);
    for (const q of r) expect(q.answer.join('')).toBe(lines.find((l) => q.explanation.startsWith(l.zh)).zh.replace(/[。？！]$/, ''));
    for (const q of qs.filter((x) => x.type === 'choose')) expect(q.options).toContain(q.answer);
    expect(qs.length).toBeLessThanOrEqual(4);
  });
});
