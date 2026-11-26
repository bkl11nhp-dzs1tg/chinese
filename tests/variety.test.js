import { describe, it, expect } from 'vitest';
import { rankFresh } from '../src/core/variety.js';
import { qaPairs, qaQuestions, isQuestion, buildSkillSet } from '../src/core/practice.js';

const DAY = 86_400_000;

describe('chống lặp', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  it('từ chưa gặp đứng trước từ vừa gặp', () => {
    const now = 10 * DAY;
    const seen = { a: [now - 60_000, 5], b: [now - 3 * DAY, 1] };
    const r = rankFresh(items, seen, { now, rand: () => 0.5 }).map((x) => x.id);
    expect(r.slice(0, 2).sort()).toEqual(['c', 'd']);
    expect(r[2]).toBe('b');
    expect(r[3]).toBe('a');
  });
  it('bonus đẩy từ ưu tiên lên', () => {
    const r = rankFresh(items, {}, { rand: () => 0.5, bonus: (x) => (x.id === 'd' ? 5 : 0) });
    expect(r[0].id).toBe('d');
  });
  it('buildSkillSet dùng thứ tự ưu tiên được truyền vào', () => {
    const cards = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, hanzi: `字${i}`, pinyin: 'zì', meaning: `nghĩa ${i}` }));
    const order = (arr) => [...arr].sort((x, y) => Number(y.id.slice(1)) - Number(x.id.slice(1)));
    const set = buildSkillSet('typing', { cards, n: 5, order });
    expect(set.flatMap((q) => q.card_ids).sort()).toEqual(['c25', 'c26', 'c27', 'c28', 'c29']);
  });
});

describe('hỏi đáp', () => {
  const texts = [{ lines: [
    { speaker: 'A', zh: '你忙吗？', vi: 'Bạn bận không?' },
    { speaker: 'B', zh: '我很忙。', vi: 'Tôi rất bận.' },
    { speaker: 'A', zh: '你去哪儿？', vi: 'Bạn đi đâu?' },
    { speaker: 'B', zh: '我去银行。', vi: 'Tôi đi ngân hàng.' },
    { speaker: 'B', zh: '你呢？', vi: 'Còn bạn?' },
    { speaker: 'B', zh: '我也去。', vi: 'Tôi cũng đi.' },
    { speaker: 'A', zh: '他是谁？', vi: 'Anh ấy là ai?' },
    { speaker: 'B', zh: '他是老师。', vi: 'Anh ấy là thầy giáo.' },
  ] }];
  it('nhận câu hỏi', () => {
    expect(isQuestion('你好吗？')).toBe(true);
    expect(isQuestion('我很好。')).toBe(false);
  });
  it('ghép câu hỏi với câu trả lời của người khác', () => {
    const p = qaPairs(texts);
    expect(p.map((x) => x.q.zh)).toEqual(['你忙吗？', '你去哪儿？', '他是谁？']);
  });
  it('câu hỏi có đáp án trong phương án và xen câu hỏi về từ', () => {
    const words = [
      { id: 1, hanzi: '老师', pinyin: 'lǎoshī', meaning: 'thầy giáo' }, { id: 2, hanzi: '银行', pinyin: 'yínháng', meaning: 'ngân hàng' },
      { id: 3, hanzi: '忙', pinyin: 'máng', meaning: 'bận' }, { id: 4, hanzi: '去', pinyin: 'qù', meaning: 'đi' },
    ];
    const qs = qaQuestions(qaPairs(texts), { words, n: 6, rand: () => 0.3 });
    expect(qs.length).toBeGreaterThanOrEqual(5);
    for (const q of qs) {
      expect(q.qa).toBeTruthy();
      if (q.type !== 'reorder') expect(q.options).toContain(q.answer);
    }
    expect(qs.some((q) => q.qa.q.zh.includes('什么意思') || q.qa.q.zh.includes('怎么说'))).toBe(true);
  });
});
