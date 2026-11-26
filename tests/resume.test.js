import { describe, it, expect, beforeEach } from 'vitest';
import { loadResume, saveResume, clearResume } from '../src/features/exercises/resume.js';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

describe('lưu bài đang làm dở', () => {
  beforeEach(() => store.clear());
  const exercises = [{ id: 'a', type: 'choose' }, { id: 'b', type: 'match' }, { id: 'c', type: 'draw' }];
  it('lưu và khôi phục vị trí, kết quả; câu hỏi trỏ lại đúng phần tử danh sách', () => {
    const results = [{ question: exercises[0], correct: true, response: 'x' }, { question: exercises[1], correct: false, response: new Map([['你', 'bạn']]) }];
    saveResume('t', { exercises, i: 2, results, meta: { mode: 'drill' } });
    const r = loadResume('t');
    expect(r.i).toBe(2);
    expect(r.meta.mode).toBe('drill');
    expect(r.results[1].question).toBe(r.exercises[1]);
    expect(r.results[1].response).toEqual({ 你: 'bạn' });
  });
  it('chưa làm câu nào thì không lưu; xong hoặc xóa thì hết', () => {
    saveResume('t', { exercises, i: 0, results: [] });
    expect(loadResume('t')).toBeNull();
    saveResume('t', { exercises, i: 1, results: [] });
    clearResume('t');
    expect(loadResume('t')).toBeNull();
  });
  it('bỏ bản lưu quá cũ', () => {
    saveResume('t', { exercises, i: 1, results: [] }, 0);
    expect(loadResume('t', 30 * 86_400_000)).toBeNull();
  });
});
