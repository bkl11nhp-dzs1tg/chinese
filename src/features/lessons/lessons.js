// Lộ trình bài học theo sách (mục 9.3) và trang một bài với các bước:
// 1. Học từ mới → 2. Nghe bài (MP3 của sách) → 3. Luyện tập → 4. Kiểm tra cuối bài.

import { nextLessonStep } from '../../core/lessons.js';
import { h, mount, toast, noteLines } from '../../ui/dom.js';
import { cue } from '../../ui/feedback.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { cardStatus } from '../../core/srs.js';
import { segmented } from '../reading/reading.js';
import { lessonAudioSrc } from '../../content.js';
import { qaPairs } from '../../core/practice.js';

const STATUS_LABEL = { todo: 'Chưa học', doing: 'Đang học', done: 'Hoàn thành' };
const statusBadge = (st) => h('span', { class: ['badge', st === 'done' ? 'done' : st === 'doing' ? 'doing' : 'new'] }, STATUS_LABEL[st]);

export const lessonArt = (id) => `./lessons/${encodeURIComponent(id)}.webp`;

export async function renderList(root, ctx, { query = {} } = {}) {
  const data = await ctx.loadAll();
  if (!data.lessons.length) {
    mount(root, h('div', { class: 'large-title' }, h('h1', {}, 'Bài học')), h('p', { class: 'notice' }, 'Chưa có nội dung bài học.'));
    return;
  }
  const books = [...new Set(data.lessons.map((l) => l.book))];
  const book = books.includes(query.book) ? query.book : (data.active?.book || books[0]);
  const filter = ['all', 'doing', 'done', 'todo'].includes(query.f) ? query.f : 'all';
  const inBook = data.lessons.filter((l) => l.book === book);
  const done = inBook.filter((l) => data.statusById.get(l.id).status === 'done').length;
  const search = h('input', { type: 'search', placeholder: 'Tìm bài: số bài, chữ Hán, tiếng Việt…', 'aria-label': 'Tìm bài', value: query.q || '' });
  const listEl = h('div', { class: 'lesson-list' });
  const go = (patch) => ctx.navigate(`lessons?${new URLSearchParams({ book, f: filter, ...patch })}`);
  function draw() {
    const term = search.value.trim().toLowerCase();
    const rows = inBook.filter((l) => {
      const st = data.statusById.get(l.id).status;
      if (filter !== 'all' && st !== filter) return false;
      return !term || `${l.unit} bài ${l.unit} ${l.title} ${l.title_vi || ''}`.toLowerCase().includes(term);
    });
    listEl.replaceChildren(...(rows.length ? rows.map((l) => {
      const st = data.statusById.get(l.id);
      const isCurrent = data.active?.id === l.id;
      return h('a', { class: ['lesson-card', isCurrent ? 'current' : ''], href: `#/lesson/${encodeURIComponent(l.id)}` },
        h('span', { class: 'thumb' }, h('img', { src: lessonArt(l.id), alt: '', loading: 'lazy', onerror: (e) => { e.target.remove(); } })),
        h('span', { class: 'info' },
          h('span', { class: 'top' }, h('span', { class: 'num' }, `BÀI ${l.unit ?? ''}`), isCurrent ? h('span', { class: 'badge doing' }, st.status === 'todo' ? 'Bắt đầu' : 'Đang học') : statusBadge(st.status)),
          h('span', { class: 'han t' }, l.title),
          h('span', { class: 'vi' }, l.title_vi || ''),
          h('span', { class: ['bar', 'thin', st.status === 'done' ? 'good' : ''] }, h('span', { style: { width: `${st.total ? (st.learned / st.total) * 100 : 0}%` } }))),
        icon('chevron'));
    }) : [h('p', { class: 'muted center' }, 'Không có bài phù hợp.')]));
  }
  search.addEventListener('input', draw);
  const chip = (id, label) => h('button', { class: ['chip', 'opt', filter === id ? 'selected' : ''], type: 'button', onclick: () => go({ f: id }) }, label);
  mount(root,
    h('div', { class: 'large-title' }, h('div', {}, h('div', { class: 'sub' }, 'Bài học'), h('h1', {}, 'Lộ trình')), segmented('path')),
    h('div', { class: 'unit-head' },
      h('div', { class: 'row between' },
        h('h2', {}, book),
        books.length > 1 ? h('div', { class: 'seg seg-fit seg-dark' }, books.map((b) => h('button', { class: ['seg-btn', b === book ? 'on' : ''], type: 'button', onclick: () => go({ book: b }) }, b.replace('Hán ngữ ', 'Quyển ')))) : null),
      h('div', { class: 'small', style: { opacity: 0.85 } }, `${done}/${inBook.length} bài hoàn thành`),
      h('div', { class: 'bar' }, h('span', { style: { width: `${(done / inBook.length) * 100}%` } }))),
    h('div', { class: 'filters lesson-filters' }, search,
      h('div', { class: 'chip-scroll' }, chip('all', 'Tất cả'), chip('doing', 'Đang học'), chip('todo', 'Chưa học'), chip('done', 'Đã xong'))),
    listEl);
  draw();
  requestAnimationFrame(() => listEl.querySelector('.current')?.scrollIntoView({ block: 'center' }));
}

