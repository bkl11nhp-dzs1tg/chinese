// Ngữ cảnh dùng chung cho các màn hình: repo, cài đặt, nạp toàn bộ dữ liệu, đo thời gian học.

import { createTimer, FLUSH_EVERY_MS } from './core/timer.js';
import { uuid } from './core/uuid.js';
import { sortLessons, lessonStatus, pickActiveLesson } from './core/lessons.js';

export function createContext(repo) {
  const ctx = {
    repo,
    settings: null,
    async refreshSettings() {
      ctx.settings = await repo.getSettings();
      applyTheme(ctx.settings.theme);
      return ctx.settings;
    },
    navigate(path) { location.hash = `#/${path}`; },
    loadAll: () => loadAll(repo, ctx.settings),
    startTracking: (opts) => startTracking(repo, ctx.settings, opts),
  };
  return ctx;
}

export function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

/** Nạp toàn bộ dữ liệu học (dữ liệu cá nhân nhỏ, vài nghìn dòng: đọc hết là đủ nhanh). */
export async function loadAll(repo, settings) {
  const [cards, states, lessonsRaw, progressRows, exercises] = await Promise.all([
    repo.getAll('cards'), repo.getAll('card_state'), repo.getAll('lessons'),
    repo.getAll('lesson_progress'), repo.getAll('exercises'),
  ]);
  const cardsById = new Map(cards.map((c) => [c.id, c]));
  const statesById = new Map(states.map((s) => [s.card_id, s]));
  const progressById = new Map(progressRows.map((p) => [p.lesson_id, p]));
  const exercisesByLesson = new Map();
  for (const e of exercises) {
    if (!exercisesByLesson.has(e.lesson_id)) exercisesByLesson.set(e.lesson_id, []);
    exercisesByLesson.get(e.lesson_id).push(e);
  }
  const lessons = sortLessons(lessonsRaw);
  const threshold = settings?.pass_threshold ?? 0.7;
  const statusById = new Map(lessons.map((l) => [l.id, lessonStatus(l, statesById, progressById.get(l.id), { threshold })]));
  const active = pickActiveLesson(lessons, statusById, settings?.active_lesson_id);
  return { cards, cardsById, states, statesById, lessons, progressById, exercisesByLesson, statusById, active };
}

/**
 * Bắt đầu đo một hoạt động học: tạo study_session, lắng nghe tương tác và ẩn/hiện tab,
 * ghi active_ms mỗi 30 giây để đóng tab đột ngột không mất quá 30 giây.
 */
export function startTracking(repo, settings, { plan = null, kind = 'session' } = {}) {
  const idleMs = (settings?.idle_minutes ?? 2) * 60 * 1000;
  const timer = createTimer({ idleMs, visible: document.visibilityState !== 'hidden' });
  const now = Date.now();
  const session = { id: uuid(), kind, started_at: now, ended_at: now, active_ms: 0, plan_json: plan ? JSON.stringify(plan) : null };
  timer.start(now);

  const onActivity = () => timer.activity();
  const onVisibility = () => {
    timer.setVisible(document.visibilityState !== 'hidden');
    if (document.visibilityState === 'hidden') flush();
  };
  const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
  events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flush);
  const checkInt = setInterval(() => timer.check(), 5000);
  const flushInt = setInterval(flush, FLUSH_EVERY_MS);
  let stopped = false;

  function flush() {
    if (stopped) return Promise.resolve(session);
    session.ended_at = Date.now();
    session.active_ms = Math.round(timer.activeMs());
    return repo.saveSession({ ...session }).catch(() => {});
  }
  flush();

  return {
    session,
    activeMs: () => timer.activeMs(),
    async stop() {
      if (stopped) return session;
      timer.stop();
      await flush();
      stopped = true;
      clearInterval(checkInt);
      clearInterval(flushInt);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      // Buổi không có thời gian học thực tế thì không giữ lại.
      if (session.active_ms < 1000) await repo.delete('study_sessions', session.id).catch(() => {});
      return session;
    },
  };
}
