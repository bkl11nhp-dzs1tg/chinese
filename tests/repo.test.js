import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, createRepo } from '../src/db/repo.js';
import { DAY_MS } from '../src/core/srs.js';

const T0 = 1_700_000_000_000;
let repo;
let n = 0;

beforeEach(async () => {
  repo = createRepo(await openDb({ name: `test-${n++}` }));
});

const card = (id, extra = {}) => ({ id, hanzi: '你', pinyin: 'nǐ', meaning: 'bạn', lesson_id: 'L01', tags: [], ...extra });

describe('repo', () => {
  it('cài đặt có giá trị mặc định và lưu được', async () => {
    expect((await repo.getSettings()).new_per_day).toBe(10);
    const s = await repo.saveSettings({ new_per_day: 15 });
    expect(s.new_per_day).toBe(15);
    expect(s.session_minutes).toBe(20);
  });

  it('chấm thẻ cập nhật due_at và ghi review_event', async () => {
    await repo.importContent({ cards: [card('v1')], lessons: [], exercises: [] });
    const { state } = await repo.recordReview({ cardId: 'v1', quality: 5, activity: 'new', now: T0 });
    expect(state.due_at).toBe(T0 + DAY_MS);
    expect((await repo.get('card_state', 'v1')).due_at).toBe(T0 + DAY_MS);
    expect(await repo.count('review_events')).toBe(1);
  });

  it("mode 'none' chỉ ghi sự kiện; 'light' không tạo trạng thái cho thẻ chưa học", async () => {
    await repo.recordReview({ cardId: 'v1', quality: 0, activity: 'relearn', now: T0, mode: 'none' });
    await repo.recordReview({ cardId: 'v1', quality: 5, activity: 'game', now: T0, mode: 'light' });
    expect(await repo.get('card_state', 'v1')).toBeUndefined();
    expect(await repo.count('review_events')).toBe(2);
  });

  it('nạp lại nội dung giữ nguyên card_state và lesson_progress', async () => {
    await repo.importContent({ cards: [card('v1')], lessons: [{ id: 'L01', title: 'a', order: 1, vocab_ids: ['v1'] }], exercises: [] });
    await repo.recordReview({ cardId: 'v1', quality: 4, activity: 'new', now: T0 });
    await repo.saveLessonScore('L01', 0.8, T0);
    await repo.importContent({ cards: [card('v1', { meaning: 'bạn (sửa)' })], lessons: [{ id: 'L01', title: 'b', order: 1, vocab_ids: [] }], exercises: [] });
    expect((await repo.get('cards', 'v1')).meaning).toBe('bạn (sửa)');
    expect((await repo.get('lessons', 'L01')).vocab_ids).toEqual(['v1']);
    expect((await repo.get('card_state', 'v1')).repetitions).toBe(1);
    expect((await repo.get('lesson_progress', 'L01')).best_score).toBe(0.8);
  });

  it('điểm bài giữ mức cao nhất', async () => {
    await repo.saveLessonScore('L01', 0.9, T0);
    const p = await repo.saveLessonScore('L01', 0.5, T0);
    expect(p).toMatchObject({ best_score: 0.9, attempts: 2, status: 'doing' });
  });

  it('điểm kiểm tra cuối bài giữ mức cao nhất, đếm số lần', async () => {
    await repo.saveTestScore('L01', 0.8, T0);
    const p = await repo.saveTestScore('L01', 0.4, T0);
    expect(p).toMatchObject({ test_best: 0.8, test_last: 0.4, test_attempts: 2 });
  });

  it('makeDue đưa thẻ đã học về hạn ngay', async () => {
    await repo.recordReview({ cardId: 'v1', quality: 5, activity: 'new', now: T0 });
    await repo.makeDue(['v1', 'khong-co'], T0 + 5);
    expect((await repo.get('card_state', 'v1')).due_at).toBe(T0 + 5);
  });

  it('xuất rồi khôi phục giữ đủ dữ liệu; xóa toàn bộ làm rỗng', async () => {
    await repo.importContent({ cards: [card('v1')], lessons: [], exercises: [] });
    await repo.recordReview({ cardId: 'v1', quality: 5, activity: 'new', now: T0 });
    await repo.saveSettings({ new_per_day: 7 });
    const backup = await repo.exportAll(T0);
    for (const k of ['cards', 'card_state', 'review_events', 'lessons', 'settings']) expect(backup).toHaveProperty(k);
    await repo.clearAll();
    expect(await repo.count('cards')).toBe(0);
    await repo.restoreBackup(JSON.parse(JSON.stringify(backup)));
    expect(await repo.count('cards')).toBe(1);
    expect((await repo.getSettings()).new_per_day).toBe(7);
    await expect(repo.restoreBackup({})).rejects.toThrow();
  });
});

describe('repo – bài đọc', () => {
  it('lưu vị trí đọc, đếm số lần tra, lưu từ mới thành thẻ, đánh dấu đã biết', async () => {
    await repo.importContent({ readings: [{ id: 'R1', title: 't', paragraphs: [] }] });
    expect(await repo.get('readings', 'R1')).toBeTruthy();
    await repo.saveReadingProgress('R1', { last_sentence_index: 3 });
    await repo.recordLookup({ word: '学校', readingId: 'R1', sentenceIndex: 3 });
    await repo.recordLookup({ word: '学校', readingId: 'R1', sentenceIndex: 4 });
    const p = await repo.get('reading_progress', 'R1');
    expect(p).toMatchObject({ last_sentence_index: 3, lookups: 2 });
    expect(await repo.lookupCount('学校')).toBe(2);
    const c = await repo.saveReadingWord({ hanzi: '学校', pinyin: 'xuéxiào', meaning: 'trường học', readingId: 'R1', sentenceIndex: 3 });
    expect(c).toMatchObject({ id: 'RD-学校', source: 'reading', reading_id: 'R1', lesson_id: null });
    expect(await repo.get('card_state', 'RD-学校')).toBeUndefined(); // thẻ mới, chưa học
    await repo.markKnown('你好');
    expect(await repo.get('known_words', '你好')).toBeTruthy();
  });
});

describe('repo – hoàn tác lần chấm', () => {
  it('undoReview khôi phục trạng thái và xóa sự kiện', async () => {
    const a = await repo.recordReview({ cardId: 'u1', quality: 4, activity: 'new', now: T0 });
    const b = await repo.recordReview({ cardId: 'u1', quality: 5, activity: 'review', now: T0 + DAY_MS, mode: 'mastered' });
    expect(b.state.interval_days).toBeGreaterThanOrEqual(21);
    await repo.undoReview({ cardId: 'u1', previous: b.previous, eventId: b.event.id });
    expect((await repo.get('card_state', 'u1')).interval_days).toBe(a.state.interval_days);
    await repo.undoReview({ cardId: 'u1', previous: a.previous, eventId: a.event.id });
    expect(await repo.get('card_state', 'u1')).toBeUndefined();
    expect(await repo.count('review_events')).toBe(0);
  });
});
