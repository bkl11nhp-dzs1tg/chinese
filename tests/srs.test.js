import { describe, it, expect } from 'vitest';
import { newCardState, review, isDue, DAY_MS, MIN_EASE } from '../src/core/srs.js';

const T0 = 1_700_000_000_000; // thời điểm cố định để test lặp lại được

describe('srs.review', () => {
  it('thẻ mới trả lời q=5 ba lần: khoảng cách 1, 6, rồi tăng theo ease', () => {
    let s = newCardState('c1', T0);
    s = review(s, 5, T0);
    expect(s.interval_days).toBe(1);
    expect(s.repetitions).toBe(1);

    s = review(s, 5, T0 + DAY_MS);
    expect(s.interval_days).toBe(6);
    expect(s.repetitions).toBe(2);

    const easeBefore = s.ease;
    s = review(s, 5, T0 + 7 * DAY_MS);
    expect(s.interval_days).toBe(Math.round(6 * easeBefore));
    expect(s.repetitions).toBe(3);
  });

  it('q=0 đặt repetitions về 0, interval về 1 và tăng lapses', () => {
    let s = newCardState('c1', T0);
    s = review(s, 5, T0);
    s = review(s, 5, T0);
    s = review(s, 0, T0);
    expect(s.repetitions).toBe(0);
    expect(s.interval_days).toBe(1);
    expect(s.lapses).toBe(1);
  });

  it('ease không bao giờ xuống dưới 1.3', () => {
    let s = newCardState('c1', T0);
    for (let i = 0; i < 50; i++) s = review(s, 0, T0);
    expect(s.ease).toBeGreaterThanOrEqual(MIN_EASE);
    expect(s.ease).toBe(MIN_EASE);
  });

  it('due_at = now + interval_days × 24h', () => {
    const s = review(newCardState('c1', T0), 4, T0);
    expect(s.due_at).toBe(T0 + s.interval_days * DAY_MS);
    expect(s.last_reviewed_at).toBe(T0);
  });

  it('không sửa đối tượng đầu vào (hàm thuần)', () => {
    const s = newCardState('c1', T0);
    const snapshot = JSON.stringify(s);
    review(s, 5, T0);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('cùng đầu vào luôn cho cùng đầu ra', () => {
    const a = review(newCardState('c1', T0), 4, T0);
    const b = review(newCardState('c1', T0), 4, T0);
    expect(a).toEqual(b);
  });

  it('quality ngoài 0..5 hoặc không phải số nguyên thì báo lỗi', () => {
    const s = newCardState('c1', T0);
    expect(() => review(s, 6, T0)).toThrow(RangeError);
    expect(() => review(s, -1, T0)).toThrow(RangeError);
    expect(() => review(s, 2.5, T0)).toThrow(RangeError);
  });
});

describe('srs.isDue', () => {
  it('thẻ đến hạn khi due_at <= now', () => {
    const s = newCardState('c1', T0);
    expect(isDue(s, T0)).toBe(true);
    expect(isDue(s, T0 - 1)).toBe(false);
  });
});
