import { describe, it, expect } from 'vitest';
import { newCardState, review, reviewLight, cardStatus, DAY_MS } from '../src/core/srs.js';

const T0 = 1_700_000_000_000;

describe('srs.reviewLight (trò chơi, nửa hệ số)', () => {
  it('thẻ chưa học không bị ảnh hưởng', () => {
    const s = newCardState('c1', T0);
    expect(reviewLight(s, 5, T0)).toEqual(s);
  });

  it('ảnh hưởng bằng nửa so với review đầy đủ', () => {
    let s = review(newCardState('c1', T0), 5, T0);
    s = review(s, 5, T0 + DAY_MS); // interval 6
    const full = review(s, 0, T0 + 7 * DAY_MS); // interval 1
    const light = reviewLight(s, 0, T0 + 7 * DAY_MS);
    expect(light.interval_days).toBe(Math.round((6 + full.interval_days) / 2));
    expect(light.repetitions).toBe(s.repetitions);
    expect(light.lapses).toBe(s.lapses);
    expect(light.ease).toBeCloseTo((s.ease + full.ease) / 2);
    expect(light.due_at).toBe(T0 + 7 * DAY_MS + light.interval_days * DAY_MS);
  });

  it('trạng thái thẻ: new / learning / mastered', () => {
    expect(cardStatus(undefined)).toBe('new');
    expect(cardStatus({ last_reviewed_at: 1, interval_days: 3 })).toBe('learning');
    expect(cardStatus({ last_reviewed_at: 1, interval_days: 21 })).toBe('mastered');
  });
});

import { markMastered, MASTERED_DAYS } from '../src/core/srs.js';
describe('srs.markMastered (Đã thuộc)', () => {
  it('thẻ mới đánh dấu đã thuộc → khoảng ôn ≥ 21 ngày, trạng thái mastered', () => {
    const s = markMastered(newCardState('c', T0), T0);
    expect(s.interval_days).toBeGreaterThanOrEqual(MASTERED_DAYS);
    expect(cardStatus(s)).toBe('mastered');
    expect(s.due_at).toBe(T0 + s.interval_days * DAY_MS);
  });
});
