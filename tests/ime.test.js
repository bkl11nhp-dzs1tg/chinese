import { describe, it, expect } from 'vitest';
import { normPinyin, buildIme } from '../src/core/ime.js';

describe('bộ gõ pinyin', () => {
  it('chuẩn hóa pinyin có dấu', () => {
    expect(normPinyin('nǐ hǎo')).toEqual({ plain: 'nihao', toned: 'ni3hao3' });
    expect(normPinyin('lǜshī')).toEqual({ plain: 'lvshi', toned: 'lvshi1' });
  });
  it('gõ không dấu, có số thanh, gõ dở', () => {
    const ime = buildIme([
      { hanzi: '你好', pinyin: 'nǐ hǎo', weight: 5 }, { hanzi: '你', pinyin: 'nǐ', weight: 5 }, { hanzi: '呢', pinyin: 'ne' },
      { hanzi: '泥', pinyin: 'ní' }, { hanzi: '女', pinyin: 'nǚ' }, { hanzi: '老师', pinyin: 'lǎoshī' },
    ]);
    expect(ime.lookup('nihao')[0]).toBe('你好');
    expect(ime.lookup('ni')).toEqual(expect.arrayContaining(['你', '泥']));
    expect(ime.lookup('ni3')).toContain('你');
    expect(ime.lookup('ni3')).not.toContain('泥');
    expect(ime.lookup('nv')).toEqual(['女']);
    expect(ime.lookup('laos')).toEqual(['老师']);
  });
});
