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
  // Toàn bộ từ của bài, theo thứ tự trong sách.
  const words = lessonCards.filter(writable);
  if (!words.length) { mount(root, h('p', { class: 'notice' }, 'Bài này chưa có từ để luyện viết.'), h('a', { class: 'btn', href: `#/${back}` }, 'Về bài')); return; }
  const decomp = await loadDecomp();
  // Hai chế độ: Tập viết (từ mới, viết mỗi từ 1 lần) · Luyện tập (viết mỗi từ 6 lần trên một trang).
  const MODES = [['learn', 'Tập viết', 1], ['drill', 'Luyện tập', 6]];
  let mode = MODES.some(([id]) => id === ctx.settings.recall_mode) ? ctx.settings.recall_mode : 'learn';
  const repsOf = (m) => MODES.find(([id]) => id === m)[2];
  let exercises = [];
  const build = () => {
    exercises = buildRecallSet(words, { ordered: true, maxNew: words.length, reps: repsOf(mode), reviewCards: reviewCards.slice(0, 12), pool: data.cards, decomp, lines });
  };

  const shell = focusShell({ onClose: () => ctx.navigate(back) });
  mount(root, shell.el);
  shell.setProgress(0, '');
  const modeRow = h('div', { class: 'seg seg-fit recall-size', role: 'tablist', 'aria-label': 'Chế độ viết' });
  const wordsRow = h('div', { class: 'recall-words' });
  const countEl = h('strong');
  const repsEl = h('strong');
  function paint() {
    build();
    modeRow.replaceChildren(...MODES.map(([id, label]) => h('button', {
      class: ['seg-btn', id === mode ? 'on' : ''], type: 'button', role: 'tab', 'aria-selected': String(id === mode),
      onclick: () => { mode = id; paint(); },
    }, label)));
    repsEl.textContent = `${repsOf(mode)} lần`;
    countEl.textContent = `${exercises.length} bước`;
  }
  wordsRow.replaceChildren(...words.map((c) => h('span', { class: 'rw-chip' }, h('span', { class: 'han', lang: 'zh-CN' }, c.hanzi), h('small', {}, c.pinyin))));
  shell.main.replaceChildren(h('div', { class: 'result recall-start' },
    badgeIcon('pencil'),
    h('div', { class: 'q-type' }, `Luyện nhớ & viết · Bài ${lesson.unit ?? ''}`),
    h('h1', { class: 'han' }, lesson.title),
    modeRow,
    h('div', { class: 'group recall-meta' },
      h('div', { class: 'row-link static' }, h('span', { class: 'grow' }, 'Số từ'), h('strong', {}, `${words.length} từ`)),
      h('div', { class: 'row-link static' }, h('span', { class: 'grow' }, 'Mỗi từ viết'), repsEl),
      h('div', { class: 'row-link static' }, h('span', { class: 'grow' }, 'Độ dài'), countEl)),
    wordsRow));
  paint();
  shell.setFooter(h('button', { class: 'btn primary big block', type: 'button', onclick: () => start() }, 'Bắt đầu'));

  let runner = null;
  let tracker = null;
  function start() {
    ctx.repo.saveSettings({ recall_mode: mode });
    markSeen('recall', words.map((c) => c.id));
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
