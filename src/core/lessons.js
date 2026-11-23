// Trạng thái bài học (mục 9.3) và hàng đợi từ mới cho planner. Hàm thuần.

const learned = (state) => !!state && state.last_reviewed_at != null;

/** Sắp bài: theo sách, rồi order, rồi id. */
export function sortLessons(lessons) {
  return [...lessons].sort(
    (a, b) => (a.book || '').localeCompare(b.book || '', 'vi', { numeric: true }) || (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  );
}

/**
 * Bài "xong" khi đạt bài kiểm tra cuối bài (test_best ≥ ngưỡng).
 * Bài không có từ vựng (không có gì để kiểm tra): xong khi đã mở/luyện ít nhất một lần.
 */
export function lessonStatus(lesson, statesById, progress, { threshold = 0.7 } = {}) {
  const total = lesson.vocab_ids.length;
  const learnedCount = lesson.vocab_ids.filter((id) => learned(statesById.get(id))).length;
  const testBest = progress?.test_best ?? null;
  const touched = learnedCount > 0 || (progress?.attempts ?? 0) > 0 || (progress?.test_attempts ?? 0) > 0;
  let status = 'todo';
  if (testBest != null && testBest >= threshold) status = 'done';
  else if (total === 0 && touched) status = 'done';
  else if (touched) status = 'doing';
  return { status, learned: learnedCount, total, best_score: progress?.best_score ?? null, test_best: testBest };
}

/** Bài đang học: bài được chọn (nếu chưa xong) → bài "đang học" đầu tiên → bài "chưa học" đầu tiên. */
export function pickActiveLesson(sortedLessons, statusById, preferredId = null) {
  if (preferredId && statusById.get(preferredId) && statusById.get(preferredId).status !== 'done') {
    return sortedLessons.find((l) => l.id === preferredId) || null;
  }
  return (
    sortedLessons.find((l) => statusById.get(l.id)?.status === 'doing') ||
    sortedLessons.find((l) => statusById.get(l.id)?.status === 'todo') ||
    null
  );
}

/** Thẻ chưa học, bắt đầu từ bài đang học rồi lần lượt các bài sau, cuối cùng là thẻ không thuộc bài nào. */
export function newCardQueue(sortedLessons, cardsById, statesById, activeId = null) {
  const start = Math.max(0, sortedLessons.findIndex((l) => l.id === activeId));
  const ordered = [...sortedLessons.slice(start), ...sortedLessons.slice(0, start)];
  const seen = new Set();
  const out = [];
  // Từ lưu từ bài đọc được ưu tiên (người học chủ động chọn), vẫn tính trong giới hạn từ mới/ngày.
  for (const c of cardsById.values()) {
    if (c.source === 'reading' && !learned(statesById.get(c.id))) { seen.add(c.id); out.push(c); }
  }
  for (const l of ordered) {
    for (const id of l.vocab_ids) {
      const c = cardsById.get(id);
      if (!c || seen.has(id) || learned(statesById.get(id))) continue;
      seen.add(id);
      out.push(c);
    }
  }
  for (const c of cardsById.values()) {
    if (!seen.has(c.id) && !c.lesson_id && !learned(statesById.get(c.id))) out.push(c);
  }
  return out;
}
