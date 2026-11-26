// #/recall/L05: Luyện nhớ chủ động – xem từ, viết theo mẫu, ẩn mẫu tự viết, nghe rồi viết, kiểm tra tổng hợp xen từ cũ.

import { h, mount } from '../../ui/dom.js';
import { focusShell } from '../../ui/focus.js';
import { cue } from '../../ui/feedback.js';
import { badgeIcon } from '../../ui/icons.js';
import { exerciseRunner } from './runner.js';
import { resultView, reviewWords, answerList } from './result-view.js';
import { buildRecallSet, writable } from '../../core/recall.js';
import { loadDecomp } from '../../ui/char-anatomy.js';
import { freshOrder, markSeen } from '../../core/variety.js';

export async function render(root, ctx, { params }) {
  const data = await ctx.loadAll();
  const lesson = data.lessons.find((l) => l.id === params.id);
  if (!lesson) { mount(root, h('p', {}, 'Không tìm thấy bài.')); return; }
  const lessonCards = lesson.vocab_ids.map((id) => data.cardsById.get(id)).filter(Boolean);
  // Từ cũ đã học (bài trước), ưu tiên từ đến hạn ôn / hay sai.
  const idx = data.lessons.indexOf(lesson);
  const before = new Set(data.lessons.slice(0, idx).flatMap((l) => l.vocab_ids));
  const now = Date.now();
  const reviewCards = freshOrder(data.cards
    .filter((c) => before.has(c.id) && data.statesById.get(c.id)?.last_reviewed_at != null), 'recall', {
    bonus: (c) => (data.statesById.get(c.id).due_at <= now ? 1 : 0),
  });
  const lines = data.lessons.flatMap((l) => (l.texts || []).flatMap((t) => t.lines.map((ln) => ({ zh: ln.zh, vi: ln.vi }))));
  const back = `lesson/${encodeURIComponent(lesson.id)}`;
  // Từ của bài xếp theo ưu tiên: chưa luyện viết / lâu chưa luyện trước, từ đến hạn ôn được cộng điểm.
  let ranked = freshOrder(lessonCards.filter(writable), 'recall', {
    bonus: (c) => { const st = data.statesById.get(c.id); return st?.last_reviewed_at && st.due_at <= now ? 0.8 : 0; },
  });
  if (!ranked.length) { mount(root, h('p', { class: 'notice' }, 'Bài này chưa có từ để luyện viết.'), h('a', { class: 'btn', href: `#/${back}` }, 'Về bài')); return; }
  const decomp = await loadDecomp();
  const total = ranked.length;
  // Mỗi lượt 5 từ (ưu tiên từ lâu chưa luyện); mỗi từ viết 5 hoặc 10 lần trên một trang.
  const size = Math.min(5, total);
  const REPS = [5, 10];
  let reps = REPS.includes(ctx.settings.recall_reps) ? ctx.settings.recall_reps : 5;
  let exercises = [];
  const build = () => {
    exercises = buildRecallSet(ranked, { ordered: true, maxNew: size, reps, reviewCards: reviewCards.slice(0, 12), pool: data.cards, decomp, lines });
  };

  const shell = focusShell({ onClose: () => ctx.navigate(back) });
  mount(root, shell.el);
  shell.setProgress(0, '');
  const sizeRow = h('div', { class: 'seg seg-fit recall-size', role: 'radiogroup', 'aria-label': 'Số lần viết mỗi từ' });
  const wordsRow = h('div', { class: 'recall-words' });
  const countEl = h('strong');
  function paint() {
    build();
    sizeRow.replaceChildren(...REPS.map((k) => h('button', {
      class: ['seg-btn', k === reps ? 'on' : ''], type: 'button', role: 'radio', 'aria-checked': String(k === reps),
      onclick: () => { reps = k; paint(); },
    }, `Mỗi từ viết ${k} lần`)));
    wordsRow.replaceChildren(...ranked.slice(0, size).map((c) => h('span', { class: 'rw-chip' }, h('span', { class: 'han', lang: 'zh-CN' }, c.hanzi), h('small', {}, c.pinyin))));
    countEl.textContent = `${exercises.length} bước`;
    shuffleBtn.classList.toggle('hidden', size >= total);
  }
  // Đổi sang nhóm từ khác: đẩy nhóm đang chọn xuống cuối.
  const shuffleBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { ranked = [...ranked.slice(size), ...ranked.slice(0, size)]; paint(); } }, 'Đổi nhóm từ khác');
  shell.main.replaceChildren(h('div', { class: 'result recall-start' },
    badgeIcon('pencil'),
    h('div', { class: 'q-type' }, `Luyện nhớ & viết · Bài ${lesson.unit ?? ''}`),
    h('h1', { class: 'han' }, lesson.title),
    sizeRow,
    wordsRow,
    shuffleBtn,
    h('div', { class: 'group', style: { textAlign: 'left', marginTop: '20px' } },
      h('div', { class: 'row-link' }, h('span', { class: 'grow' }, 'Độ dài'), countEl))));
  paint();
  shell.setFooter(h('button', { class: 'btn primary big block', type: 'button', onclick: () => start() }, 'Bắt đầu'));

  let runner = null;
  let tracker = null;
  function start() {
    ctx.repo.saveSettings({ recall_reps: reps });
    markSeen('recall', ranked.slice(0, size).map((c) => c.id));
    tracker = ctx.startTracking({ kind: 'exercise' });
    const wrong = new Set();
    runner = exerciseRunner({
      shell, exercises, mode: 'practice', rate: ctx.settings.tts_rate,
      onAnswer: async (ex, ok) => {
        if (ex.type === 'sheet') { for (const id of ex.card_ids || []) await ctx.repo.recordReview({ cardId: id, quality: ok ? 4 : 2, activity: 'recall-copy', sessionId: tracker.session.id, mode: 'log' }); return; }
      if (ex.type === 'study' || ex.mode === 'trace') return; // xem từ / viết theo mẫu: không tính điểm nhớ
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
        }), reviewWords([...wrong].map((id) => data.cardsById.get(id)).filter(Boolean), { rate: ctx.settings.tts_rate }), answerList(graded, { rate: ctx.settings.tts_rate }));
      },
    });
  }
  return () => { runner?.destroy(); shell.destroy(); return tracker?.stop(); };
}
