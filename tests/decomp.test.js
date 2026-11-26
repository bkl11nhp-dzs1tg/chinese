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

describe('âm Hán Việt và tách âm tiết', async () => {
  const { numberedPinyin, hanViet, splitSyllables, cleanMeaning } = await import('../src/core/decomp.js');
  const data = {
    健: { py: 'jiàn', hv: { '*': ['kiện'] } },
    康: { py: 'kāng', hv: { kang1: ['khang'] } },
    行: { py: 'xíng', hv: { hang2: ['hàng', 'hạng'], xing2: ['hành', 'hạnh'] } },
    银: { py: 'yín', hv: { yin2: ['ngân'] } },
    爸: { py: 'bà', hv: { ba4: ['bả'] } },
    绿: { py: 'lǜ', hv: { lv4: ['lục'] } },
  };
  it('đổi pinyin có dấu sang dạng số', () => {
    expect(numberedPinyin('jiàn')).toBe('jian4');
    expect(numberedPinyin('lǜ')).toBe('lv4');
    expect(numberedPinyin('ba')).toBe('ba5');
  });
  it('chọn âm Hán Việt theo cách đọc', () => {
    expect(hanViet('健', data)).toBe('kiện');
    expect(hanViet('行', data, 'háng')).toBe('hàng');
    expect(hanViet('行', data, 'xíng')).toBe('hành');
    expect(hanViet('行', data)).toBe('hành');
    expect(hanViet('X', data)).toBe('');
  });
  it('tách pinyin viết liền theo chữ', () => {
    expect(splitSyllables('jiànkāng', ['健', '康'], data)).toEqual(['jiàn', 'kāng']);
    expect(splitSyllables('yínháng', ['银', '行'], data)).toEqual(['yín', 'háng']);
    expect(splitSyllables('bàba', ['爸', '爸'], data)).toEqual(['bà', 'ba']);
    expect(splitSyllables('jiàn kāng', ['健', '康'], data)).toEqual(['jiàn', 'kāng']);
    expect(splitSyllables('abc', ['健', '康'], data)).toEqual([]);
  });
  it('bỏ nghĩa lặp', () => {
    expect(cleanMeaning('khỏe mạnh, cường tráng, khỏe mạnh')).toBe('khỏe mạnh, cường tráng');
    expect(cleanMeaning('không, không, không-')).toBe('không');
  });
});
