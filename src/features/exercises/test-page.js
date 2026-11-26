import { badgeIcon } from '../../ui/icons.js';
// #/test/L01: kiểm tra cuối bài. Không gợi ý trong lúc làm; chấm ở cuối, xem lại câu sai.
// Đạt ngưỡng (Cài đặt, mặc định 70%) → bài hoàn thành, gợi ý sang bài tiếp theo.

import { h, mount } from '../../ui/dom.js';
import { focusShell } from '../../ui/focus.js';
import { cue } from '../../ui/feedback.js';
import { chineseVoice } from '../../ui/speech.js';
import { buildLessonTest, scoreTest } from '../../core/lessontest.js';
import { buildDictionary, segmentSentence } from '../../core/segment.js';
import { relatedCardIds } from '../../core/exercises.js';
import { exerciseRunner } from './runner.js';
import { reviewWords, resultView, answerList } from './result-view.js';
import { recordAnswer } from './record.js';

export async function render(root, ctx, { params }) {
  const data = await ctx.loadAll();
  const s = ctx.settings;
  const lesson = data.lessons.find((l) => l.id === params.id);
  if (!lesson) { mount(root, h('p', {}, 'Không tìm thấy bài.')); return; }
  const lessonCards = lesson.vocab_ids.map((id) => data.cardsById.get(id)).filter(Boolean);
  const sameBook = data.cards.filter((c) => {
    const l = data.lessons.find((x) => x.id === c.lesson_id);
    return l && l.book === lesson.book;
  });
  const voice = await chineseVoice();
  // Câu bài khóa: bỏ ghi chú bối cảnh "(…)" ở đầu nghĩa; tách từ để làm câu sắp xếp.
  const dict = buildDictionary(data.cards);
  const textLines = (lesson.texts || []).flatMap((t) => t.lines).map((ln) => {
    const zh = ln.zh.replace(/[。？！]+$/, '');
    return { zh: ln.zh, vi: (ln.vi || '').replace(/^\([^)]*\)\s*/, ''), tokens: segmentSentence(zh, dict) };
  });
  const questions = buildLessonTest(lessonCards, sameBook.length > 8 ? sameBook : data.cards, data.exercisesByLesson.get(lesson.id) || [], { listen: !!voice, textLines });
  if (!questions.length) { mount(root, h('p', {}, 'Bài này chưa có nội dung để kiểm tra.')); return; }

  const back = `lesson/${encodeURIComponent(lesson.id)}`;
  const before = data.statusById.get(lesson.id).status;
  const tracker = ctx.startTracking({ kind: 'test' });
  const shell = focusShell({ onClose: () => ctx.navigate(back), closeLabel: 'Bỏ bài kiểm tra' });
  mount(root, shell.el);

  // Màn mở đầu: số câu, ngưỡng đạt.
  shell.main.replaceChildren(h('div', { class: 'result' },
    badgeIcon('clipboard'),
    h('div', { class: 'q-type' }, `Kiểm tra cuối bài ${lesson.unit ?? ''}`),
    h('h1', { class: 'han' }, lesson.title),
    lesson.title_vi ? h('p', { class: 'muted' }, lesson.title_vi) : null,
    h('div', { class: 'group', style: { textAlign: 'left', marginTop: '24px' } },
      h('div', { class: 'row-link' }, h('span', { class: 'grow' }, 'Số câu'), h('strong', {}, questions.length)),
      h('div', { class: 'row-link' }, h('span', { class: 'grow' }, 'Điểm đạt'), h('strong', {}, `${Math.round(s.pass_threshold * 100)}%`)),
      h('div', { class: 'row-link' }, h('span', { class: 'grow' }, 'Cách chấm'), h('span', { class: 'muted' }, 'Chấm khi nộp bài'))),
    data.statusById.get(lesson.id).learned < lessonCards.length
      ? h('p', { class: 'notice small', style: { marginTop: '16px', textAlign: 'left' } }, `Bạn mới học ${data.statusById.get(lesson.id).learned}/${lessonCards.length} từ của bài. Vẫn có thể làm thử.`) : null));
  shell.setFooter(h('button', { class: 'btn primary big block', type: 'button', onclick: start }, 'Bắt đầu'));

  let runner;
  function start() {
    runner = exerciseRunner({
      shell, exercises: questions, mode: 'test', rate: s.tts_rate,
      onAnswer: (ex, ok) => recordAnswer(ctx.repo, relatedCardIds(ex, lessonCards), ok, { activity: 'test', sessionId: tracker.session.id, mode: 'log' }),
      onDone: (r) => finish(r),
    });
  }

  async function finish(r) {
    const session = await tracker.stop();
    const result = scoreTest(r.results, s.pass_threshold);
    await ctx.repo.saveTestScore(lesson.id, result.score);
    const wrongIds = new Set(result.wrong.flatMap((w) => relatedCardIds(w.question, lessonCards)));
    if (wrongIds.size) await ctx.repo.makeDue([...wrongIds]);
    const after = await ctx.loadAll();
    const st = after.statusById.get(lesson.id).status;
    await ctx.repo.setLessonStatus(lesson.id, st);
    const idx = after.lessons.findIndex((l) => l.id === lesson.id);
    const nextLesson = after.lessons[idx + 1];
    cue(result.passed ? 'done' : 'bad');
    shell.setProgress(1, '');
    const newlyDone = st === 'done' && before !== 'done';
    shell.main.replaceChildren(
      resultView({
        emoji: result.passed ? badgeIcon('medal', 'good') : badgeIcon('muscle', 'accent'),
        title: result.passed ? (newlyDone ? `Hoàn thành bài ${lesson.unit ?? ''}!` : 'Đạt!') : 'Chưa đạt, thử lại nhé',
        score: result.score, correct: result.correct, total: result.total, activeMs: session.active_ms, passed: result.passed,
        note: result.passed
          ? (nextLesson ? `Bài tiếp theo: ${nextLesson.title}${nextLesson.title_vi ? ` (${nextLesson.title_vi})` : ''}` : 'Bạn đã xong toàn bộ các bài!')
          : `Cần ${Math.round(s.pass_threshold * 100)}% để hoàn thành bài.`,
      }),
      reviewWords([...wrongIds].map((id) => lessonCards.find((c) => c.id === id)).filter(Boolean), { rate: s.tts_rate }),
      answerList(r.results, { rate: s.tts_rate, title: 'Xem lại bài làm' }));
    shell.setFooter(result.passed && nextLesson
      ? h('div', { class: 'row nowrap' },
          h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(back) }, 'Về bài'),
          h('button', { class: 'btn primary big', type: 'button', style: { flex: 1.4 }, onclick: async () => { await ctx.repo.saveSettings({ active_lesson_id: nextLesson.id }); await ctx.refreshSettings(); ctx.navigate(`lesson/${encodeURIComponent(nextLesson.id)}`); } }, 'Bài tiếp theo'))
      : h('div', { class: 'row nowrap' },
          h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(back) }, 'Về bài'),
          h('button', { class: 'btn primary big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(`test/${encodeURIComponent(lesson.id)}?r=${Date.now()}`) }, 'Làm lại')));
  }

  return () => { runner?.destroy(); shell.destroy(); return tracker.stop(); };
}
