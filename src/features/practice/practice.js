// #/practice            Trung tâm luyện tập: chọn phạm vi, luyện theo kỹ năng, trò chơi.
// #/practice/:skill     Một lượt luyện 10 câu theo kỹ năng (phản hồi ngay sau mỗi câu).

import { h, mount } from '../../ui/dom.js';
import { icon, badgeIcon } from '../../ui/icons.js';
import { focusShell } from '../../ui/focus.js';
import { cue } from '../../ui/feedback.js';
import { ttsSupported } from '../../ui/speech.js';
import { SKILLS, buildSkillSet } from '../../core/practice.js';
import { buildDictionary, segmentSentence } from '../../core/segment.js';
import { exerciseRunner } from '../exercises/runner.js';
import { resultView, reviewWords } from '../exercises/result-view.js';
import { GAMES } from '../games/games.js';

export const GAME_ICONS = { match: 'link', race: 'bolt', build: 'blocks', listen: 'headphones' };
const GAME_TONES = { match: 'orange', race: 'red', build: 'teal', listen: 'blue' };
const speechOk = () => !!(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);

/** Phạm vi luyện: 'upto' (từ bài 1 đến bài đang học), 'learned', 'active', 'all', hoặc mã bài. */
export function scopeOf(data, scope) {
  const learned = (c) => data.statesById.get(c.id)?.last_reviewed_at != null;
  const activeIdx = data.active ? data.lessons.indexOf(data.active) : data.lessons.length - 1;
  let lessons;
  if (scope === 'all' || scope === 'learned') lessons = data.lessons;
  else if (scope === 'active') lessons = data.active ? [data.active] : data.lessons.slice(0, 1);
  else if (/^L\d+$/.test(scope || '')) lessons = data.lessons.filter((l) => l.id === scope);
  else lessons = data.lessons.slice(0, Math.max(1, activeIdx + 1));
  const ids = new Set(lessons.flatMap((l) => l.vocab_ids));
  let cards = data.cards.filter((c) => ids.has(c.id) || (scope !== 'active' && c.source === 'reading'));
  if (scope === 'learned') cards = data.cards.filter(learned);
  const lines = lessons.flatMap((l) => (l.texts || []).flatMap((t) => t.lines));
  return { cards, lines, lessons };
}

const SCOPES = [
  ['upto', 'Đến bài đang học', 'Từ bài 1 tới bài đang học', 'today'],
  ['active', 'Bài đang học', 'Chỉ bài đang học', 'lessons'],
  ['learned', 'Từ đã học', 'Mọi từ đã học qua thẻ', 'cards'],
  ['all', 'Cả 2 quyển', 'Toàn bộ 30 bài', 'books'],
];

