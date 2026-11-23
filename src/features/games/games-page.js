// #/games: danh sách trò chơi; #/game/:name: chơi một trò.

import { h, mount } from '../../ui/dom.js';
import { icon, badgeIcon } from '../../ui/icons.js';
import { focusShell } from '../../ui/focus.js';
import { cue } from '../../ui/feedback.js';
import { GAMES, gameCards, matchGame, raceGame, buildGame, listenGame, chineseVoice } from './games.js';

export async function renderList(root, ctx) {
  const s = ctx.settings;
  const best = {
    match: s.best_match_ms ? `Kỷ lục: ${(s.best_match_ms / 1000).toFixed(1)} giây` : '',
    race: s.best_race ? `Kỷ lục: ${s.best_race} đúng` : '',
    build: s.build_done ? `Đã xây ${s.build_done} câu` : '',
    listen: s.best_listen != null ? `Tốt nhất: ${s.best_listen}/10` : '',
  };
  mount(root,
    h('div', { class: 'large-title' }, h('h1', {}, 'Trò chơi')),
    h('p', { class: 'muted' }, 'Mỗi trò dưới 2 phút. Dùng từ đã học; kết quả chỉ ảnh hưởng nhẹ tới lịch ôn.'),
    h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' } },
      GAMES.map((g) => h('a', { class: 'card px-box', href: `#/game/${g.id}`, style: { textDecoration: 'none', color: 'var(--ink)' } },
        h('div', { style: { width: '28px', height: '28px', marginBottom: '8px' } }, icon({ match: 'link', race: 'bolt', build: 'puzzle', listen: 'headphones' }[g.id] || 'game')),
        h('h2', { style: { marginBottom: '4px' } }, g.title),
        h('p', { class: 'muted small', style: { margin: 0 } }, g.desc),
        best[g.id] ? h('p', { class: 'small', style: { margin: '8px 0 0', fontWeight: 600 } }, best[g.id]) : null))));
}

export async function renderGame(root, ctx, { params }) {
  const data = await ctx.loadAll();
  const s = ctx.settings;
  const game = GAMES.find((g) => g.id === params.name);
  if (!game) { mount(root, h('p', {}, 'Không có trò chơi này.')); return; }
  if (data.cards.length < 4) {
    mount(root, h('h1', {}, game.title), h('p', { class: 'notice' }, 'Cần ít nhất 4 từ để chơi. Hãy nạp nội dung và học vài từ trước.'));
    return;
  }
  const tracker = ctx.startTracking({ kind: 'game' });
  const shell = focusShell({ onClose: () => ctx.navigate('games') });
  mount(root, shell.el);
  shell.setProgress(0, '');
  const stage = shell.main;
  const record = (id, ok) => (cue(ok ? 'tap' : 'bad'), ctx.repo.recordReview({ cardId: id, quality: ok ? 4 : 2, activity: 'game', sessionId: tracker.session.id, mode: 'light' }));
  let current;

  const again = () => ctx.navigate(`game/${game.id}?r=${Date.now()}`);
  const resultView = (title, lines) => {
    tracker.stop();
    cue('done');
    shell.setProgress(1, '');
    mount(stage, h('div', { class: 'result' }, badgeIcon('flag', 'good'), h('h1', {}, title), lines.map((l) => h('p', {}, l))));
    shell.setFooter(h('div', { class: 'row nowrap' },
      h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate('games') }, 'Trò khác'),
      h('button', { class: 'btn primary big', type: 'button', style: { flex: 1 }, onclick: again }, 'Chơi lại')));
  };

  if (game.id === 'match') {
    current = matchGame({
      cards: gameCards(data, 6), onResult: record,
      onDone: async (r) => {
        const isBest = !s.best_match_ms || r.ms < s.best_match_ms;
        if (isBest) await ctx.repo.saveSettings({ best_match_ms: Math.round(r.ms) });
        await ctx.refreshSettings();
        resultView(isBest ? 'Kỷ lục mới!' : 'Xong!', [`${(r.ms / 1000).toFixed(1)} giây, nhầm ${r.mistakes} lần.`]);
      },
    });
  } else if (game.id === 'race') {
    current = raceGame({
      cards: gameCards(data, 40), pool: data.cards, onResult: record,
      onDone: async (r) => {
        const isBest = r.correct > (s.best_race || 0);
        if (isBest) await ctx.repo.saveSettings({ best_race: r.correct });
        await ctx.refreshSettings();
        resultView(isBest ? 'Kỷ lục mới!' : 'Hết giờ!', [`Đúng ${r.correct}/${r.total} từ trong 60 giây.`]);
      },
    });
  } else if (game.id === 'build') {
    const sentences = [...data.exercisesByLesson.values()].flat().filter((e) => e.type === 'reorder');
    if (!sentences.length) {
      tracker.stop();
      shell.destroy();
      mount(root, h('div', { class: 'large-title' }, h('h1', {}, 'Xây câu')), h('p', { class: 'notice' }, 'Chưa có câu nào. Thêm bài tập dạng "reorder" vào file bài học để chơi trò này.'));
      return;
    }
    current = buildGame({
      sentences,
      onDone: async (r) => {
        await ctx.repo.saveSettings({ build_done: (s.build_done || 0) + r.done });
        await ctx.refreshSettings();
        resultView('Xong!', [`Hoàn thành ${r.done}/${r.total} câu.`]);
      },
    });
  } else if (game.id === 'listen') {
    const voice = await chineseVoice();
    if (!voice) {
      stage.append(h('p', { class: 'notice' }, 'Thiết bị chưa có giọng đọc tiếng Trung nên chưa phát được âm.'));
    }
    current = listenGame({
      cards: gameCards(data, 10), pool: data.cards, rate: s.tts_rate, onResult: record,
      onDone: async (r) => {
        if (s.best_listen == null || r.correct > s.best_listen) await ctx.repo.saveSettings({ best_listen: r.correct });
        await ctx.refreshSettings();
        resultView('Xong!', [`Nghe đúng ${r.correct}/${r.total}.`]);
      },
    });
  }
  stage.append(current.el);
  return () => { current?.destroy?.(); shell.destroy(); return tracker.stop(); };
}