export async function renderLesson(root, ctx, { params }) {
  const data = await ctx.loadAll();
  const lesson = data.lessons.find((l) => l.id === params.id);
  if (!lesson) { mount(root, h('p', {}, 'Không tìm thấy bài. '), h('a', { href: '#/lessons' }, 'Về lộ trình')); return; }
  const st = data.statusById.get(lesson.id);
  const progress = data.progressById.get(lesson.id);
  const rate = ctx.settings.tts_rate;
  const threshold = ctx.settings.pass_threshold;
  const cards = lesson.vocab_ids.map((id) => data.cardsById.get(id)).filter(Boolean);
  const audioUrl = await lessonAudioSrc(lesson.id);
  const wbCount = (data.exercisesByLesson.get(lesson.id) || []).filter((e) => e.source === 'workbook' || String(e.id).includes('-wb')).length;
  const idx = data.lessons.indexOf(lesson);
  const prev = data.lessons[idx - 1];
  const next = data.lessons[idx + 1];
  const allLearned = st.total > 0 && st.learned === st.total;
  const textCount = (lesson.texts || []).reduce((n, t) => n + t.lines.length, 0);
  const gpTotal = lesson.grammar_points?.length || 0;
  const gpDone = new Set((progress?.grammar_done || []).filter((id) => lesson.grammar_points?.some((g) => g.id === id)));
  const readProg = await ctx.repo.get('reading_progress', `lesson:${lesson.id}`);
  const marks = await ctx.repo.wordMarks();
  const testPassed = st.test_best != null && st.test_best >= threshold;
  const qaCount = qaPairs(lesson.texts, lesson.id).length;

  const stepRow = ({ n, iconName, title, meta, done, href, onclick }) => h(href ? 'a' : 'button', {
    class: 'row-link', href, type: href ? null : 'button', onclick,
  },
  h('span', { class: ['icon-box', done ? 'done' : ''] }, done ? icon('check') : icon(iconName)),
  h('span', { class: 'grow' }, h('div', { class: 'title' }, `${n}. ${title}`), h('div', { class: 'meta' }, meta)),
  icon('chevron'));

  const startLearning = async () => {
    await ctx.repo.saveSettings({ active_lesson_id: lesson.id });
    await ctx.refreshSettings();
    ctx.navigate(`session?lesson=${encodeURIComponent(lesson.id)}`);
  };
  // Bước nên làm tiếp theo: học từ → kiểm tra.
  const step = nextLessonStep(lesson, st, { readFinished: !!readProg?.finished, readStarted: !!readProg, threshold, next });
  const primary = step.id === 'words'
    ? h('button', { class: 'btn primary big block', type: 'button', onclick: startLearning }, icon('play'), step.label)
    : step.id === 'next'
      ? h('button', { class: 'btn primary big block', type: 'button', onclick: async () => { await ctx.repo.saveSettings({ active_lesson_id: next.id }); await ctx.refreshSettings(); ctx.navigate(`lesson/${encodeURIComponent(next.id)}`); } }, step.label, icon('chevron'))
      : h('a', { class: 'btn primary big block', href: step.href }, step.label);

  mount(root, h('div', { class: 'lesson-page' }, h('div', { class: 'lp-aside' },
    h('p', { style: { margin: 0 } }, h('a', { class: 'btn ghost', href: '#/lessons', style: { paddingLeft: 0 } }, icon('back'), 'Lộ trình')),
    h('div', { class: 'hero px-box center lesson-hero' },
      h('div', { class: 'art' }, h('img', { src: lessonArt(lesson.id), alt: '', onerror: (e) => e.target.parentNode.remove() })),
      h('div', { class: 'q-type' }, `${lesson.book} · Bài ${lesson.unit ?? ''}`),
      h('h1', { class: 'han', lang: 'zh-CN', style: { fontSize: '36px', fontWeight: 600, margin: '4px 0' } }, lesson.title),
      lesson.title_vi ? h('p', { class: 'muted', style: { margin: 0 } }, lesson.title_vi) : null,
      h('div', { style: { margin: '14px 0 4px' } }, statusBadge(st.status)),
      h('div', { class: 'bar', style: { margin: '12px 0 18px' }, role: 'progressbar', 'aria-label': 'Từ đã học', 'aria-valuenow': st.learned, 'aria-valuemax': st.total },
        h('span', { style: { width: `${st.total ? (st.learned / st.total) * 100 : 0}%` } })),
      primary)),
    h('div', { class: 'lp-main' },

    h('div', { class: 'section-title' }, 'Các bước'),
    h('div', { class: 'group' },
      stepRow({ n: 1, iconName: 'cards', title: allLearned ? 'Học từ mới · Xem lại' : 'Học từ mới', meta: allLearned ? `Đã học ${st.total} từ · ôn lại cả bài` : `${st.learned}/${st.total} từ đã học`, done: allLearned, onclick: startLearning }),
      stepRow({ n: 2, iconName: 'pencil', title: 'Luyện nhớ & viết', meta: st.recall_best != null ? `Nhớ đúng ${Math.round(st.recall_best * 100)}% · xem nét, viết theo mẫu, tự viết, nghe viết` : 'Xem thứ tự nét, viết theo mẫu, ẩn mẫu tự viết, nghe rồi viết', done: st.recall_best != null && st.recall_best >= 0.7, href: `#/recall/${encodeURIComponent(lesson.id)}` }),
      textCount
        ? stepRow({ n: 3, iconName: 'lessons', title: 'Bài khóa', meta: `${textCount} câu · bấm từ để tra, nghe từng câu${readProg?.finished ? ' · đã đọc xong' : ''}`, done: !!readProg?.finished, href: `#/read/${encodeURIComponent(`lesson:${lesson.id}`)}` })
        : stepRow({ n: 3, iconName: 'lessons', title: 'Bài khóa', meta: 'Bài này chưa có bài khóa', href: `#/lesson/${encodeURIComponent(lesson.id)}` }),
      stepRow({ n: 4, iconName: 'chat', title: 'Hỏi đáp', meta: [progress?.qa_best != null ? `Tốt nhất ${Math.round(progress.qa_best * 100)}% · ${progress.qa_attempts || 0} lần` : null, qaCount ? `${qaCount} câu hỏi trong bài khóa` : null, progress?.qa_best == null ? 'hỏi đáp với từ của bài' : null].filter(Boolean).join(' · '), done: progress?.qa_best != null && progress.qa_best >= threshold, href: `#/practice/qa?scope=${encodeURIComponent(lesson.id)}&from=${encodeURIComponent(lesson.id)}` }),
      stepRow({ n: 5, iconName: 'sparkle', title: 'Ngữ pháp', meta: gpTotal ? `${gpDone.size}/${gpTotal} điểm đã hiểu` : 'Bài này không có điểm ngữ pháp', done: gpTotal > 0 && gpDone.size >= gpTotal, onclick: () => root.querySelector('#grammar')?.scrollIntoView({ behavior: 'smooth' }) }),
      stepRow({ n: 6, iconName: 'target', title: 'Luyện tập', meta: [st.best_score != null ? `Tốt nhất ${Math.round(st.best_score * 100)}%` : 'Trắc nghiệm, ghép cặp, sắp xếp câu', wbCount ? `${wbCount} câu sách bài tập` : null].filter(Boolean).join(' · '), done: st.best_score != null && st.best_score >= threshold, href: `#/exercise/${encodeURIComponent(lesson.id)}` }),
      stepRow({ n: 7, iconName: 'trophy', title: 'Kiểm tra cuối bài', meta: st.test_best != null ? `Tốt nhất ${Math.round(st.test_best * 100)}% · ${progress?.test_attempts || 0} lần · đạt từ ${Math.round(threshold * 100)}%` : `Từ vựng + bài khóa · đạt từ ${Math.round(threshold * 100)}% để hoàn thành bài`, done: testPassed, href: `#/test/${encodeURIComponent(lesson.id)}` })),
    audioUrl
      ? [h('div', { class: 'section-title' }, 'Nghe bài (MP3 của sách)'),
        audioPlayer(audioUrl, `${lesson.book} · Bài ${lesson.unit ?? ''}`)]
      : null,

    h('div', { class: 'section-title' }, `Từ vựng (${cards.length})`),
    cards.length ? h('ul', { class: 'list group' }, cards.map((c) => {
      const s = cardStatus(data.statesById.get(c.id));
      const weak = marks.get(c.hanzi) === 'weak';
      return h('li', {}, h('div', { class: ['item', weak ? 'vocab-weak' : ''] },
        h('span', { class: 'han', lang: 'zh-CN', style: { fontSize: '28px', minWidth: '2.4em' } }, c.hanzi),
        h('span', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { color: 'var(--accent-ink)', fontWeight: 700 } }, c.pinyin),
          h('div', {}, c.meaning),
          c.pos ? h('div', { class: 'muted small' }, c.pos) : null),
        weak ? h('span', { class: 'badge weak-badge' }, 'Chưa nhớ') : s !== 'new' ? h('span', { class: ['badge', s === 'mastered' ? 'done' : 'doing'] }, s === 'mastered' ? 'Thuộc' : 'Đang học') : null,
        h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': `Nghe ${c.hanzi}`, onclick: () => speak(c.hanzi, rate) }, icon('speaker'))));
    })) : h('p', { class: 'muted' }, 'Bài này chưa có từ vựng.'),

    lesson.grammar_points?.length ? [h('div', { class: 'section-title', id: 'grammar' }, 'Ngữ pháp & ghi chú'),
      h('div', { class: 'group' }, lesson.grammar_points.map((g, gi) => h('div', { class: ['gp', gpDone.has(g.id) ? 'gp-done' : ''] },
        h('div', { class: 'row between nowrap' },
          h('h3', { style: { margin: 0 } }, `${gi + 1}. ${g.title || ''}`),
          h('button', {
            class: ['btn', 'gp-check', gpDone.has(g.id) ? 'good' : 'tinted'], type: 'button', 'aria-pressed': String(gpDone.has(g.id)),
            onclick: async (e) => {
              const btn = e.currentTarget;
              const on = !gpDone.has(g.id);
              await ctx.repo.markGrammar(lesson.id, g.id, on);
              if (on) gpDone.add(g.id); else gpDone.delete(g.id);
              btn.classList.toggle('good', on); btn.classList.toggle('tinted', !on);
              btn.setAttribute('aria-pressed', String(on));
              btn.closest('.gp')?.classList.toggle('gp-done', on);
              if (on) cue('good');
            },
          }, icon('check'), 'Đã hiểu')),
        g.note ? noteLines(g.note) : null,
        g.example ? h('div', { class: 'han', style: { fontSize: '20px' } }, g.example) : null,
        (g.examples || []).map((e) => h('div', { class: 'ex' },
          h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe ví dụ', style: { width: '36px', minHeight: '36px' }, onclick: () => speak(e.zh, rate) }, icon('speaker')),
          h('div', {}, h('div', { class: 'han', lang: 'zh-CN' }, e.zh), e.pinyin ? h('div', { class: 'py' }, e.pinyin) : null, e.vi ? h('div', { class: 'vi' }, e.vi) : null))))))] : null,
    h('div', { class: 'row between mt' },
      prev ? h('a', { class: 'btn ghost', href: `#/lesson/${encodeURIComponent(prev.id)}` }, icon('back'), `Bài ${prev.unit ?? ''}`) : h('span'),
      data.active?.id !== lesson.id && st.status !== 'done' ? h('button', {
        class: 'btn ghost', type: 'button',
        onclick: async () => { await ctx.repo.saveSettings({ active_lesson_id: lesson.id }); await ctx.refreshSettings(); toast('Từ mới hằng ngày sẽ lấy từ bài này.'); },
      }, 'Đặt làm bài đang học') : null,
      next ? h('a', { class: 'btn ghost', href: `#/lesson/${encodeURIComponent(next.id)}` }, `Bài ${next.unit ?? ''}`, icon('chevron')) : h('span')),
  )));
  return null;
}

