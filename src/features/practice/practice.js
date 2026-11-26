// #/practice            Trung tâm luyện tập: chọn phạm vi, luyện theo kỹ năng, trò chơi.
// #/practice/:skill     Một lượt luyện 10 câu theo kỹ năng (phản hồi ngay sau mỗi câu).

import { h, mount } from '../../ui/dom.js';
import { icon, badgeIcon } from '../../ui/icons.js';
import { focusShell } from '../../ui/focus.js';
import { cue } from '../../ui/feedback.js';
import { ttsSupported } from '../../ui/speech.js';
import { SKILLS, buildSkillSet, qaPairs } from '../../core/practice.js';
import { freshOrder, markSeen } from '../../core/variety.js';
import { recordAnswer } from '../exercises/record.js';
import { startOrResume, resumeOpts, clearResume } from '../exercises/resume.js';
import { buildDictionary, segmentSentence } from '../../core/segment.js';
import { exerciseRunner } from '../exercises/runner.js';
import { resultView, reviewWords, answerList } from '../exercises/result-view.js';
import { loadDecomp } from '../../ui/char-anatomy.js';
import { GAMES } from '../games/games.js';

export const GAME_ICONS = { match: 'link', race: 'bolt', build: 'blocks', listen: 'headphones', quick: 'target', compose: 'radical', duel: 'trophy', memory: 'cards' };
const GAME_TONES = { match: 'orange', race: 'red', build: 'teal', listen: 'blue', quick: 'purple', compose: 'green', duel: 'navy', memory: 'red' };
const speechOk = () => !!(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);

const RECENT_MS = 3 * 86_400_000;
/** Từ vừa học: lần học gần nhất trong 3 ngày qua. */
export function recentCards(data, now = Date.now()) {
  return data.cards.filter((c) => (data.statesById.get(c.id)?.last_reviewed_at || 0) >= now - RECENT_MS);
}

/** Phạm vi luyện: 'upto' (từ bài 1 đến bài đang học), 'recent', 'learned', 'active', 'all', hoặc mã bài. */
export function scopeOf(data, scope) {
  const learned = (c) => data.statesById.get(c.id)?.last_reviewed_at != null;
  const activeIdx = data.active ? data.lessons.indexOf(data.active) : data.lessons.length - 1;
  if (scope === 'recent') {
    const rc = recentCards(data);
    if (rc.length >= 4) {
      const ids = new Set(rc.map((c) => c.lesson_id));
      const lessons = data.lessons.filter((l) => ids.has(l.id));
      const hz = rc.map((c) => c.hanzi);
      // Chỉ giữ câu bài khóa có chứa từ vừa học.
      const keep = (zh) => hz.some((w) => zh.includes(w));
      const lines = lessons.flatMap((l) => (l.texts || []).flatMap((t) => t.lines)).filter((ln) => keep(ln.zh));
      const pairs = lessons.flatMap((l) => qaPairs(l.texts, l.id)).filter((p) => keep(p.q.zh + p.a.zh));
      return { cards: rc, lines, lessons, pairs };
    }
    scope = 'active';
  }
  let lessons;
  if (scope === 'all' || scope === 'learned') lessons = data.lessons;
  else if (scope === 'active') lessons = data.active ? [data.active] : data.lessons.slice(0, 1);
  else if (/^L\d+(,L\d+)*$/.test(scope || '')) { const pick = new Set(scope.split(',')); lessons = data.lessons.filter((l) => pick.has(l.id)); }
  else lessons = data.lessons.slice(0, Math.max(1, activeIdx + 1));
  const ids = new Set(lessons.flatMap((l) => l.vocab_ids));
  let cards = data.cards.filter((c) => ids.has(c.id) || (scope !== 'active' && c.source === 'reading'));
  if (scope === 'learned') cards = data.cards.filter(learned);
  const lines = lessons.flatMap((l) => (l.texts || []).flatMap((t) => t.lines));
  const pairs = lessons.flatMap((l) => qaPairs(l.texts, l.id));
  return { cards, lines, lessons, pairs };
}

const SCOPES = [
  ['upto', 'Đến bài đang học', 'Từ bài 1 tới bài đang học', 'today'],
  ['recent', 'Từ vừa học', 'Các từ học trong 3 ngày qua', 'sparkle'],
  ['active', 'Bài đang học', 'Chỉ bài đang học', 'lessons'],
  ['learned', 'Từ đã học', 'Mọi từ đã học qua thẻ', 'cards'],
  ['all', 'Cả 2 quyển', 'Toàn bộ 30 bài', 'books'],
];

