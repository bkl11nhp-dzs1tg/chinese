import { describe, it, expect } from 'vitest';
import { dayKey, dailySeries, streak, timeTotals, cardStatusCounts, weeklyAccuracy, newLearnedToday, formatDuration } from '../src/core/stats.js';

const at = (d, h = 10) => new Date(2026, 10, d, h).getTime(); // tháng 11/2026, giờ địa phương
const sess = (d, min) => ({ started_at: at(d), active_ms: min * 60000 });

describe('stats', () => {
  it('dayKey theo giờ địa phương', () => {
    expect(dayKey(at(21, 23))).toBe('2026-11-21');
  });

  it('streak đếm ngày liên tiếp, chưa học hôm nay không mất streak', () => {
    const s = [sess(18, 10), sess(19, 5), sess(20, 15)];
    expect(streak(s, at(20, 22))).toBe(3);
    expect(streak(s, at(21, 8))).toBe(3);
    expect(streak(s, at(23, 8))).toBe(0);
    expect(streak([...s, { started_at: at(21), active_ms: 0 }], at(21, 22))).toBe(3);
  });

  it('tổng thời gian và chuỗi theo ngày', () => {
    const s = [sess(1, 30), sess(15, 10), sess(20, 15), sess(21, 20), sess(21, 5)];
    const t = timeTotals(s, at(21, 22));
    expect(t.today).toBe(25 * 60000);
    expect(t.week).toBe(50 * 60000);
    expect(t.month).toBe(80 * 60000);
    const series = dailySeries(s, at(21, 22), 7);
    expect(series).toHaveLength(7);
    expect(series.at(-1)).toEqual({ day: '2026-11-21', ms: 25 * 60000 });
  });

  it('thẻ theo trạng thái', () => {
    const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const states = new Map([
      ['b', { last_reviewed_at: 1, interval_days: 6 }],
      ['c', { last_reviewed_at: 1, interval_days: 21 }],
    ]);
    expect(cardStatusCounts(cards, states)).toEqual({ new: 1, learning: 1, mastered: 1 });
  });

  it('tỷ lệ đúng theo tuần', () => {
    const ev = [
      { created_at: at(21), quality: 5 }, { created_at: at(20), quality: 0 },
      { created_at: at(10), quality: 4 },
    ];
    const w = weeklyAccuracy(ev, at(21, 22), 2);
    expect(w[1]).toMatchObject({ total: 2, correct: 1, rate: 0.5 });
    expect(w[0]).toMatchObject({ total: 1, rate: 1 });
    expect(weeklyAccuracy([], at(21), 1)[0].rate).toBeNull();
  });

  it('số thẻ mới đã học hôm nay', () => {
    const ev = [
      { card_id: 'a', activity: 'new', created_at: at(21) },
      { card_id: 'a', activity: 'new', created_at: at(21, 11) },
      { card_id: 'b', activity: 'new', created_at: at(20) },
      { card_id: 'c', activity: 'review', created_at: at(21) },
    ];
    expect(newLearnedToday(ev, at(21, 22))).toBe(1);
  });

  it('định dạng thời lượng', () => {
    expect(formatDuration(5 * 60000)).toBe('5 phút');
    expect(formatDuration(90 * 60000)).toBe('1 giờ 30 phút');
  });
});
