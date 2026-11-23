import { describe, it, expect } from 'vitest';
import { sessionXp, streaksOfFive } from '../src/core/xp.js';

describe('xp', () => {
  it('đếm chuỗi 5 câu đúng liên tiếp', () => {
    expect(streaksOfFive([1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map(Boolean))).toBe(2);
    expect(streaksOfFive([1, 1, 1, 1, 0, 1, 1, 1, 1, 1].map(Boolean))).toBe(1);
  });
  it('1 XP mỗi 5 phút, +2 mỗi bài xong, thưởng chuỗi tối đa 3, giới hạn ngày', () => {
    expect(sessionXp({ activeMs: 20 * 60000 })).toBe(4);
    expect(sessionXp({ activeMs: 20 * 60000, lessonsCompleted: 1 })).toBe(6);
    expect(sessionXp({ results: Array(40).fill(true) })).toBe(3);
    expect(sessionXp({ activeMs: 600 * 60000, earnedToday: 50 })).toBe(10);
    expect(sessionXp({ activeMs: 600 * 60000, earnedToday: 70 })).toBe(0);
  });
});
