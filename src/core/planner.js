// Tạo chuỗi hoạt động cho một buổi học (mục 11). Hàm thuần: `now` truyền vào.

export const ESTIMATE_SEC = { review: 10, new: 25, exercise: 60, game: 90 };
export const MAX_REVIEWS = 40;
export const NEW_EVERY = 5; // sau mỗi 5 thẻ ôn chèn 1 thẻ mới
export const MAX_EXERCISE_QUESTIONS = 5;
export const BUDGET_SLACK = 1.2; // không vượt thời lượng mục tiêu quá 20%

/**
 * @param {object} input
 * @param {number} input.now
 * @param {{new_per_day:number, session_minutes:number, games_enabled?:boolean}} input.settings
 * @param {Array<{card_id:string, due_at:number}>} input.cardStates  trạng thái SRS của thẻ đã học
 * @param {Array<{id:string, lesson_id?:string}>} input.newCards     thẻ chưa học, đã xếp theo thứ tự bài
 * @param {number} [input.newLearnedToday]  số thẻ mới đã học hôm nay
 * @param {{id:string, exerciseCount:number}|null} [input.activeLesson]
 * @param {boolean} [input.reviewOnly]  "Chỉ ôn tập": không học mới
 */
export function buildPlan({
  now,
  settings,
  cardStates = [],
  newCards = [],
  newLearnedToday = 0,
  activeLesson = null,
  reviewOnly = false,
}) {
  // 1. Thẻ đến hạn, sớm nhất trước, tối đa 40.
  let reviews = cardStates
    .filter((s) => s.due_at <= now)
    .sort((a, b) => a.due_at - b.due_at || String(a.card_id).localeCompare(String(b.card_id)))
    .slice(0, MAX_REVIEWS)
    .map((s) => ({ type: 'review', card_id: s.card_id, est_sec: ESTIMATE_SEC.review }));

  // 2. Thẻ mới, trừ số đã học hôm nay.
  const quota = reviewOnly ? 0 : Math.max(0, (settings.new_per_day ?? 10) - newLearnedToday);
  let fresh = newCards.slice(0, quota).map((c) => ({
    type: 'new', card_id: c.id, lesson_id: c.lesson_id ?? null, est_sec: ESTIMATE_SEC.new,
  }));

  let exerciseQuestions =
    activeLesson && activeLesson.exerciseCount > 0 && !reviewOnly
      ? Math.min(activeLesson.exerciseCount, MAX_EXERCISE_QUESTIONS)
      : 0;
  let withGame = settings.games_enabled !== false;

  // Không có gì để học thì không chèn trò chơi/bài tập lẻ loi.
  if (!reviews.length && !fresh.length && !exerciseQuestions) withGame = false;

  // 3. Giữ tổng thời gian trong ngân sách. Thứ tự cắt: thẻ mới → trò chơi → bài tập → thẻ ôn (cuối danh sách).
  const budget = (settings.session_minutes ?? 20) * 60 * BUDGET_SLACK;
  const total = () =>
    reviews.length * ESTIMATE_SEC.review +
    fresh.length * ESTIMATE_SEC.new +
    exerciseQuestions * ESTIMATE_SEC.exercise +
    (withGame ? ESTIMATE_SEC.game : 0);
  while (total() > budget) {
    if (fresh.length) fresh = fresh.slice(0, -1);
    else if (withGame) withGame = false;
    else if (exerciseQuestions > 1) exerciseQuestions -= 1;
    else if (reviews.length) reviews = reviews.slice(0, -1);
    else if (exerciseQuestions) exerciseQuestions = 0;
    else break;
  }

  // 4. Xen kẽ: sau mỗi 5 thẻ ôn chèn 1 thẻ mới; thẻ mới còn lại đặt cuối.
  const cards = [];
  let fi = 0;
  reviews.forEach((r, i) => {
    cards.push(r);
    if ((i + 1) % NEW_EVERY === 0 && fi < fresh.length) cards.push(fresh[fi++]);
  });
  while (fi < fresh.length) cards.push(fresh[fi++]);

  // 5. Bài tập ở khoảng 2/3 buổi; trò chơi ở cuối.
  const steps = [...cards];
  if (exerciseQuestions) {
    const at = Math.round((cards.length * 2) / 3);
    steps.splice(at, 0, {
      type: 'exercise',
      lesson_id: activeLesson.id,
      count: exerciseQuestions,
      est_sec: exerciseQuestions * ESTIMATE_SEC.exercise,
    });
  }
  if (withGame) steps.push({ type: 'game', game: 'match', est_sec: ESTIMATE_SEC.game });

  return {
    created_at: now,
    steps,
    total_sec: steps.reduce((s, x) => s + x.est_sec, 0),
    counts: {
      review: reviews.length,
      new: fresh.length,
      exercise: exerciseQuestions,
      game: withGame ? 1 : 0,
      due_total: cardStates.filter((s) => s.due_at <= now).length,
    },
  };
}
