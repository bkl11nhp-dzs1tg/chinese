// Thuật toán lặp lại ngắt quãng (biến thể SM-2). Xem CHINESE_STUDY_FEATURE.md, mục 7.
// Hàm thuần: không đọc Date.now() trực tiếp, thời điểm `now` (ms) được truyền vào.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;

/** Trạng thái SRS ban đầu của một thẻ mới. */
export function newCardState(cardId, now) {
  return {
    card_id: cardId,
    ease: DEFAULT_EASE,
    interval_days: 0,
    repetitions: 0,
    lapses: 0,
    due_at: now,
    last_reviewed_at: null,
  };
}

/**
 * Áp dụng một lần chấm điểm (quality 0..5) lên trạng thái hiện tại.
 * Trả về trạng thái mới, không sửa đối tượng đầu vào.
 */
export function review(state, quality, now) {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError(`quality phải là số nguyên 0..5, nhận được: ${quality}`);
  }

  let { ease, interval_days, repetitions, lapses } = state;

  if (quality < 3) {
    // Nhớ sai: bắt đầu lại từ đầu, ngày mai ôn lại.
    repetitions = 0;
    interval_days = 1;
    lapses += 1;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease);
    repetitions += 1;
  }

  // Cập nhật hệ số dễ, không xuống dưới MIN_EASE.
  const penalty = (5 - quality) * (0.08 + (5 - quality) * 0.02);
  ease = Math.max(MIN_EASE, ease + 0.1 - penalty);

  return {
    ...state,
    ease,
    interval_days,
    repetitions,
    lapses,
    due_at: now + interval_days * DAY_MS,
    last_reviewed_at: now,
  };
}

/** Thẻ đã đến hạn ôn tại thời điểm `now`. */
export function isDue(state, now) {
  return state.due_at <= now;
}

/**
 * Chấm "nhẹ" dùng cho trò chơi (mục 9.5): ảnh hưởng chỉ bằng một nửa.
 * Tính kết quả như review() rồi lấy trung điểm giữa trạng thái cũ và mới
 * cho `ease` và `interval_days`. Không đổi `repetitions` và `lapses`.
 * Thẻ chưa từng được ôn thì không bị ảnh hưởng (trò chơi không thay cho việc học).
 */
export function reviewLight(state, quality, now) {
  const full = review(state, quality, now);
  if (state.last_reviewed_at == null) return { ...state };
  const ease = Math.max(MIN_EASE, (state.ease + full.ease) / 2);
  const interval_days = Math.max(1, Math.round((state.interval_days + full.interval_days) / 2));
  return {
    ...state,
    ease,
    interval_days,
    due_at: now + interval_days * DAY_MS,
    last_reviewed_at: now,
  };
}

/** Trạng thái hiển thị của thẻ: new | learning | mastered (interval ≥ 21 ngày). */
export const MASTERED_DAYS = 21;
export function cardStatus(state) {
  if (!state || state.last_reviewed_at == null) return 'new';
  return state.interval_days >= MASTERED_DAYS ? 'mastered' : 'learning';
}

/**
 * "Đã thuộc": người học khẳng định đã thuộc từ này. Đưa thẳng vào nhóm đã thuộc
 * (khoảng ôn tối thiểu 21 ngày), ease không giảm. Vẫn ôn lại theo lịch để giữ trí nhớ.
 */
export function markMastered(state, now) {
  const r = review(state, 5, now);
  const interval_days = Math.max(MASTERED_DAYS, r.interval_days);
  return { ...r, repetitions: Math.max(r.repetitions, 3), interval_days, due_at: now + interval_days * DAY_MS };
}
