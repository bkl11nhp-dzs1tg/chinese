// #/recall/L05: Luyện nhớ chủ động – xem từ, viết theo mẫu, ẩn mẫu tự viết, nghe rồi viết, kiểm tra tổng hợp xen từ cũ.

import { h, mount } from '../../ui/dom.js';
import { focusShell } from '../../ui/focus.js';
import { cue } from '../../ui/feedback.js';
import { exerciseRunner } from './runner.js';
import { resultView, reviewWords } from './result-view.js';
import { buildRecallSet } from '../../core/recall.js';
import { loadDecomp } from '../../ui/char-anatomy.js';

export async function render(root, ctx, { params }) {
  const data = await ctx.loadAll();
  const lesson = data.lessons.find((l) => l.id === params.id);
  if (!lesson) { mount(root, h('p', {}, 'Không tìm thấy bài.')); return; }
  const lessonCards = lesson.vocab_ids.map((id) => data.cardsById.get(id)).filter(Boolean);
  // Từ cũ đã học (bài trước), ưu tiên từ đến hạn ôn / hay sai.
  const idx = data.lessons.indexOf(lesson);
  const before = new Set(data.lessons.slice(0, idx).flatMap((l) => l.vocab_ids));
  const now = Date.now();
  const reviewCards = data.cards
    .filter((c) => before.has(c.id) && data.statesById.get(c.id)?.last_reviewed_at != null)
    .sort((a, b) => (data.statesById.get(a.id).due_at - now) - (data.statesById.get(b.id).due_at - now));
  const lines = data.lessons.flatMap((l) => (l.texts || []).flatMap((t) => t.lines.map((ln) => ({ zh: ln.zh, vi: ln.vi }))));
  const exercises = buildRecallSet(lessonCards, { reviewCards: reviewCards.slice(0, 12), pool: data.cards, decomp: await loadDecomp(), lines });
  const back = `lesson/${encodeURIComponent(lesson.id)}`;
  if (!exercises.length) { mount(root, h('p', { class: 'notice' }, 'Bài này chưa có từ để luyện viết.'), h('a', { class: 'btn', href: `#/${back}` }, 'Về bài')); return; }

  const tracker = ctx.startTracking({ kind: 'exercise' });
  const shell = focusShell({ onClose: () => ctx.navigate(back) });
  mount(root, shell.el);
  const wrong = new Set();
  const runner = exerciseRunner({
    shell, exercises, mode: 'practice', rate: ctx.settings.tts_rate,
    onAnswer: async (ex, ok) => {
      if (ex.type === 'study' || ex.mode === 'trace') return; // xem từ / viết theo mẫu: không tính
      for (const id of ex.card_ids || []) {
        if (!ok) wrong.add(id);
        await ctx.repo.recordReview({ cardId: id, quality: ok ? 4 : 1, activity: ex.activity || 'recall-write', sessionId: tracker.session.id, mode: 'light' });
      }
    },
    onDone: async (r) => {
      const session = await tracker.stop();
      // Chỉ tính các câu tự nhớ (bỏ thẻ xem và viết theo mẫu).
      const graded = r.results.filter((x) => x.question.type !== 'study' && x.question.mode !== 'trace');
      const correct = graded.filter((x) => x.correct).length;
      const score = graded.length ? correct / graded.length : 0;
      await ctx.repo.saveRecallScore(lesson.id, score);
      if (wrong.size) await ctx.repo.makeDue([...wrong]);
      shell.setProgress(1, '');
      cue('done');
      shell.setFooter(h('div', { class: 'row nowrap' },
        h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(`recall/${encodeURIComponent(lesson.id)}?r=${Date.now()}`) }, 'Luyện lại'),
        h('button', { class: 'btn primary big', type: 'button', style: { flex: 1.3 }, onclick: () => ctx.navigate(back) }, 'Về bài')));
      shell.main.replaceChildren(resultView({
        title: score >= 0.8 ? 'Nhớ rất tốt!' : score >= 0.5 ? 'Đang nhớ dần' : 'Cần luyện thêm',
        score, correct, total: graded.length, activeMs: session.active_ms,
      }), reviewWords([...wrong].map((id) => data.cardsById.get(id)).filter(Boolean), { rate: ctx.settings.tts_rate }));
    },
  });
  return () => { runner.destroy(); shell.destroy(); return tracker.stop(); };
}
