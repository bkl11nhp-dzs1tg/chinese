import { describe, it, expect } from 'vitest';
import { createTimer } from '../src/core/timer.js';

const S = 1000;
const MIN = 60 * S;

describe('timer', () => {
  it('đếm khi đang học và tab hiện', () => {
    const t = createTimer({ clock: () => 0 });
    t.start(0);
    t.activity(30 * S);
    expect(t.activeMs(60 * S)).toBe(60 * S);
    t.stop(90 * S);
    expect(t.activeMs(500 * S)).toBe(90 * S);
  });

  it('tab ẩn thì tạm dừng, hiện lại thì đếm tiếp', () => {
    const t = createTimer();
    t.start(0);
    t.setVisible(false, 20 * S);
    t.setVisible(true, 5 * MIN);
    t.stop(5 * MIN + 10 * S);
    expect(t.activeMs(10 * MIN)).toBe(30 * S);
  });

  it('không tương tác quá 2 phút → dừng, chỉ tính đến lần tương tác cuối', () => {
    const t = createTimer();
    t.start(0);
    t.activity(40 * S);
    t.check(3 * MIN); // idle 2 phút 20 giây
    expect(t.idle).toBe(true);
    expect(t.activeMs(3 * MIN)).toBe(40 * S);
    t.activity(10 * MIN); // quay lại
    t.stop(10 * MIN + 20 * S);
    expect(t.activeMs(11 * MIN)).toBe(60 * S);
  });

  it('activeMs phản ánh idle ngay cả khi chưa gọi check', () => {
    const t = createTimer();
    t.start(0);
    t.activity(50 * S);
    expect(t.activeMs(MIN + 50 * S)).toBe(MIN + 50 * S); // chưa quá 2 phút
    expect(t.activeMs(5 * MIN)).toBe(50 * S);
  });

  it('idle cutoff cấu hình được', () => {
    const t = createTimer({ idleMs: 30 * S });
    t.start(0);
    t.stop(40 * S);
    expect(t.activeMs(40 * S)).toBe(0);
  });

  it('tương tác ngoài hoạt động không đếm', () => {
    const t = createTimer();
    t.activity(10 * S);
    expect(t.activeMs(60 * S)).toBe(0);
  });

  it('đóng tab đột ngột: ghi mỗi 30 giây nên mất tối đa 30 giây', () => {
    const t = createTimer();
    t.start(0);
    let saved = 0;
    for (let s = 0; s <= 100; s += 10) {
      t.activity(s * S);
      if (s % 30 === 0) saved = t.activeMs(s * S);
    }
    expect(t.activeMs(100 * S) - saved).toBeLessThanOrEqual(30 * S);
  });
});
