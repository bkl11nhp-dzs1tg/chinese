import { describe, it, expect } from 'vitest';
import { lessonStatus, pickActiveLesson, newCardQueue, sortLessons } from '../src/core/lessons.js';

const L = (id, order, vocab, book = 'Hán ngữ 1') => ({ id, order, book, vocab_ids: vocab });
const S = { last_reviewed_at: 1, interval_days: 1 };

describe('lessons', () => {
  it('trạng thái bài: chưa / đang / xong khi đạt kiểm tra cuối bài (70%)', () => {
    const l = L('L1', 1, ['a', 'b']);
    expect(lessonStatus(l, new Map(), null).status).toBe('todo');
    expect(lessonStatus(l, new Map([['a', S]]), null).status).toBe('doing');
    expect(lessonStatus(l, new Map(), { attempts: 1, best_score: 1 }).status).toBe('doing');
    expect(lessonStatus(l, new Map(), { test_attempts: 1, test_best: 0.6 }).status).toBe('doing');
    expect(lessonStatus(l, new Map(), { test_attempts: 1, test_best: 0.7 }).status).toBe('done');
    expect(lessonStatus(L('L0', 0, []), new Map(), { attempts: 1 }).status).toBe('done');
  });

  it('sắp bài theo sách rồi thứ tự', () => {
    const ls = sortLessons([L('b', 2, []), L('x', 1, [], 'Hán ngữ 2'), L('a', 1, [])]);
    expect(ls.map((l) => l.id)).toEqual(['a', 'b', 'x']);
  });

  it('bài đang học: ưu tiên bài được chọn nếu chưa xong', () => {
    const ls = [L('L1', 1, []), L('L2', 2, []), L('L3', 3, [])];
    const st = new Map([['L1', { status: 'done' }], ['L2', { status: 'todo' }], ['L3', { status: 'doing' }]]);
    expect(pickActiveLesson(ls, st).id).toBe('L3');
    expect(pickActiveLesson(ls, st, 'L2').id).toBe('L2');
    // Bài đã chọn vẫn giữ dù đã xong (người học tự bấm sang bài sau).
    expect(pickActiveLesson(ls, st, 'L1').id).toBe('L1');
    expect(pickActiveLesson(ls, st, 'Lx').id).toBe('L3');
  });

  it('hàng đợi từ mới bắt đầu từ bài đang học, bỏ thẻ đã học', () => {
    const ls = [L('L1', 1, ['a', 'b']), L('L2', 2, ['c', 'd'])];
    const cards = new Map(['a', 'b', 'c', 'd'].map((id) => [id, { id, lesson_id: id < 'c' ? 'L1' : 'L2' }]));
    cards.set('z', { id: 'z', lesson_id: null });
    const states = new Map([['c', S]]);
    expect(newCardQueue(ls, cards, states, 'L2').map((c) => c.id)).toEqual(['d', 'a', 'b', 'z']);
    expect(newCardQueue(ls, cards, states).map((c) => c.id)).toEqual(['a', 'b', 'd', 'z']);
    cards.set('r', { id: 'r', lesson_id: null, source: 'reading' });
    expect(newCardQueue(ls, cards, states, 'L2')[0].id).toBe('r');
  });
});
