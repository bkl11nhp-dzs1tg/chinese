import { describe, it, expect } from 'vitest';
import { parseVocabCsv, parseContentJson, loadContentFiles, planMerge, buildPack, validateContent } from '../src/core/importer.js';

const HEADER = 'id,hanzi,pinyin,meaning,hsk_level,lesson_id,example,example_pinyin,example_meaning,tags';

describe('parseVocabCsv', () => {
  it('đọc đúng chữ Hán, dấu bính âm, tag, ô có dấu phẩy trong ngoặc kép', () => {
    const csv = `﻿${HEADER}\r\nv-1,你好,nǐ hǎo,"xin chào, chào bạn",1,L01,你好！,Nǐ hǎo!,Xin chào!,chào hỏi;cơ bản\r\n`;
    const r = parseVocabCsv(csv, 'a.csv');
    expect(r.errors).toEqual([]);
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]).toMatchObject({ id: 'v-1', hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'xin chào, chào bạn', hsk_level: 1, tags: ['chào hỏi', 'cơ bản'] });
  });

  it('chuẩn hóa NFC (dấu tổ hợp → dấu dựng sẵn)', () => {
    const decomposed = 'nǐ'; // "nǐ" viết bằng dấu tổ hợp
    const r = parseVocabCsv(`${HEADER}\nv-1,你,${decomposed},bạn,,,,,,\n`);
    expect(r.cards[0].pinyin).toBe('nǐ');
  });

  it('thiếu cột bắt buộc → lỗi, không trả thẻ', () => {
    const r = parseVocabCsv('id,hanzi,meaning\nv-1,你,bạn\n');
    expect(r.cards).toEqual([]);
    expect(r.errors[0].message).toMatch(/pinyin/);
  });

  it('dòng thiếu hanzi/pinyin/meaning → lỗi có số dòng', () => {
    const r = parseVocabCsv(`${HEADER}\nv-1,你,nǐ,bạn,,,,,,\nv-2,,hǎo,tốt,,,,,,\n`);
    expect(r.cards).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].line).toBe(3);
  });

  it('hsk_level ngoài 1–6 hoặc không phải số nguyên → lỗi', () => {
    const r = parseVocabCsv(`${HEADER}\nv-1,你,nǐ,bạn,7,,,,,\nv-2,好,hǎo,tốt,abc,,,,,\nv-3,是,shì,là,2.5,,,,,\nv-4,我,wǒ,tôi,6,,,,,\n`);
    expect(r.errors).toHaveLength(3);
    expect(r.cards.map((c) => c.id)).toEqual(['v-4']);
  });

  it('bỏ qua dòng trống', () => {
    const r = parseVocabCsv(`${HEADER}\n\n,,,,,,,,,\nv-1,你,nǐ,bạn,,,,,,\n\n`);
    expect(r.errors).toEqual([]);
    expect(r.cards).toHaveLength(1);
  });

  it('file rỗng → lỗi', () => {
    expect(parseVocabCsv('').errors).toHaveLength(1);
  });
});

describe('parseContentJson', () => {
  const lesson = {
    id: 'L01', book: 'Hán ngữ 1', unit: 1, order: 1, title: '你好',
    exercises: [
      { id: 'e1', type: 'choose', prompt: '?', options: ['A', 'B'], answer: 'B' },
      { id: 'e2', type: 'choose', prompt: '?', options: ['A', 'B'], answer: 'Z' },
      { id: 'e3', type: 'fill', prompt: '我__学生', answer: '是' },
      { id: 'e4', type: 'reorder', options: ['学生', '我', '是'], answer: ['我', '是', '学生'] },
      { id: 'e5', type: 'reorder', options: ['学生', '我'], answer: '我是学生' },
      { id: 'e6', type: 'match', pairs: [{ left: '你', right: 'bạn' }, { left: '好', right: 'tốt' }] },
      { id: 'e7', type: 'speak', prompt: 'x' },
    ],
  };

  it('answer không nằm trong options → lỗi; reorder sai mảnh → lỗi; dạng lạ → lỗi', () => {
    const r = parseContentJson(JSON.stringify(lesson), 'L01.json');
    expect(r.lessons).toHaveLength(1);
    expect(r.exercises.map((e) => e.id)).toEqual(['e1', 'e3', 'e4', 'e6']);
    expect(r.errors).toHaveLength(3);
  });

  it('JSON hỏng → lỗi', () => {
    expect(parseContentJson('{', 'x.json').errors[0].message).toMatch(/JSON/);
  });

  it('đọc được gói {cards, lessons}', () => {
    const pack = { format: 'chinese-study-pack', cards: [{ id: 'v-1', hanzi: '你', pinyin: 'nǐ', meaning: 'bạn', lesson_id: 'L01' }], lessons: [{ id: 'L01', title: 'x' }] };
    const r = parseContentJson(pack);
    expect(r.cards).toHaveLength(1);
    expect(r.lessons).toHaveLength(1);
  });
});

