import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIds, leaves, describeChar, buildComposeChars } from '../src/core/decomp.js';

const data = JSON.parse(readFileSync('data/decomp.json', 'utf8'));

describe('cấu tạo chữ', () => {
  it('đọc mã IDS', () => {
    expect(parseIds('⿰亻尔')).toEqual({ op: '⿰', parts: ['亻', '尔'] });
    expect(parseIds('⿱⿱⺍冖子')).toEqual({ op: '⿱', parts: ['⿱⺍冖', '子'] });
    expect(leaves('⿱⿱⺍冖子')).toEqual(['⺍', '冖', '子']);
  });
  it('mô tả chữ hình thanh 妈: 女 chỉ nghĩa, 马 gợi âm', () => {
    const d = describeChar('妈', data);
    expect(d.struct).toBe('trái – phải');
    expect(d.type).toBe('Hình thanh');
    expect(d.parts.find((p) => p.ch === '女')).toMatchObject({ role: 'nghĩa', isRadical: true });
    expect(d.parts.find((p) => p.ch === '马').role).toBe('âm');
    expect(d.radical.name).toContain('Nữ');
  });
  it('bài ghép thành phần có đáp án trong lựa chọn', () => {
    const qs = buildComposeChars([{ id: 'a', hanzi: '妈妈', pinyin: 'māma', meaning: 'mẹ' }, { id: 'b', hanzi: '你好', pinyin: 'nǐhǎo', meaning: 'xin chào' }], data, { rand: () => 0.4 });
    expect(qs.length).toBe(2);
    for (const q of qs) { expect(q.options).toContain(q.answer); expect(q.options.length).toBe(4); expect(new Set(q.options).size).toBe(4); }
  });
});