/** Bảng chọn phạm vi: 4 lựa chọn nhanh + lưới bài theo quyển. */
function openScopePicker(data, current, onPick) {
  const close = () => { dlg.close(); };
  const pick = (v) => { close(); onPick(v); };
  const books = [...new Set(data.lessons.map((l) => l.book))];
  // Chọn nhiều bài: bấm để bật/tắt, rồi bấm "Luyện N bài".
  const chosen = new Set(/^L\d+(,L\d+)*$/.test(current || '') ? current.split(',') : []);
  // Mặc định như cũ: bấm 1 bài là chọn luôn. Bật "Chọn nhiều bài" để chọn nhiều.
  let multi = /,/.test(current || '');
  const multiBtn = h('button', { class: ['chip', 'opt', multi ? 'selected' : ''], type: 'button', 'aria-pressed': String(multi), onclick: () => {
    multi = !multi;
    multiBtn.classList.toggle('selected', multi); multiBtn.setAttribute('aria-pressed', String(multi));
    if (multi && !chosen.size && /^L\d+$/.test(current || '')) chosen.add(current);
    dlg.querySelectorAll('.lp-num').forEach((b) => b.classList.toggle('on', multi ? chosen.has(b.dataset.id) : b.dataset.id === current));
    paintFoot();
  } }, icon('check'), 'Chọn nhiều bài');
  const foot = h('div', { class: 'scope-foot' });
  const goBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => pick(data.lessons.filter((l) => chosen.has(l.id)).map((l) => l.id).join(',')) });
  const clearBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { chosen.clear(); dlg.querySelectorAll('.lp-num.on').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); paintFoot(); } }, 'Bỏ chọn');
  function paintFoot() { foot.classList.toggle('hidden', !multi); goBtn.textContent = chosen.size ? `Luyện ${chosen.size} bài đã chọn` : 'Chọn bài ở trên'; goBtn.disabled = !chosen.size; clearBtn.classList.toggle('hidden', !chosen.size); }
  foot.append(clearBtn, goBtn);
  function toggle(id, btn) { if (chosen.has(id)) chosen.delete(id); else chosen.add(id); btn.classList.toggle('on', chosen.has(id)); btn.setAttribute('aria-pressed', String(chosen.has(id))); paintFoot(); }
  const dlg = h('dialog', { class: 'scope-dialog', 'aria-label': 'Chọn phạm vi luyện' },
    h('div', { class: 'row between nowrap' }, h('h2', { style: { margin: 0 } }, 'Phạm vi luyện'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', onclick: close }, icon('close'))),
    h('div', { class: 'scope-opts' }, SCOPES.map(([v, label, desc, ic]) => h('button', { class: ['scope-opt', v === current ? 'on' : ''], type: 'button', onclick: () => pick(v) },
      h('span', { class: 'sc-ic' }, icon(ic)), h('span', { class: 'grow' }, h('strong', {}, label), h('span', { class: 'sc-meta' }, desc)), v === current ? icon('check') : null))),
    h('div', { class: 'scope-multi' }, multiBtn),
    books.map((b) => [h('div', { class: 'section-title', style: { margin: '16px 2px 8px' } }, b),
      h('div', { class: 'lesson-pick' }, data.lessons.filter((l) => l.book === b).map((l) => {
        const st = data.statusById.get(l.id).status;
        return h('button', { class: ['lp-num', (multi ? chosen.has(l.id) : l.id === current) ? 'on' : '', st], type: 'button', title: `Bài ${l.unit}: ${l.title}`, 'aria-pressed': String(chosen.has(l.id)), dataset: { id: l.id }, onclick: (e) => (multi ? toggle(l.id, e.currentTarget) : pick(l.id)) }, String(l.unit));
      }))]),
    foot);
  paintFoot();
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
}

export async function renderHub(root, ctx, { query = {}, name } = {}) {
  const data = await ctx.loadAll();
  const s = ctx.settings;
  const scope = query.scope || s.practice_scope || 'upto';
  const tab = query.tab === 'games' || location.hash.startsWith('#/games') ? 'games' : 'skills';
  const { cards, lines, lessons } = scopeOf(data, scope);
  const stats = s.skill_stats || {};
  const best = {
    match: s.best_match_ms ? `Kỷ lục ${(s.best_match_ms / 1000).toFixed(1)}s` : 'Chưa chơi',
    race: s.best_race ? `Kỷ lục ${s.best_race} từ` : 'Chưa chơi',
    build: s.build_done ? `Đã xây ${s.build_done} câu` : 'Chưa chơi',
    listen: s.best_listen != null ? `Tốt nhất ${s.best_listen}/10` : 'Chưa chơi',
  };
  const setScope = async (v) => { await ctx.repo.saveSettings({ practice_scope: v }); await ctx.refreshSettings(); ctx.navigate(`${tab === 'games' ? 'games' : 'practice'}?scope=${v}`); };
  const scopeLabel = /^L\d+(,L\d+)*$/.test(scope) ? (() => { const n = scope.split(',').map((x) => Number(x.slice(1))); return n.length === 1 ? `Bài ${n[0]}` : n.length <= 4 ? `Bài ${n.join(', ')}` : `${n.length} bài đã chọn`; })() : (SCOPES.find((x) => x[0] === scope)?.[1] || '');

  mount(root,
    h('div', { class: 'large-title' },
      h('div', {}, h('div', { class: 'sub' }, 'Luyện tập'), h('h1', {}, tab === 'games' ? 'Trò chơi' : 'Kỹ năng')),
      h('div', { class: 'seg seg-fit seg-page', role: 'tablist' },
        h('a', { class: ['seg-btn', tab === 'skills' ? 'on' : ''], href: '#/practice', role: 'tab', 'aria-selected': String(tab === 'skills') }, 'Kỹ năng'),
        h('a', { class: ['seg-btn', tab === 'games' ? 'on' : ''], href: '#/games', role: 'tab', 'aria-selected': String(tab === 'games') }, 'Trò chơi'))),
    h('button', { class: 'scope-card glass', type: 'button', onclick: () => openScopePicker(data, scope, setScope), 'aria-haspopup': 'dialog' },
      h('span', { class: 'sc-ic' }, icon('target')),
      h('span', { class: 'grow' },
        h('span', { class: 'sc-label' }, 'Phạm vi luyện'),
        h('strong', {}, scopeLabel),
        h('span', { class: 'sc-meta' }, `${cards.length} từ · ${lines.length} câu bài khóa`)),
      h('span', { class: 'sc-change' }, 'Đổi', icon('chevron'))),

    tab === 'skills' ? h('div', { class: 'skill-grid' }, SKILLS.map((k) => {
      const disabled = (k.id === 'listen' && !ttsSupported()) ? 'Máy không có giọng đọc' : (k.id === 'speak' && !speechOk() ? 'Tự đánh giá khi đọc' : null);
      const st = stats[k.id];
      return h('a', { class: ['skill-card', `tone-${k.tone}`], href: `#/practice/${k.id}?scope=${scope}` },
        h('span', { class: 'sk-ic' }, icon(k.icon)),
        h('span', { class: 'sk-body' },
          h('strong', {}, k.label),
          h('span', { class: 'sk-desc' }, k.desc),
          h('span', { class: 'sk-meta' }, st ? `Lần gần nhất ${Math.round(st.last * 100)}% · ${st.sets} lượt` : (disabled || 'Chưa luyện'))),
        st ? h('span', { class: 'sk-score' }, `${Math.round(st.best * 100)}%`) : icon('chevron'));
    })) : null,

    tab === 'games' ? h('div', { class: 'game-grid' }, GAMES.map((g) => h('a', { class: ['game-card', `tone-${GAME_TONES[g.id]}`], href: `#/game/${g.id}` },
      h('span', { class: 'gc-ic' }, icon(GAME_ICONS[g.id] || 'game')),
      h('strong', {}, g.title),
      h('span', { class: 'sk-desc' }, g.desc),
      h('span', { class: 'gc-foot' }, starBadge((s.game_stars || {})[g.id], best[g.id]), h('span', { class: 'gc-play' }, icon('play')))))) : null,
    lessons.length ? null : h('p', { class: 'notice' }, 'Chưa có nội dung trong phạm vi này.'),
  );
}

export async function renderSkill(root, ctx, { params, query = {} }) {
  const data = await ctx.loadAll();
  const s = ctx.settings;
  const skill = SKILLS.find((k) => k.id === params.skill);
  if (!skill) { mount(root, h('p', {}, 'Không có kỹ năng này.')); return; }
  const scope = query.scope || s.practice_scope || 'upto';
  const { cards, lines, pairs } = scopeOf(data, scope);
  const dict = buildDictionary(data.cards);
  const stripVi = (vi) => (vi || '').replace(/^\([^)]*\)\s*/, '');
  const withTokens = lines.map((l) => ({ zh: l.zh, vi: stripVi(l.vi), tokens: segmentSentence(l.zh.replace(/[。？！]+$/, ''), dict) }));
  const qa = skill.id === 'qa' ? pairs.map((p) => ({ ...p, q: { ...p.q, vi: stripVi(p.q.vi) }, a: { ...p.a, vi: stripVi(p.a.vi) }, tokens: segmentSentence(p.a.zh.replace(/[。？！!?]+$/, ''), dict) })) : [];
  const decomp = skill.id === 'parts' ? await loadDecomp() : null;
  // Ưu tiên từ / câu lâu chưa gặp; từ hay sai và từ vừa học được cộng điểm.
  const recentHz = recentCards(data).map((c) => c.hanzi);
  const now = Date.now();
  const order = (arr, kind) => (kind === 'word'
    ? freshOrder(arr, 'w', { bonus: (c) => { const st = data.statesById.get(c.id); return st && st.due_at <= now ? 0.8 : 0; } })
    : kind === 'pair'
      ? freshOrder(arr, 'pair', { key: (p) => `${p.q.zh}|${p.a.zh}`, bonus: (p) => Math.min(3, recentHz.filter((w) => (p.q.zh + p.a.zh).includes(w)).length) * 0.8 })
      : freshOrder(arr, 'line', { key: (l) => l.zh }));
  const questions = buildSkillSet(skill.id, { cards, pool: data.cards, lines: withTokens, pairs: qa, n: 10, decomp, order });
  markSeen('w', questions.flatMap((q) => q.card_ids || []));
  markSeen('line', questions.map((q) => q.speak || q.answer).filter((x) => typeof x === 'string'));
  markSeen('pair', questions.filter((q) => q.qa).map((q) => `${q.qa.q.zh}|${q.qa.a.zh}`));
  const fromLesson = /^L\d+$/.test(query.from || '') ? query.from : null;
  const back = fromLesson ? `lesson/${fromLesson}` : `practice?scope=${scope}`;
  if (!questions.length) {
    mount(root, h('div', { class: 'large-title' }, h('h1', {}, skill.label)),
      h('p', { class: 'notice' }, 'Phạm vi này chưa đủ nội dung cho kỹ năng này. Thử chọn phạm vi rộng hơn.'),
      h('a', { class: 'btn', href: `#/${back}` }, icon('back'), 'Luyện tập'));
    return;
  }
  const tracker = ctx.startTracking({ kind: 'practice' });
  const shell = focusShell({ onClose: () => ctx.navigate(back) });
  mount(root, shell.el);
  const RESUME_ID = `practice:${skill.id}:${scope}`;
  let runner = null;
  const wrong = new Set();
  const start = (saved) => {
    const exercises = saved?.exercises || questions;
    for (const r of saved?.results || []) if (!r.correct) for (const id of r.question.card_ids || []) wrong.add(id);
    runner = exerciseRunner({
      shell, exercises, mode: 'practice', rate: s.tts_rate, ...resumeOpts(RESUME_ID, saved, exercises),
      onAnswer: async (ex, ok) => {
        if (!ok) for (const id of ex.card_ids || []) wrong.add(id);
        await recordAnswer(ctx.repo, ex.card_ids, ok, { activity: ex.activity || `practice-${skill.id}`, sessionId: tracker.session.id });
      },
      onDone: async (r) => {
        clearResume(RESUME_ID);
        const session = await tracker.stop();
        if (wrong.size) await ctx.repo.makeDue([...wrong]);
        const all = { ...(s.skill_stats || {}) };
        const prev = all[skill.id] || { sets: 0, best: 0 };
        all[skill.id] = { sets: prev.sets + 1, best: Math.max(prev.best, r.score), last: r.score, at: Date.now() };
        await ctx.repo.saveSettings({ skill_stats: all });
        // Luyện trong phạm vi một bài: lưu điểm vào tiến độ của bài đó.
        if (/^L\d+$/.test(scope)) await ctx.repo.saveSkillScore(scope, skill.id, r.score);
        await ctx.refreshSettings();
        cue('done');
        shell.setProgress(1, '');
        shell.main.replaceChildren(resultView({
          emoji: badgeIcon(skill.icon, r.score >= 0.7 ? 'good' : 'accent'),
          title: `${skill.label}: ${r.score >= 0.8 ? 'Tốt lắm!' : r.score >= 0.5 ? 'Khá ổn' : 'Luyện thêm nhé'}`,
          score: r.score, correct: r.correct, total: r.total, activeMs: session.active_ms,
        }), reviewWords([...wrong].map((id) => data.cardsById.get(id)).filter(Boolean), { rate: s.tts_rate }), answerList(r.results, { rate: s.tts_rate }));
        shell.setFooter(h('div', { class: 'row nowrap' },
          h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(back) }, fromLesson ? 'Về bài' : 'Kỹ năng khác'),
          h('button', { class: 'btn primary big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate(`practice/${skill.id}?scope=${scope}${fromLesson ? `&from=${fromLesson}` : ''}&r=${Date.now()}`) }, 'Luyện tiếp')));
      },
    });
  };
  startOrResume(shell, RESUME_ID, skill.label, start);
  return () => { runner?.destroy(); shell.destroy(); return tracker.stop(); };
}

/** Huy hiệu sao tốt nhất của trò (3 sao), hoặc nhãn kỷ lục cũ. */
function starBadge(n, label) {
  if (n == null) return h('span', { class: 'badge' }, label || 'Chưa chơi');
  return h('span', { class: 'badge stars-badge', 'aria-label': `${n}/3 sao` }, [0, 1, 2].map((k) => h('i', { class: k < n ? 'on' : '' }, '★')));
}
