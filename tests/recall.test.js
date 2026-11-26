import { describe, it, expect } from 'vitest';
import { buildRecallSet, writable } from '../src/core/recall.js';

const C = (id, hanzi, pinyin, meaning) => ({ id, hanzi, pinyin, meaning });
const words = [C('a', '你好', 'nǐ hǎo', 'xin chào'), C('b', '老师', 'lǎoshī', 'thầy giáo'), C('c', '茶', 'chá', 'trà'), C('d', 'OK吧', 'ok ba', 'được')];
const pool = [...words, C('e', '学生', 'xuésheng', 'học sinh'), C('f', '大夫', 'dàifu', 'bác sĩ'), C('g', '朋友', 'péngyou', 'bạn')];

describe('luyện nhớ chủ động', () => {
  it('chỉ lấy từ toàn chữ Hán', () => { expect(writable(words[3])).toBe(false); expect(writable(C('x', '角（毛）', 'jiǎo', 'hào'))).toBe(true); });
  it('đủ các pha theo thứ tự: xem → viết theo mẫu → tự viết → nghe viết → kiểm tra', () => {
    const set = buildRecallSet(words, { pool, reviewCards: [C('r', '大夫', 'dàifu', 'bác sĩ')], rand: () => 0.3 });
    const kinds = set.map((x) => x.type === 'draw' ? `draw:${x.mode}` : x.type);
    expect(kinds.slice(0, 2)).toEqual(['study', 'draw:trace']);
    expect(kinds.filter((k) => k === 'study').length).toBe(3);
    expect(kinds.filter((k) => k === 'draw:meaning').length).toBeGreaterThanOrEqual(3);
    expect(kinds.filter((k) => k === 'draw:listen').length).toBe(2);
    const missing = set.filter((x) => x.activity === 'recall-missing');
    expect(missing.length).toBe(2);
    for (const m of missing) { expect(m.options).toContain(m.answer); expect(m.prompt).toContain('＿'); }
    expect(set.some((x) => x.activity === 'recall-review')).toBe(true);
    // Tự viết (pha 2) chỉ cho nghĩa, không lộ chữ/pinyin trong đề
    for (const x of set.filter((y) => y.mode === 'meaning')) expect(x.prompt).not.toContain(x.hanzi);
  });
  it('độ dài theo số từ chọn, không cố định', () => {
    const many = Array.from({ length: 14 }, (_, i) => C(`w${i}`, '学生老师朋友大夫'.slice(i % 7, i % 7 + 2), 'x', `nghĩa ${i}`));
    const lens = [3, 5, 10, 14].map((k) => buildRecallSet(many, { pool, maxNew: k, rand: () => 0.4 }).length);
    for (let i = 1; i < lens.length; i++) expect(lens[i]).toBeGreaterThan(lens[i - 1]);
    expect(new Set(lens).size).toBe(4);
  });
  it('ordered: lấy đúng các từ đầu danh sách ưu tiên', () => {
    const set = buildRecallSet(words, { pool, maxNew: 1, ordered: true });
    expect(set.filter((x) => x.type === 'study').map((x) => x.hanzi)).toEqual(['你好']);
  });
  it('reps > 1: mỗi từ có một trang tập viết viết reps lần', () => {
    const set = buildRecallSet(words, { pool, reps: 10, rand: () => 0.3 });
    const sheets = set.filter((x) => x.type === 'sheet');
    expect(sheets.length).toBe(3);
    for (const x of sheets) { expect(x.reps).toBe(10); expect(x.activity).toBe('recall-copy'); }
    expect(set.some((x) => x.type === 'draw' && x.mode === 'trace')).toBe(false);
  });
});
