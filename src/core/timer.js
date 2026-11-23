// Đo thời gian học thực tế (mục 10). Không đọc đồng hồ trực tiếp: mọi hàm nhận `t` (ms),
// mặc định lấy từ `clock()` được truyền vào, để test mô phỏng được chuyển tab và idle.
//
// Quy tắc:
// - Chỉ đếm khi tab hiện VÀ đang trong một hoạt động (start() đã gọi, chưa stop()).
// - Không tương tác quá `idleMs` → tạm dừng; thời gian được tính đến lần tương tác cuối.
// - Có tương tác lại → tiếp tục đếm từ lúc đó.

export const DEFAULT_IDLE_MS = 2 * 60 * 1000;
export const FLUSH_EVERY_MS = 30 * 1000;

export function createTimer({ clock = () => Date.now(), idleMs = DEFAULT_IDLE_MS, visible = true } = {}) {
  let accumulated = 0;
  let segmentStart = null; // null = đang không đếm
  let lastActivity = null;
  let inActivity = false;
  let isVisible = visible;
  let idle = false;

  const shouldRun = () => inActivity && isVisible && !idle;

  function closeSegment(end) {
    if (segmentStart != null) {
      accumulated += Math.max(0, end - segmentStart);
      segmentStart = null;
    }
  }
  function openSegmentIfNeeded(t) {
    if (segmentStart == null && shouldRun()) segmentStart = t;
  }

  return {
    /** Bắt đầu một hoạt động học (vào buổi học). */
    start(t = clock()) {
      inActivity = true;
      idle = false;
      lastActivity = t;
      openSegmentIfNeeded(t);
    },
    /** Kết thúc hoạt động. */
    stop(t = clock()) {
      this.check(t);
      closeSegment(t);
      inActivity = false;
    },
    /** Người dùng tương tác (bấm, gõ phím, chạm). */
    activity(t = clock()) {
      if (!inActivity) return;
      this.check(t);
      lastActivity = t;
      if (idle) idle = false;
      openSegmentIfNeeded(t);
    },
    /** Tab hiện/ẩn (visibilitychange). */
    setVisible(v, t = clock()) {
      this.check(t);
      if (!v) closeSegment(t);
      isVisible = v;
      if (v) {
        // Quay lại tab được coi là một tương tác.
        lastActivity = t;
        idle = false;
        openSegmentIfNeeded(t);
      }
    },
    /** Gọi định kỳ: phát hiện idle. */
    check(t = clock()) {
      if (segmentStart != null && lastActivity != null && t - lastActivity > idleMs) {
        closeSegment(Math.max(segmentStart, lastActivity));
        idle = true;
      }
    },
    /** Thời gian học tích cực tính đến `t` (ms). */
    activeMs(t = clock()) {
      if (segmentStart != null && lastActivity != null && t - lastActivity > idleMs) {
        return accumulated + Math.max(0, lastActivity - segmentStart);
      }
      return accumulated + (segmentStart != null ? Math.max(0, t - segmentStart) : 0);
    },
    get running() { return segmentStart != null; },
    get idle() { return idle; },
  };
}
