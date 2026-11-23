// XP cho mèo thư ký (mục 13.1, đề xuất). Không bao giờ trừ XP.
export const XP_RULES = { perMinutes: 5, perLesson: 2, perStreak5: 1, maxStreakBonus: 3, dailyCap: 60 };

/** Đếm số chuỗi 5 câu đúng liên tiếp trong một dãy kết quả đúng/sai. */
export function streaksOfFive(results) {
  let run = 0, n = 0;
  for (const ok of results) {
    run = ok ? run + 1 : 0;
    if (run === 5) { n++; run = 0; }
  }
  return n;
}

/** XP của một buổi; earnedToday là XP đã nhận trong ngày (để áp giới hạn ngày). */
export function sessionXp({ activeMs = 0, lessonsCompleted = 0, results = [], earnedToday = 0 }, rules = XP_RULES) {
  const raw = Math.floor(activeMs / (rules.perMinutes * 60000))
    + lessonsCompleted * rules.perLesson
    + Math.min(rules.maxStreakBonus, streaksOfFive(results)) * rules.perStreak5;
  return Math.max(0, Math.min(raw, rules.dailyCap - earnedToday));
}
