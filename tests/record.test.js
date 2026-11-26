import { describe, it, expect, vi } from 'vitest';
import { recordAnswer } from '../src/features/exercises/record.js';

describe('ghi kết quả từng câu', () => {
  const repo = () => ({ recordReview: vi.fn(async () => {}), logActivity: vi.fn(async () => {}) });
  it('câu gắn từ: ghi theo từng từ', async () => {
    const r = repo();
    await recordAnswer(r, ['a', 'b', 'a'], true, { activity: 'qa', sessionId: 's' });
    expect(r.recordReview).toHaveBeenCalledTimes(2);
    expect(r.recordReview.mock.calls[0][0]).toMatchObject({ cardId: 'a', quality: 4, activity: 'qa', mode: 'light' });
    expect(r.logActivity).not.toHaveBeenCalled();
  });
  it('câu không gắn từ (hội thoại, đọc hiểu…): vẫn ghi một lượt', async () => {
    const r = repo();
    await recordAnswer(r, [], false, { activity: 'practice-reading' });
    expect(r.logActivity).toHaveBeenCalledWith({ activity: 'practice-reading', quality: 2, sessionId: null });
  });
});
