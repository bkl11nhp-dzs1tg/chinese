// #/games: danh sách trò chơi; #/game/:name: chơi một trò.

import { h, mount } from '../../ui/dom.js';
import { icon, badgeIcon } from '../../ui/icons.js';
import { focusShell } from '../../ui/focus.js';
import { cue } from '../../ui/feedback.js';
import { GAMES, gameCards, matchGame, raceGame, buildGame, listenGame, chineseVoice } from './games.js';
import { quickGame, composeGame, duelGame, memoryGame, starsFor } from './games2.js';
import { loadDecomp } from '../../ui/char-anatomy.js';
import { freshOrder, markSeen } from '../../core/variety.js';

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
  const onProgress = (f, label) => shell.setProgress(f, label);

  const again = () => ctx.navigate(`game/${game.id}?r=${Date.now()}`);
  const resultView = async (title, lines, stars = null) => {
    tracker.stop();
    cue('done');
    shell.setProgress(1, '');
    let best = null;
    if (stars != null) {
      const all = { ...(ctx.settings.game_stars || {}) };
      best = Math.max(all[game.id] ?? 0, stars);
      if (best !== all[game.id]) { all[game.id] = best; await ctx.repo.saveSettings({ game_stars: all }); await ctx.refreshSettings(); }
    }
    mount(stage, h('div', { class: 'result' },
      stars != null ? h('div', { class: 'star-row', 'aria-label': `${stars}/3 sao` }, [0, 1, 2].map((k) => h('span', { class: ['big-star', k < stars ? 'on' : ''], style: { '--d': `${k * 160}ms` } }, '★'))) : badgeIcon('flag', 'good'),
      h('h1', {}, title), lines.map((l) => h('p', {}, l)),
      stars != null && best > stars ? h('p', { class: 'muted small' }, `Tốt nhất: ${'★'.repeat(best)}`) : null));
    shell.setFooter(h('div', { class: 'row nowrap' },
      h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: () => ctx.navigate('games') }, 'Trò khác'),
      h('button', { class: 'btn primary big', type: 'button', style: { flex: 1 }, onclick: again }, 'Chơi lại')));
  };

  if (game.id === 'match') {
    current = matchGame({ onProgress,
      cards: gameCards(data, 6), onResult: record,
      onDone: async (r) => {
        const isBest = !s.best_match_ms || r.ms < s.best_match_ms;
        if (isBest) await ctx.repo.saveSettings({ best_match_ms: Math.round(r.ms) });
        await ctx.refreshSettings();
        resultView(isBest ? 'Kỷ lục mới!' : 'Xong!', [`${(r.ms / 1000).toFixed(1)} giây, nhầm ${r.mistakes} lần.`], r.mistakes === 0 && r.ms < 25000 ? 3 : r.mistakes <= 2 ? 2 : 1);
      },
    });
  } else if (game.id === 'race') {
    current = raceGame({
      cards: gameCards(data, 40), pool: data.cards, onResult: record,
      onDone: async (r) => {
        const isBest = r.correct > (s.best_race || 0);
        if (isBest) await ctx.repo.saveSettings({ best_race: r.correct });
        await ctx.refreshSettings();
        resultView(isBest ? 'Kỷ lục mới!' : 'Hết giờ!', [`Đúng ${r.correct}/${r.total} từ trong 60 giây.`], r.correct >= 15 && r.correct / Math.max(1, r.total) >= 0.85 ? 3 : r.correct >= 9 ? 2 : r.correct >= 4 ? 1 : 0);
      },
    });
  } else if (game.id === 'build') {
    // Câu của các bài đã qua tới bài đang học, ưu tiên câu lâu chưa gặp.
    const activeIdx = data.active ? data.lessons.indexOf(data.active) : data.lessons.length - 1;
    const okLessons = new Set(data.lessons.slice(0, Math.max(1, activeIdx + 1)).map((l) => l.id));
    const sentKey = (e) => (Array.isArray(e.answer) ? e.answer.join('') : String(e.answer));
    let sentences = [...data.exercisesByLesson.entries()].filter(([id]) => okLessons.has(id)).flatMap(([, xs]) => xs).filter((e) => e.type === 'reorder');
    if (sentences.length < 4) sentences = [...data.exercisesByLesson.values()].flat().filter((e) => e.type === 'reorder');
    sentences = freshOrder(sentences, 'line', { key: sentKey }).slice(0, 8);
    markSeen('line', sentences.map(sentKey));
    if (!sentences.length) {
      tracker.stop();
      shell.destroy();
      mount(root, h('div', { class: 'large-title' }, h('h1', {}, 'Xây câu')), h('p', { class: 'notice' }, 'Chưa có câu nào. Thêm bài tập dạng "reorder" vào file bài học để chơi trò này.'));
      return;
    }
    current = buildGame({ onProgress,
      sentences,
      onDone: async (r) => {
        await ctx.repo.saveSettings({ build_done: (s.build_done || 0) + r.done });
        await ctx.refreshSettings();
        resultView('Xong!', [`Hoàn thành ${r.done}/${r.total} câu.`], starsFor(r.done / Math.max(1, r.total)));
      },
    });
  } else if (game.id === 'listen') {
    const voice = await chineseVoice();
    if (!voice) {
      stage.append(h('p', { class: 'notice' }, 'Thiết bị chưa có giọng đọc tiếng Trung nên chưa phát được âm.'));
    }
    current = listenGame({ onProgress,
      cards: gameCards(data, 10), pool: data.cards, rate: s.tts_rate, onResult: record,
      onDone: async (r) => {
        if (s.best_listen == null || r.correct > s.best_listen) await ctx.repo.saveSettings({ best_listen: r.correct });
        await ctx.refreshSettings();
        resultView('Xong!', [`Nghe đúng ${r.correct}/${r.total}.`], starsFor(r.correct / Math.max(1, r.total)));
      },
    });
  }
  else if (game.id === 'quick') {
    current = quickGame({ onProgress, cards: gameCards(data, 10), pool: data.cards, onResult: record,
      onDone: (r) => resultView('Xong!', [`Đúng ${r.correct}/${r.total} · ${r.points} điểm`], r.correct === r.total && r.points >= r.total * 70 ? 3 : starsFor(r.correct / r.total) === 3 ? 2 : starsFor(r.correct / r.total)) });
  } else if (game.id === 'compose') {
    const decomp = await loadDecomp();
    current = composeGame({ onProgress, cards: gameCards(data, 30), decomp, onResult: record,
      onDone: (r) => (r.skipped ? resultView('Chưa đủ chữ', ['Học thêm vài bài rồi quay lại nhé.']) : resultView('Xong!', [`Ghép đúng ngay lần đầu ${r.correct}/${r.total} chữ.`], starsFor(r.correct / r.total))) });
  } else if (game.id === 'memory') {
    current = memoryGame({ onProgress, cards: gameCards(data, 6), onResult: record,
      onDone: (r) => resultView('Tìm đủ cặp!', [`${r.moves} lượt lật · ${(r.ms / 1000).toFixed(0)} giây`], r.moves <= r.pairs + 2 ? 3 : r.moves <= r.pairs * 2 ? 2 : 1) });
  } else if (game.id === 'duel') {
    document.body.classList.add('duel-mode');
    current = duelGame({ onProgress, cards: gameCards(data, 10), pool: data.cards,
      onDone: (r) => {
        document.body.classList.remove('duel-mode');
        const [a, b] = r.scores;
        resultView(a === b ? 'Hòa!' : a > b ? 'Đỏ thắng!' : 'Xanh thắng!', [`Đỏ ${a} – ${b} Xanh`]);
      } });
  }
  stage.append(current.el);
  return () => { document.body.classList.remove('duel-mode'); current?.destroy?.(); shell.destroy(); return tracker.stop(); };
}