/** Bảng chọn phạm vi: 4 lựa chọn nhanh + lưới bài theo quyển. */
function openScopePicker(data, current, onPick) {
  const close = () => { dlg.close(); };
  const pick = (v) => { close(); onPick(v); };
  const books = [...new Set(data.lessons.map((l) => l.book))];
  const dlg = h('dialog', { class: 'scope-dialog', 'aria-label': 'Chọn phạm vi luyện' },
    h('div', { class: 'row between nowrap' }, h('h2', { style: { margin: 0 } }, 'Phạm vi luyện'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', onclick: close }, icon('close'))),
    h('div', { class: 'scope-opts' }, SCOPES.map(([v, label, desc, ic]) => h('button', { class: ['scope-opt', v === current ? 'on' : ''], type: 'button', onclick: () => pick(v) },
      h('span', { class: 'sc-ic' }, icon(ic)), h('span', { class: 'grow' }, h('strong', {}, label), h('span', { class: 'sc-meta' }, desc)), v === current ? icon('check') : null))),
    books.map((b) => [h('div', { class: 'section-title', style: { margin: '16px 2px 8px' } }, b),
      h('div', { class: 'lesson-pick' }, data.lessons.filter((l) => l.book === b).map((l) => {
        const st = data.statusById.get(l.id).status;
        return h('button', { class: ['lp-num', l.id === current ? 'on' : '', st], type: 'button', title: `Bài ${l.unit}: ${l.title}`, onclick: () => pick(l.id) }, String(l.unit));
      }))]));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
}

export async function renderHub(root, ctx, { query = {} } = {}) {
  const data = await ctx.loadAll();
  const s = ctx.settings;
  const scope = query.scope || s.practice_scope || 'upto';
  const { cards, lines, lessons } = scopeOf(data, scope);
  const stats = s.skill_stats || {};
  const best = {
    match: s.best_match_ms ? `Kỷ lục ${(s.best_match_ms / 1000).toFixed(1)}s` : 'Chưa chơi',
    race: s.best_race ? `Kỷ lục ${s.best_race} từ` : 'Chưa chơi',
    build: s.build_done ? `Đã xây ${s.build_done} câu` : 'Chưa chơi',
    listen: s.best_listen != null ? `Tốt nhất ${s.best_listen}/10` : 'Chưa chơi',
  };
  const setScope = async (v) => { await ctx.repo.saveSettings({ practice_scope: v }); await ctx.refreshSettings(); ctx.navigate(`practice?scope=${v}`); };
  const scopeLabel = /^L\d+$/.test(scope) ? `Bài ${Number(scope.slice(1))}` : (SCOPES.find((x) => x[0] === scope)?.[1] || '');

  mount(root,
    h('div', { class: 'large-title' },
      h('div', {}, h('div', { class: 'sub' }, 'Kỹ năng & trò chơi'), h('h1', {}, 'Luyện tập'))),
    h('button', { class: 'scope-card glass', type: 'button', onclick: () => openScopePicker(data, scope, setScope), 'aria-haspopup': 'dialog' },
      h('span', { class: 'sc-ic' }, icon('target')),
      h('span', { class: 'grow' },
        h('span', { class: 'sc-label' }, 'Phạm vi luyện'),
        h('strong', {}, scopeLabel),
        h('span', { class: 'sc-meta' }, `${cards.length} từ · ${lines.length} câu bài khóa`)),
      h('span', { class: 'sc-change' }, 'Đổi', icon('chevron'))),

    h('div', { class: 'section-title' }, 'Theo kỹ năng'),
    h('div', { class: 'skill-grid' }, SKILLS.map((k) => {
      const disabled = (k.id === 'listen' && !ttsSupported()) ? 'Máy không có giọng đọc' : (k.id === 'speak' && !speechOk() ? 'Tự đánh giá khi đọc' : null);
      const st = stats[k.id];
      return h('a', { class: ['skill-card', `tone-${k.tone}`], href: `#/practice/${k.id}?scope=${scope}` },
        h('span', { class: 'sk-ic' }, icon(k.icon)),
        h('span', { class: 'sk-body' },
          h('strong', {}, k.label),
          h('span', { class: 'sk-desc' }, k.desc),
          h('span', { class: 'sk-meta' }, st ? `Lần gần nhất ${Math.round(st.last * 100)}% · ${st.sets} lượt` : (disabled || 'Chưa luyện'))),
        st ? h('span', { class: 'sk-score' }, `${Math.round(st.best * 100)}%`) : icon('chevron'));
    })),

    h('div', { class: 'section-title' }, 'Trò chơi'),
    h('div', { class: 'game-grid' }, GAMES.map((g) => h('a', { class: ['game-card', `tone-${GAME_TONES[g.id]}`], href: `#/game/${g.id}` },
      h('span', { class: 'gc-ic' }, icon(GAME_ICONS[g.id] || 'game')),
      h('strong', {}, g.title),
      h('span', { class: 'sk-desc' }, g.desc),
      h('span', { class: 'gc-foot' }, h('span', { class: 'badge' }, best[g.id]), h('span', { class: 'gc-play' }, icon('play')))))),
    lessons.length ? null : h('p', { class: 'notice' }, 'Chưa có nội dung trong phạm vi này.'),
  );
}

export async function renderSkill(root, ctx, { params, query = {} }) {
  const data = await ctx.loadAll();
  const s = ctx.settings;
  const skill = SKILLS.find((k) => k.id === params.skill);
  if (!skill) { mount(root, h('p', {}, 'Không có kỹ năng này.')); return; }
  const scope = query.scope || s.practice_scope || 'upto';
  const { cards, lines } = scopeOf(data, scope);
  const dict = buildDictionary(data.cards);
  const withTokens = lines.map((l) => ({ zh: l.zh, vi: (l.vi || '').replace(/^\([^)]*\)\s*/, ''), tokens: segmentSentence(l.zh.replace(/[。？！]+$/, ''), dict) }));
  const questions = buildSkillSet(skill.id, { cards, pool: data.cards, lines: withTokens, n: 10 });
  const back = `practice?scope=${scope}`;
  if (!questions.length) {
    mount(root, h('div', { class: 'large-title' }, h('h1', {}, skill.label)),
      h('p', { class: 'notice' }, 'Phạm vi này chưa đủ nội dung cho kỹ năng này. Thử chọn phạm vi rộng hơn.'),
      h('a', { class: 'btn', href: `#/${back}` }, icon('back'), 'Luyện tập'));
    return;
  }
  const tracker = ctx.startTracking({ kind: 'practice' });
  const shell = focusShell({ onClose: () => ctx.navigate(back) });
  mount(root, shell.el);
  const wrong = new Set();
  const runner = exerciseRunner({
    shell, exercises: questions, mode: 'practice', rate: s.tts_rate,
    onAnswer: async (ex, ok) => {
      for (const id of ex.card_ids || []) {
        if (!ok) wrong.add(id);
        if (data.statesById.get(id)) await ctx.repo.recordReview({ cardId: id, quality: ok ? 4 : 2, activity: 'practice', sessionId: tracker.session.id, mode: 'light' });
      }
    },
    onDone: async (r) => {
      const session = await tracker.stop();
      if (wrong.size) await ctx.repo.makeDue([...wrong]);
      const all = { ...(s.skill_stats || {}) };
      const prev = all[skill.id] || { sets: 0, best: 0 };
      all[skill.id] = { sets: prev.sets + 1, best: Math.max(prev.best, r.score), last: r.score, at: Date.now() };
      await ctx.repo.saveSettings({ skill_stats: all });
      await ctx.refreshSettings();
      cue('done');
      shell.setProgress(1, '');
      shell.main.replaceChildren(resultView({
        emoji: badgeIcon(skill.icon, r.score >= 0.7 ? 'good' : 'accent'),
        title: `${skill.label}: ${r.score >= 0.8 ? 'Tốt lắm!' : r.score >= 0.5 ? 'Khá ổn' : 'Luyện thêm nhé'}`,
        score: r.score, correct: r.correct, total: r.total, activeMs: session.active_ms,
      }), reviewWords([...wrong].map((id) => data.cardsById.get(id)).filter(Boolean), { rate: s.tts_rate }));
      shell.setFooter(h('div', { class: 'row nowrap' },
        h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(back) }, 'Kỹ năng khác'),
        h('button', { class: 'btn primary big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(`practice/${skill.id}?scope=${scope}&r=${Date.now()}`) }, 'Luyện tiếp')));
    },
  });
  return () => { runner.destroy(); shell.destroy(); return tracker.stop(); };
}