describe('loadContentFiles + validateContent', () => {
  it('id trùng → lỗi; lesson_id không tồn tại → cảnh báo; tự nối vocab_ids', () => {
    const csv = `${HEADER}\nv-1,你,nǐ,bạn,1,L01,,,,\nv-2,好,hǎo,tốt,1,L01,,,,\nv-2,好,hǎo,tốt,1,L01,,,,\nv-3,是,shì,là,1,L99,,,,\n`;
    const r = loadContentFiles([
      { name: 'v.csv', text: csv },
      { name: 'L01.json', text: JSON.stringify({ id: 'L01', title: 'Bài 1' }) },
      { name: 'note.txt', text: '' },
    ]);
    expect(r.errors.some((e) => /trùng: v-2/.test(e.message))).toBe(true);
    expect(r.warnings.some((w) => /L99/.test(w.message))).toBe(true);
    expect(r.warnings.some((w) => /note\.txt/.test(w.source))).toBe(true);
    expect(r.lessons[0].vocab_ids).toEqual(['v-1', 'v-2']);
    expect(r.counts).toEqual({ cards: 4, lessons: 1, exercises: 0, readings: 0 });
  });

  it('vocab_ids trỏ tới từ không có → cảnh báo', () => {
    const v = validateContent({ cards: [], lessons: [{ id: 'L1', vocab_ids: ['zz'] }], exercises: [] });
    expect(v.warnings).toHaveLength(1);
  });
});

describe('planMerge / buildPack', () => {
  it('đếm mục mới và mục cập nhật', () => {
    const m = planMerge({ cardIds: ['v-1'], lessonIds: [], exerciseIds: [] }, { cards: [{ id: 'v-1' }, { id: 'v-2' }], lessons: [{ id: 'L1' }], exercises: [] });
    expect(m.cards).toEqual({ added: 1, updated: 1 });
    expect(m.lessons).toEqual({ added: 1, updated: 0 });
  });

  it('gói nội dung đọc lại được y như cũ', () => {
    const src = loadContentFiles([
      { name: 'v.csv', text: `${HEADER}\nv-1,你,nǐ,bạn,1,L01,,,,\nv-2,好,hǎo,tốt,1,L01,,,,\n` },
      { name: 'L01.json', text: JSON.stringify({ id: 'L01', title: 'B1', exercises: [{ id: 'e1', type: 'match', pairs: [{ left: '你', right: 'bạn' }, { left: '好', right: 'tốt' }] }] }) },
    ]);
    const pack = buildPack(src);
    const again = loadContentFiles([{ name: 'pack.json', text: JSON.stringify(pack) }]);
    expect(again.errors).toEqual([]);
    expect(again.cards).toEqual(src.cards);
    expect(again.exercises).toEqual(src.exercises);
  });
});

describe('bài đọc (readings)', () => {
  const reading = {
    id: 'R1', title: 'Thử', level: 1, source: 'tự viết', audio: { file: 'a.mp3' },
    paragraphs: [{ id: 'p1', sentences: [
      { id: 's1', hanzi: '我吃饭。', meaning: 'Tôi ăn cơm.', audio_ms: { start: 0, end: 900 }, tokens: [{ text: '我', start: 0, end: 1 }] },
      { id: 's2', hanzi: '你好。' },
    ] }],
  };
  it('đọc đúng định dạng d.2', () => {
    const r = loadContentFiles([{ name: 'R1.json', text: JSON.stringify(reading) }]);
    expect(r.errors).toEqual([]);
    expect(r.readings).toHaveLength(1);
    expect(r.readings[0]).toMatchObject({ id: 'R1', audio_file: 'a.mp3', level: 1 });
    expect(r.readings[0].paragraphs[0].sentences[0].audio_ms).toEqual({ start: 0, end: 900 });
  });
  it('báo lỗi: câu rỗng, audio_ms ngược, tokens vượt độ dài, id trùng', () => {
    const bad = JSON.parse(JSON.stringify(reading));
    bad.paragraphs[0].sentences.push({ id: 's3', hanzi: '' });
    bad.paragraphs[0].sentences[0].audio_ms = { start: 500, end: 100 };
    bad.paragraphs[0].sentences[1].tokens = [{ start: 0, end: 9 }];
    const r = loadContentFiles([{ name: 'a.json', text: JSON.stringify(bad) }, { name: 'b.json', text: JSON.stringify(reading) }, { name: 'c.json', text: JSON.stringify(reading) }]);
    const msgs = r.errors.map((e) => e.message).join('\n');
    expect(msgs).toMatch(/Câu rỗng/);
    expect(msgs).toMatch(/audio_ms/);
    expect(msgs).toMatch(/tokens/);
    expect(msgs).toMatch(/trùng: R1/);
  });
  it('bài khóa và ngữ pháp trong bài học được giữ lại', () => {
    const lesson = { id: 'L1', title: 'x', texts: [{ title: 'A', lines: [{ speaker: 'A', zh: '你好！', vi: 'Xin chào!' }] }],
      grammar_points: [{ title: 'G', note: 'n', examples: [{ zh: '你好', vi: 'chào' }] }] };
    const r = loadContentFiles([{ name: 'L1.json', text: JSON.stringify(lesson) }]);
    expect(r.lessons[0].texts[0].lines[0]).toMatchObject({ speaker: 'A', zh: '你好！' });
    expect(r.lessons[0].grammar_points[0]).toMatchObject({ title: 'G', examples: [{ zh: '你好', vi: 'chào' }] });
  });
});
