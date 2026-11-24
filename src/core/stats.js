// Tổng hợp thống kê (mục 9.9). Hàm thuần; ngày tính theo giờ địa phương.

import { cardStatus } from './srs.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' theo giờ địa phương. */
export function dayKey(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Nửa đêm (giờ địa phương) của ngày chứa ts. */
export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Lùi n ngày theo lịch (an toàn với giờ mùa hè). */
export function addDays(ts, n) {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Map ngày → tổng active_ms. Buổi học được tính vào ngày bắt đầu. */
export function msByDay(sessions) {
  const m = new Map();
  for (const s of sessions) {
    const k = dayKey(s.started_at);
    m.set(k, (m.get(k) || 0) + (s.active_ms || 0));
  }
  return m;
}

/** Mảng `days` ngày gần nhất (cũ → mới): [{ day, ms }]. */
export function dailySeries(sessions, now, days = 14) {
  const m = msByDay(sessions);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(addDays(startOfDay(now), -i));
    out.push({ day: k, ms: m.get(k) || 0 });
  }
  return out;
}

export function totalMs(sessions, from = -Infinity, to = Infinity) {
  return sessions
    .filter((s) => s.started_at >= from && s.started_at < to)
    .reduce((a, s) => a + (s.active_ms || 0), 0);
}

/** Tổng hôm nay / 7 ngày / 30 ngày / tất cả. */
export function timeTotals(sessions, now) {
  const today = startOfDay(now);
  return {
    today: totalMs(sessions, today),
    week: totalMs(sessions, addDays(today, -6)),
    month: totalMs(sessions, addDays(today, -29)),
    all: totalMs(sessions),
  };
}

/**
 * Streak: số ngày liên tiếp có ít nhất một buổi học (active_ms > 0).
 * Nếu hôm nay chưa học, đếm tới hôm qua — chưa học hôm nay không làm mất streak.
 */
export function streak(sessions, now) {
  const days = new Set(sessions.filter((s) => (s.active_ms || 0) > 0).map((s) => dayKey(s.started_at)));
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let n = 0;
  while (days.has(dayKey(cursor))) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Số thẻ theo trạng thái: new / learning / mastered. */
export function cardStatusCounts(cards, statesById) {
  const counts = { new: 0, learning: 0, mastered: 0 };
  for (const c of cards) counts[cardStatus(statesById.get(c.id))]++;
  return counts;
}

/** Tỷ lệ đúng (quality ≥ 3) theo tuần, `weeks` tuần gần nhất (cũ → mới). */
export function weeklyAccuracy(events, now, weeks = 4) {
  const end = addDays(startOfDay(now), 1);
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const to = addDays(end, -7 * w);
    const from = addDays(to, -7);
    const evs = events.filter((e) => e.created_at >= from && e.created_at < to);
    const correct = evs.filter((e) => e.quality >= 3).length;
    out.push({ from, to, total: evs.length, correct, rate: evs.length ? correct / evs.length : null });
  }
  return out;
}

/** Tỷ lệ đúng theo hoạt động (review, new, exercise, game, ...). */
export function accuracyByActivity(events) {
  const m = new Map();
  for (const e of events) {
    const a = m.get(e.activity) || { activity: e.activity, total: 0, correct: 0 };
    a.total++;
    if (e.quality >= 3) a.correct++;
    m.set(e.activity, a);
  }
  return [...m.values()].map((a) => ({ ...a, rate: a.total ? a.correct / a.total : null }));
}

/** Số thẻ mới đã học hôm nay (sự kiện đầu tiên của thẻ rơi vào hôm nay, hoạt động 'new'). */
export function newLearnedToday(events, now) {
  const today = startOfDay(now);
  return new Set(events.filter((e) => e.activity === 'new' && e.created_at >= today).map((e) => e.card_id)).size;
}

export function formatDuration(ms) {
  if (ms > 0 && ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} giây`;
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}
