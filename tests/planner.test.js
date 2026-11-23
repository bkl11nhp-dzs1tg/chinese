import { describe, it, expect } from 'vitest';
import { buildPlan, ESTIMATE_SEC, MAX_REVIEWS, BUDGET_SLACK } from '../src/core/planner.js';

const NOW = 1_700_000_000_000;
const settings = { new_per_day: 10, session_minutes: 20, games_enabled: true };
const due = (n, offset = 0) => Array.from({ length: n }, (_, i) => ({ card_id: `r${i}`, due_at: NOW - (n - i) * 1000 + offset }));
const fresh = (n) => Array.from({ length: n }, (_, i) => ({ id: `n${i}`, lesson_id: 'L01' }));
const cardSteps = (p) => p.steps.filter((s) => s.type === 'review' || s.type === 'new');

describe('planner.buildPlan', () => {
  it('không có thẻ đến hạn → không có bước ôn', () => {
    const p = buildPlan({ now: NOW, settings, cardStates: [{ card_id: 'x', due_at: NOW + 1 }], newCards: fresh(3) });
    expect(p.steps.some((s) => s.type === 'review')).toBe(false);
    expect(p.counts.new).toBe(3);
  });

  it('số thẻ mới không vượt new_per_day và trừ số đã học hôm nay', () => {
    const p = buildPlan({ now: NOW, settings, newCards: fresh(30) });
    expect(p.counts.new).toBe(10);
    const p2 = buildPlan({ now: NOW, settings, newCards: fresh(30), newLearnedToday: 7 });
    expect(p2.counts.new).toBe(3);
    const p3 = buildPlan({ now: NOW, settings, newCards: fresh(30), newLearnedToday: 15 });
    expect(p3.counts.new).toBe(0);
  });

  it('thẻ đến hạn sớm hơn đi trước', () => {
    const states = [
      { card_id: 'b', due_at: NOW - 100 },
      { card_id: 'a', due_at: NOW - 500 },
      { card_id: 'c', due_at: NOW - 10 },
    ];
    const p = buildPlan({ now: NOW, settings, cardStates: states });
    expect(p.steps.filter((s) => s.type === 'review').map((s) => s.card_id)).toEqual(['a', 'b', 'c']);
  });

  it('giới hạn 40 thẻ ôn mỗi buổi', () => {
    const p = buildPlan({ now: NOW, settings: { ...settings, session_minutes: 60 }, cardStates: due(100) });
    expect(p.counts.review).toBe(MAX_REVIEWS);
    expect(p.counts.due_total).toBe(100);
  });

  it('sau mỗi 5 thẻ ôn chèn 1 thẻ mới', () => {
    const p = buildPlan({ now: NOW, settings, cardStates: due(10), newCards: fresh(3) });
    const types = cardSteps(p).map((s) => s.type);
    expect(types.slice(0, 6)).toEqual(['review', 'review', 'review', 'review', 'review', 'new']);
    expect(types.slice(6, 12)).toEqual(['review', 'review', 'review', 'review', 'review', 'new']);
    expect(types[12]).toBe('new');
  });

  it('chỉ ôn tập: không có thẻ mới và bài tập', () => {
    const p = buildPlan({ now: NOW, settings, cardStates: due(5), newCards: fresh(5), reviewOnly: true, activeLesson: { id: 'L01', exerciseCount: 8 } });
    expect(p.counts.new).toBe(0);
    expect(p.steps.some((s) => s.type === 'exercise')).toBe(false);
  });

  it('bài tập ở khoảng 2/3 buổi, trò chơi ở cuối', () => {
    const p = buildPlan({ now: NOW, settings, cardStates: due(10), newCards: fresh(2), activeLesson: { id: 'L01', exerciseCount: 8 } });
    const idx = p.steps.findIndex((s) => s.type === 'exercise');
    expect(idx).toBe(Math.round((12 * 2) / 3));
    expect(p.steps[idx].count).toBe(5);
    expect(p.steps.at(-1).type).toBe('game');
  });

  it('không có gì để học thì kế hoạch rỗng (không chèn trò chơi lẻ)', () => {
    const p = buildPlan({ now: NOW, settings, cardStates: [], newCards: [] });
    expect(p.steps).toEqual([]);
  });

  it('tổng thời gian không vượt thời lượng mục tiêu quá 20%', () => {
    for (const minutes of [5, 15, 20, 30]) {
      const p = buildPlan({
        now: NOW, settings: { ...settings, session_minutes: minutes, new_per_day: 30 },
        cardStates: due(40), newCards: fresh(30), activeLesson: { id: 'L01', exerciseCount: 10 },
      });
      expect(p.total_sec).toBeLessThanOrEqual(minutes * 60 * BUDGET_SLACK);
      expect(p.total_sec).toBe(p.steps.reduce((s, x) => s + x.est_sec, 0));
    }
  });

  it('khi thiếu thời gian, cắt thẻ mới trước thẻ ôn', () => {
    const p = buildPlan({ now: NOW, settings: { ...settings, session_minutes: 5 }, cardStates: due(20), newCards: fresh(10) });
    expect(p.counts.review).toBe(20);
    expect(p.counts.new).toBeLessThan(10);
    expect(p.counts.review * ESTIMATE_SEC.review).toBeLessThanOrEqual(5 * 60 * BUDGET_SLACK);
  });

  it('hàm thuần: cùng đầu vào cho cùng đầu ra', () => {
    const input = { now: NOW, settings, cardStates: due(12), newCards: fresh(4), activeLesson: { id: 'L01', exerciseCount: 3 } };
    expect(buildPlan(input)).toEqual(buildPlan(input));
  });
});
