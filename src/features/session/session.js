import { badgeIcon, artOr } from '../../ui/icons.js';
// Chạy buổi học theo kế hoạch của planner (mục 3.1, 11), toàn màn hình.
// #/session              buổi học thường
// #/session?mode=review  chỉ ôn tập
// #/session?lesson=L01   học từ mới của một bài

import { h, mount, toast } from '../../ui/dom.js';
import { focusShell } from '../../ui/focus.js';
import { cue } from '../../ui/feedback.js';
import { buildPlan } from '../../core/planner.js';
import { newCardQueue } from '../../core/lessons.js';
import { newLearnedToday, startOfDay, formatDuration } from '../../core/stats.js';
import { relatedCardIds } from '../../core/exercises.js';
import { sessionXp } from '../../core/xp.js';
import { flashcard } from '../flashcards/flashcard.js';
import { exerciseRunner, lessonExercises } from '../exercises/runner.js';
import { matchGame, gameCards } from '../games/games.js';

const RELEARN_GAP = 3; // thẻ chấm < 3 quay lại sau 3 bước
const MAX_RELEARN = 2;

export async function render(root, ctx, { query }) {
  let s = ctx.settings;
  const now = Date.now();
  const data = await ctx.loadAll();
  const todayEvents = await ctx.repo.byIndex('review_events', 'created_at', IDBKeyRange.lowerBound(startOfDay(now)));

  let plan;
  let lesson = null;
  if (query.lesson) {
    lesson = data.lessons.find((l) => l.id === query.lesson);
    if (!lesson) { mount(root, h('p', {}, 'Không tìm thấy bài.')); return; }
    if (s.active_lesson_id !== lesson.id) {
      await ctx.repo.saveSettings({ active_lesson_id: lesson.id });
      s = await ctx.refreshSettings();
    }
    const fresh = newCardQueue([lesson], data.cardsById, data.statesById, lesson.id).filter((c) => lesson.vocab_ids.includes(c.id));
    plan = buildPlan({
      now, settings: { ...s, new_per_day: Math.max(s.new_per_day, 15), session_minutes: Math.max(s.session_minutes, 20), games_enabled: false },
      cardStates: [], newCards: fresh, activeLesson: null,
    });
  } else {
    const active = data.active;
    plan = buildPlan({
      now, settings: s,
      cardStates: data.states,
      newCards: newCardQueue(data.lessons, data.cardsById, data.statesById, active?.id),
      newLearnedToday: newLearnedToday(todayEvents, now),
      activeLesson: active ? { id: active.id, exerciseCount: lessonExercises(active, data).exercises.length } : null,
      reviewOnly: query.mode === 'review',
    });
  }

  const backTo = lesson ? `lesson/${encodeURIComponent(lesson.id)}` : 'today';
  if (!plan.steps.length) {
    mount(root, h('div', { class: 'large-title' }, h('h1', {}, 'Buổi học')),
      h('div', { class: 'hero px-box center' },
        badgeIcon('checkCircle', 'good'),
        h('h2', {}, lesson ? 'Đã học hết từ của bài này' : 'Không có gì cần học lúc này'),
        h('p', { class: 'muted' }, lesson ? 'Tiếp theo: luyện tập rồi làm kiểm tra cuối bài.' : 'Không còn thẻ đến hạn và đã đủ số từ mới hôm nay.'),
        h('div', { class: 'stack' },
          lesson ? h('a', { class: 'btn primary big block', href: `#/test/${encodeURIComponent(lesson.id)}` }, 'Làm kiểm tra cuối bài') : null,
          h('a', { class: 'btn big block', href: lesson ? `#/exercise/${encodeURIComponent(lesson.id)}` : '#/games' }, lesson ? 'Luyện tập' : 'Chơi trò chơi'),
          h('a', { class: 'btn ghost block', href: `#/${backTo}` }, 'Quay lại'))));
    return;
  }

  const tracker = ctx.startTracking({ plan, kind: query.lesson ? 'lesson' : query.mode === 'review' ? 'review' : 'session' });
  const shell = focusShell({ onClose: () => (finished ? ctx.navigate(backTo) : finish(true)), closeLabel: 'Kết thúc buổi học' });
  mount(root, shell.el);
  const steps = [...plan.steps];
  const relearnCount = new Map();
  const results = [];
  const stats = { reviewed: 0, learned: 0, relearned: 0, skipped: 0, correct: 0, wrong: 0, exercise: null, game: null };
  const statusBefore = new Map([...data.statusById].map(([k, v]) => [k, v.status]));
  let idx = 0;
  const history = []; // để nút "Quay lại" hoàn tác lần chấm trước
  async function goBack() {
    const e = history.pop();
    if (!e) return;
    if (e.skipped) stats.skipped--;
    if (e.relearn) { stats.relearned--; e.ok ? stats.correct-- : stats.wrong--; }
    if (!e.skipped) {
      await ctx.repo.undoReview({ cardId: e.cardId, previous: e.previous, eventId: e.eventId });
      if (!e.noState) {
        if (e.prevMemState) data.statesById.set(e.cardId, e.prevMemState); else data.statesById.delete(e.cardId);
        if (e.stepType === 'new') stats.learned--; else stats.reviewed--;
        results.pop();
        e.ok ? stats.correct-- : stats.wrong--;
      }
      if (e.insertedRelearn !== false) {
        steps.splice(e.insertedRelearn, 1);
        relearnCount.set(e.cardId, Math.max(0, (relearnCount.get(e.cardId) || 1) - 1));
      }
    }
    idx = e.idx;
    showStep();
  }
  let current = null;
  let finished = false;

  // Nhãn: vị trí trong buổi học (13/14); đang ở phần bài tập thì ghi thêm số câu (13/14 · câu 3/5).
  function updateProgress(_k, _n, done = 0) {
    const step = `${Math.min(idx + 1, steps.length)}/${steps.length}`;
    const label = _n ? `${step}\nCâu ${Math.min((_k || 0) + 1, _n)}/${_n}` : step;
    shell.setProgress((idx + (_n ? ((_k || 0) + done) / _n : 0)) / steps.length, label);
  }

  async function showStep() {
    current?.destroy?.();
    current = null;
    if (finished) return;
    if (idx >= steps.length) return finish(false);
    updateProgress();
    const step = steps[idx];
    if (step.type === 'review' || step.type === 'new' || step.type === 'relearn') {
      const card = data.cardsById.get(step.card_id);
      if (!card) { idx++; return showStep(); }
      current = flashcard({
        card, state: data.statesById.get(card.id) || null, kind: step.type, settings: s,
        onBack: history.length ? () => goBack() : null,
        onSkip: () => { history.push({ idx, skipped: true }); stats.skipped++; idx++; showStep(); },
        onGrade: async (q, kindOfGrade) => {
          const ok = q >= 3;
          cue(ok ? 'tap' : 'bad');
          const entry = { idx, cardId: card.id, stepType: step.type, ok, insertedRelearn: false };
          if (step.type === 'relearn') {
            const r = await ctx.repo.recordReview({ cardId: card.id, quality: q, activity: 'relearn', sessionId: tracker.session.id, mode: 'none' });
            entry.eventId = r.event.id;
            entry.previous = r.previous;
            entry.noState = true;
            entry.relearn = true;
            stats.relearned++;
            ok ? stats.correct++ : stats.wrong++;
          } else {
            const r = await ctx.repo.recordReview({ cardId: card.id, quality: q, activity: step.type, sessionId: tracker.session.id, mode: kindOfGrade === 'mastered' ? 'mastered' : 'full' });
            Object.assign(entry, { eventId: r.event.id, previous: r.previous, prevMemState: data.statesById.get(card.id) });
            data.statesById.set(card.id, r.state);
            if (step.type === 'new') stats.learned++; else stats.reviewed++;
            results.push(ok);
            ok ? stats.correct++ : stats.wrong++;
          }
          if (!ok && (relearnCount.get(card.id) || 0) < MAX_RELEARN) {
            relearnCount.set(card.id, (relearnCount.get(card.id) || 0) + 1);
            steps.splice(Math.min(steps.length, idx + 1 + RELEARN_GAP), 0, { type: 'relearn', card_id: card.id, est_sec: 10 });
            entry.insertedRelearn = Math.min(steps.length - 1, idx + 1 + RELEARN_GAP);
          }
          history.push(entry);
          idx++;
          showStep();
        },
      });
      shell.main.replaceChildren(current.el);
      shell.setFooter(current.actions);
    } else if (step.type === 'exercise') {
      const l = data.lessons.find((x) => x.id === step.lesson_id);
      const { exercises, lessonCards } = lessonExercises(l, data, { limit: step.count });
      const wrongCards = new Set();
      current = exerciseRunner({
        shell, exercises, mode: 'practice', rate: s.tts_rate, onProgress: (k, n, done) => updateProgress(k, n, done),
        onAnswer: async (ex, ok) => {
          results.push(ok);
          if (!ok) relatedCardIds(ex, lessonCards).forEach((id) => wrongCards.add(id));
          for (const id of ex.card_ids || []) {
            if (data.statesById.get(id)) await ctx.repo.recordReview({ cardId: id, quality: ok ? 4 : 1, activity: 'exercise', sessionId: tracker.session.id, mode: 'none' });
          }
        },
        onDone: async (r) => {
          stats.exercise = r;
          await ctx.repo.saveLessonScore(l.id, r.score);
          if (wrongCards.size) await ctx.repo.makeDue([...wrongCards]);
          idx++;
          showStep();
        },
      });
    } else if (step.type === 'game') {
      shell.setFooter();
      current = matchGame({
        cards: gameCards(data, 6),
        onResult: (id, ok) => { cue(ok ? 'tap' : 'bad'); return ctx.repo.recordReview({ cardId: id, quality: ok ? 4 : 2, activity: 'game', sessionId: tracker.session.id, mode: 'light' }); },
        onDone: (r) => { stats.game = r; idx++; setTimeout(showStep, r.skipped ? 0 : 700); },
      });
      shell.main.replaceChildren(current.el);
    }
  }

  async function finish(early) {
    if (finished) return;
    finished = true;
    current?.destroy?.();
    shell.hideSheet();
    const session = await tracker.stop();
    if (early && stats.reviewed + stats.learned === 0 && !stats.exercise) { ctx.navigate(backTo); return; }
    const after = await ctx.loadAll();
    const completed = after.lessons.filter((l) => after.statusById.get(l.id).status === 'done' && statusBefore.get(l.id) !== 'done');
    for (const l of after.lessons) {
      const st = after.statusById.get(l.id).status;
      const p = after.progressById.get(l.id);
      if (st !== 'todo' && p?.status !== st) await ctx.repo.setLessonStatus(l.id, st);
    }
    let xp = null;
    if (false && s.cat_enabled) { // Mèo thư ký: tạm ẩn
      const today = new Date().toDateString();
      const earned = s.xp_day === today ? s.xp_today || 0 : 0;
      xp = sessionXp({ activeMs: session.active_ms, lessonsCompleted: completed.length, results, earnedToday: earned });
      await ctx.repo.saveSettings({ xp_day: today, xp_today: earned + xp, xp_total: (s.xp_total || 0) + xp });
    }
    cue('done');
    shell.setProgress(1, '');
    const total = stats.correct + stats.wrong;
    const tile = (v, l) => h('div', { class: 'tile px-box' }, h('div', { class: 'value' }, v), h('div', { class: 'label' }, l));
    shell.main.replaceChildren(h('div', { class: 'result' },
      early ? badgeIcon('thumb') : artOr('done', badgeIcon('party', 'good')),
      h('h1', {}, early ? 'Đã dừng buổi học' : 'Xong buổi học!'),
      h('p', { class: 'muted' }, early ? 'Phần đã học vẫn được lưu.' : 'Hẹn gặp lại lần sau.'),
      // Chỉ hiện ô có số liệu (không hiện hàng loạt số 0 khi buổi học chỉ có ôn lại/bỏ qua/trò chơi).
      h('div', { class: 'grid', style: { maxWidth: '400px', margin: '20px auto 0' } }, [
        tile(formatDuration(session.active_ms), 'thời gian học'),
        total ? tile(`${Math.round((stats.correct / total) * 100)}%`, 'nhớ đúng') : null,
        stats.learned ? tile(stats.learned, 'từ mới') : null,
        stats.reviewed ? tile(stats.reviewed, 'thẻ đã ôn') : null,
        stats.relearned ? tile(stats.relearned, 'lượt ôn lại') : null,
        stats.skipped ? tile(stats.skipped, 'thẻ bỏ qua') : null,
        stats.game && !stats.game.skipped ? tile(`${(stats.game.ms / 1000).toFixed(1)}s`, 'nối cặp') : null,
      ].filter(Boolean)),
      stats.exercise ? h('p', { style: { marginTop: '16px' } }, `Bài tập: đúng ${stats.exercise.correct}/${stats.exercise.total}.`) : null,
      completed.length ? h('p', {}, 'Hoàn thành bài: ', completed.map((l) => h('span', { class: 'badge done han', style: { marginRight: '6px' } }, l.title))) : null,
    ));
    const lessonDone = lesson && lesson.vocab_ids.every((id) => after.statesById.get(id)?.last_reviewed_at != null);
    // Học xong từ của bài: về trang bài để làm bước tiếp theo (bài khóa → luyện tập → kiểm tra), không nhảy thẳng vào kiểm tra.
    shell.setFooter(h('button', { class: 'btn primary big block', type: 'button', onclick: () => ctx.navigate(backTo) }, lessonDone ? 'Về bài: bước tiếp theo' : 'Xong'));
    if (completed.length) toast(`Hoàn thành ${completed.length} bài!`);
  }

  showStep();
  return () => {
    shell.destroy();
    if (!finished) { finished = true; current?.destroy?.(); return tracker.stop(); }
  };
}