/** Trình phát MP3 gọn, cùng tông màu app (thay thanh phát mặc định màu xám của trình duyệt). */
export function audioPlayer(src, label) {
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = src;
  const fmt = (t) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '0:00');
  const playBtn = h('button', { class: 'ap-play', type: 'button', 'aria-label': 'Phát' }, icon('play'));
  const time = h('span', { class: 'ap-time' }, '0:00');
  const seek = h('input', { class: 'ap-seek', type: 'range', min: 0, max: 1000, value: 0, step: 1, 'aria-label': 'Vị trí' });
  const rateBtn = h('button', { class: 'ap-rate', type: 'button', 'aria-label': 'Tốc độ' }, '1×');
  const RATES = [1, 0.75, 0.5, 1.25];
  let ri = 0;
  const paint = () => {
    playBtn.replaceChildren(icon(audio.paused ? 'play' : 'pause'));
    playBtn.setAttribute('aria-label', audio.paused ? 'Phát' : 'Dừng');
    const d = audio.duration || 0;
    seek.value = d ? Math.round((audio.currentTime / d) * 1000) : 0;
    seek.style.setProperty('--p', `${seek.value / 10}%`);
    time.textContent = `${fmt(audio.currentTime)} / ${fmt(d)}`;
  };
  playBtn.onclick = () => (audio.paused ? audio.play() : audio.pause());
  rateBtn.onclick = () => { ri = (ri + 1) % RATES.length; audio.playbackRate = RATES[ri]; rateBtn.textContent = `${RATES[ri]}×`; };
  seek.oninput = () => { if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration; };
  for (const ev of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended']) audio.addEventListener(ev, paint);
  window.addEventListener('hashchange', () => audio.pause(), { once: true });
  paint();
  return h('div', { class: 'audio-player' }, playBtn,
    h('div', { class: 'ap-main' }, h('div', { class: 'ap-top' }, h('strong', {}, label), time), seek),
    rateBtn);
}
