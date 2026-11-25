import { describe, it, expect } from 'vitest';
import { parseLine, lyricsToParagraphs, youtubeId } from '../src/core/media.js';

describe('bài hát / thoại phim', () => {
  it('đọc mốc thời gian LRC và dạng m:ss', () => {
    expect(parseLine('[01:02.50]两只老虎')).toEqual({ text: '两只老虎', t: 62.5 });
    expect(parseLine('0:07 你好')).toEqual({ text: '你好', t: 7 });
    expect(parseLine('[00:10.00][01:10.00]副歌')).toEqual({ text: '副歌', t: 10 });
    expect(parseLine('没有时间')).toEqual({ text: '没有时间', t: null });
  });
  it('tách đoạn theo dòng trống, ghép bản dịch theo thứ tự, bỏ thẻ LRC', () => {
    const p = lyricsToParagraphs('[ti:Bài]\n[00:01]一\n[00:02]二\n\n[00:03]三', 'một\nhai\nba');
    expect(p.length).toBe(2);
    expect(p[0].sentences.map((s) => s.meaning)).toEqual(['một', 'hai']);
    expect(p[1].sentences[0]).toMatchObject({ hanzi: '三', meaning: 'ba', t: 3 });
  });
  it('tách người nói trong thoại', () => {
    const p = lyricsToParagraphs('[00:05] A：你好！\n小王: 再见', 'A: Chào!\nTạm biệt');
    expect(p[0].sentences[0]).toMatchObject({ speaker: 'A', hanzi: '你好！', meaning: 'Chào!', t: 5 });
    expect(p[0].sentences[1]).toMatchObject({ speaker: '小王', hanzi: '再见' });
  });
  it('lấy id YouTube', () => {
    for (const u of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ?t=3', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ']) expect(youtubeId(u)).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://example.com')).toBe(null);
  });
});

import { parseGoogle, translateZhVi } from '../src/core/translate.js';
describe('dịch tự động', () => {
  it('đọc kết quả Google Dịch', () => {
    expect(parseGoogle([[['bạn cùng lớp', '同学', null]], null, 'zh-CN'])).toBe('bạn cùng lớp');
    expect(parseGoogle([[['Xin chào. ', '你好。'], ['Tạm biệt', '再见']]])).toBe('Xin chào. Tạm biệt');
  });
  it('Google lỗi thì dùng MyMemory', async () => {
    const fetchImpl = async (url) => (url.includes('googleapis')
      ? new Response('x', { status: 429 })
      : new Response(JSON.stringify({ responseData: { translatedText: 'trà' } })));
    expect(await translateZhVi(`茶${Math.random()}`, { fetchImpl })).toMatchObject({ text: 'trà', source: 'MyMemory' });
  });
});
