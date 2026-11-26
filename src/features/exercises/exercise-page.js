// #/exercise/L01: luyện tập của một bài (phản hồi ngay sau mỗi câu).

import { h, mount } from '../../ui/dom.js';
import { focusShell } from '../../ui/focus.js';
import { cue } from '../../ui/feedback.js';
import { relatedCardIds } from '../../core/exercises.js';
import { exerciseRunner, lessonExercises } from './runner.js';
import { resultView, reviewWords, answerList } from './result-view.js';
import { recordAnswer } from './record.js';
import { startOrResume, resumeOpts, clearResume } from './resume.js';

export async function render(root, ctx, { params }) {
  const data = await ctx.loadAll();
  const lesson = data.lessons.find((l) => l.id === params.id);
  if (!lesson) { mount(root, h('p', {}, 'Không tìm thấy bài.')); return; }
  const { exercises, lessonCards } = lessonExercises(lesson, data, { limit: 12 });
  if (!exercises.length) { mount(root, h('p', {}, 'Bài này chưa có bài tập.')); return; }

  const back = `lesson/${encodeURIComponent(lesson.id)}`;
  const tracker = ctx.startTracking({ kind: 'exercise' });
  const shell = focusShell({ onClose: () => ctx.navigate(back) });
  mount(root, shell.el);
  const wrongCards = new Set();

  const RESUME_ID = `exercise:${lesson.id}`;
  let runner = null;
  const start = (saved) => {
    const list = saved?.exercises || exercises;
    for (const r of saved?.results || []) if (!r.correct) relatedCardIds(r.question, lessonCards).forEach((id) => wrongCards.add(id));
    runner = exerciseRunner({
      shell, exercises: list, ...resumeOpts(RESUME_ID, saved, list), mode: 'practice', rate: ctx.settings.tts_rate,
      onAnswer: async (ex, ok) => {
        if (!ok) relatedCardIds(ex, lessonCards).forEach((id) => wrongCards.add(id));
        await recordAnswer(ctx.repo, relatedCardIds(ex, lessonCards), ok, { activity: 'exercise', sessionId: tracker.session.id, mode: 'log' });
      },
      onDone: async (r) => {
        clearResume(RESUME_ID);
        const session = await tracker.stop();
        await ctx.repo.saveLessonScore(lesson.id, r.score);
        if (wrongCards.size) await ctx.repo.makeDue([...wrongCards]);
        shell.setProgress(1, '');
        cue('done');
        shell.setFooter(
          h('div', { class: 'row nowrap' },
            h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(`exercise/${encodeURIComponent(lesson.id)}?r=${Date.now()}`) }, 'Luyện lại'),
            h('button', { class: 'btn primary big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(`test/${encodeURIComponent(lesson.id)}`) }, 'Làm kiểm tra')));
        shell.main.replaceChildren(resultView({
          title: r.score >= 0.8 ? 'Luyện tập tốt lắm!' : 'Xong phần luyện tập',
          score: r.score, correct: r.correct, total: r.total, activeMs: session.active_ms,
          note: wrongCards.size ? null : 'Sẵn sàng làm kiểm tra cuối bài.',
        }), reviewWords([...wrongCards].map((id) => data.cardsById.get(id)).filter(Boolean), { rate: ctx.settings.tts_rate }), answerList(r.results, { rate: ctx.settings.tts_rate }));
      },
    });
  };
  startOrResume(shell, RESUME_ID, `Luyện tập · Bài ${lesson.unit ?? ''}`, start);
  return () => { runner?.destroy(); shell.destroy(); return tracker.stop(); };
}
