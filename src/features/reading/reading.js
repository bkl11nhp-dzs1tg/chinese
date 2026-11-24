// Bài đọc (mục 9.11) – dùng chung cho bài đọc nạp vào (data/readings) và bài khóa của sách.
// #/readings                danh sách
// #/read/R01                một bài đọc
// #/read/lesson:L05         bài khóa của bài 5
//
// Chế độ: Đọc thường · Từng câu · Kiểm tra (chọn nghĩa đúng của câu). Pinyin/Nghĩa bật tắt bằng nút riêng. Nút ▶ ở mỗi câu: nghe câu + hiện nghĩa.
// "Nghe cả bài": đọc lần lượt từng câu, tô sáng câu đang đọc (MP3 + audio_ms nếu có, không thì giọng máy).
// Bấm vào một từ: bảng tra từ (chữ, pinyin, nghĩa, giải thích từng chữ, câu ví dụ) + Lưu từ mới / Đã biết.

import { h, mount, toast } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak, ttsSupported, RATES } from '../../ui/speech.js';
import { cue } from '../../ui/feedback.js';
import { buildDictionary, segmentSentence, isHanChar } from '../../core/segment.js';
import { cardStatus } from '../../core/srs.js';
import { lessonIdFromAudioName } from '../../core/audio.js';
import { lessonAudioSrc } from '../../content.js';

const MODES = [
  { id: 'normal', label: 'Đọc' },
  { id: 'step', label: 'Từng câu' },
  { id: 'quiz', label: 'Kiểm tra' },
];
const FONT = { 1: 22, 2: 28, 3: 36 };

/** Chuẩn hóa: bài đọc hoặc bài khóa → { id, title, subtitle, paragraphs:[{title, sentences:[{hanzi,pinyin,meaning,speaker,audio_ms}]}] } */
export function lessonToDoc(lesson) {
  return {
    id: `lesson:${lesson.id}`,
    kind: 'lesson',
    lesson_id: lesson.id,
    title: lesson.title,
    subtitle: `${lesson.book} · Bài ${lesson.unit ?? ''} · Bài khóa`,
    audio_file: null,
    paragraphs: (lesson.texts || []).map((t, i) => ({
      id: `t${i + 1}`,
      title: t.title,
      sentences: t.lines.map((ln, k) => ({ id: `t${i + 1}-${k + 1}`, hanzi: ln.zh, pinyin: ln.pinyin, meaning: ln.vi, speaker: ln.speaker })),
    })),
  };
}

export function readingToDoc(r) {
  return {
    id: r.id, kind: 'reading', lesson_id: r.lesson_id, title: r.title,
    subtitle: [r.level ? `Cấp ${r.level}` : null, r.source].filter(Boolean).join(' · '),
    audio_file: r.audio_file,
    paragraphs: r.paragraphs.map((p) => ({ id: p.id, title: '', sentences: p.sentences })),
  };
}

// ---------------------------------------------------------------- danh sách
export async function renderList(root, ctx) {
  const [readings, progress, lessons] = await Promise.all([ctx.repo.getAll('readings'), ctx.repo.getAll('reading_progress'), ctx.repo.lessonsOrdered()]);
  const prog = new Map(progress.map((p) => [p.reading_id, p]));
  const count = (doc) => doc.paragraphs.reduce((n, p) => n + p.sentences.length, 0);
  const row = (doc) => {
    const p = prog.get(doc.id);
    const n = count(doc);
    const at = p ? Math.min(n, (p.last_sentence_index || 0) + 1) : 0;
    return h('a', { class: 'row-link', href: `#/read/${encodeURIComponent(doc.id)}` },
      h('span', { class: ['icon-box', p?.finished ? 'done' : ''] }, p?.finished ? icon('check') : icon('lessons')),
      h('span', { class: 'grow' },
        h('div', { class: 'title han' }, doc.title),
        h('div', { class: 'meta' }, [doc.subtitle, `${n} câu`, p ? (p.finished ? 'Đã đọc xong' : `Đang ở câu ${at}`) : null].filter(Boolean).join(' · '))),
      icon('chevron'));
  };
  const lessonDocs = lessons.filter((l) => l.texts?.length).map(lessonToDoc);
  mount(root,
    h('div', { class: 'large-title' }, h('div', {}, h('div', { class: 'sub' }, 'Đọc hiểu'), h('h1', {}, 'Bài đọc')), segmented('readings')),
    readings.length ? [h('div', { class: 'section-title' }, 'Bài đọc của bạn'), h('div', { class: 'group' }, readings.map((r) => row(readingToDoc(r))))]
      : h('p', { class: 'notice' }, 'Chưa có bài đọc riêng.'),
    lessonDocs.length ? [h('div', { class: 'section-title' }, 'Bài khóa trong sách'), h('div', { class: 'group' }, lessonDocs.map(row))] : null);
}

/** Thanh chọn Lộ trình | Bài đọc ở đầu tab Bài học. */
export function segmented(active) {
  return h('div', { class: 'seg seg-fit seg-page', role: 'tablist' },
    h('a', { class: ['seg-btn', active === 'path' ? 'on' : ''], href: '#/lessons', role: 'tab', 'aria-selected': String(active === 'path') }, 'Lộ trình'),
    h('a', { class: ['seg-btn', active === 'readings' ? 'on' : ''], href: '#/readings', role: 'tab', 'aria-selected': String(active === 'readings') }, 'Bài đọc'));
}

// ---------------------------------------------------------------- trang đọc
export async function renderReader(root, ctx, { params }) {
  const repo = ctx.repo;
  const id = params.id;
  let doc;
  if (id.startsWith('lesson:')) {
    const lesson = await repo.get('lessons', id.slice(7));
    if (!lesson?.texts?.length) { mount(root, h('p', {}, 'Bài này chưa có bài khóa.')); return; }
    doc = lessonToDoc(lesson);
  } else {
    const r = await repo.get('readings', id);
    if (!r) { mount(root, h('p', {}, 'Không tìm thấy bài đọc.')); return; }
    doc = readingToDoc(r);
  }

  const [cards, states, known, progress] = await Promise.all([repo.getAll('cards'), repo.getAll('card_state'), repo.getAll('known_words'), repo.get('reading_progress', doc.id)]);
  const dict = buildDictionary(cards);
  const statesById = new Map(states.map((s) => [s.card_id, s]));
  // Đánh dấu của người học: 'known' (đã nhớ) | 'weak' (chưa nhớ – luôn tô màu khi gặp).
  const marks = new Map(known.map((k) => [k.word, k.status || 'known']));
  const s = ctx.settings;
  const prefs = {
    font: s.reading_font || 2,
    pinyin: s.reading_pinyin !== false,
    meaning: !!s.reading_meaning,
    highlight: s.reading_highlight !== false,
    rate: s.tts_rate || 1,
  };
  let mode = MODES.some((m) => m.id === s.reading_mode) ? s.reading_mode : 'normal';

  // Câu phẳng, kèm token và pinyin từng chữ (nạp pinyin-pro khi cần).
  const flat = [];
  doc.paragraphs.forEach((p, pi) => p.sentences.forEach((st) => {
    flat.push({ ...st, pi, idx: flat.length, tokens: st.tokens?.length ? fillTokenGaps(st.hanzi, st.tokens) : segmentSentence(st.hanzi, dict), charPy: null });
  }));
  let pinyinLib = null;
  async function ensurePinyin() {
    if (pinyinLib) return;
    try {
      pinyinLib = await import('../../core/pinyin-text.js');
      for (const st of flat) st.charPy = pinyinLib.charPinyin(st.hanzi);
    } catch { pinyinLib = false; }
  }

  // Âm thanh: MP3 của bài (nếu có, và câu có audio_ms) – không có thì giọng máy.
  let audioEl = null;
  const lessonForAudio = doc.lesson_id || (doc.audio_file ? lessonIdFromAudioName(doc.audio_file.split('/').pop()) : null);
  const audioSrc = await lessonAudioSrc(lessonForAudio);
  if (audioSrc) audioEl = new Audio(audioSrc);

  const tracker = ctx.startTracking({ kind: 'reading' });
  let current = Math.min(progress?.last_sentence_index || 0, flat.length - 1);
  const posLabel = h('span', { class: 'pl-pos' });
  let saveTimer = null;
  function setCurrent(i, { save = true } = {}) {
    current = i;
    posLabel.textContent = `Câu ${i + 1}/${flat.length}`;
    root.querySelectorAll('.sent.active').forEach((e) => e.classList.remove('active'));
    root.querySelector(`.sent[data-i="${i}"]`)?.classList.add('active');
    if (!save) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => repo.saveReadingProgress(doc.id, { last_sentence_index: i, finished: i >= flat.length - 1 || !!progress?.finished }), 1000);
  }

  let playingAll = false;
  let stopSeg = null;
  function playSentence(st, rate = prefs.rate) {
    return new Promise((resolve) => {
      if (audioEl && st.audio_ms) {
        audioEl.currentTime = st.audio_ms.start / 1000;
        audioEl.playbackRate = rate;
        audioEl.play().catch(() => resolve());
        const tick = () => {
          if (!audioEl || audioEl.paused || audioEl.currentTime * 1000 >= st.audio_ms.end) { audioEl?.pause(); clearInterval(t); stopSeg = null; resolve(); }
        };
        const t = setInterval(tick, 50);
        stopSeg = () => { clearInterval(t); audioEl.pause(); resolve(); };
        return;
      }
      if (!ttsSupported()) return resolve();
      speak(st.hanzi, rate).then(() => {
        const u = speechSynthesis;
        const wait = setInterval(() => { if (!u.speaking) { clearInterval(wait); resolve(); } }, 120);
        stopSeg = () => { clearInterval(wait); u.cancel(); resolve(); };
      });
    });
  }
  function stopAll() { playingAll = false; stopSeg?.(); updatePlayBtn(); }

  // ---------------- bảng tra từ
  const sheet = h('div', { class: 'sheet word-sheet', role: 'dialog', 'aria-label': 'Tra từ' });
  const scrim = h('div', { class: 'scrim hidden', onclick: () => closeSheet() });
  function closeSheet() { sheet.classList.remove('open'); scrim.classList.add('hidden'); }
  async function openWord(word, st) {
    await ensurePinyin();
    const entries = dict.map.get(word) || [];
    const card = entries[0];
    const py = card?.pinyin || (pinyinLib ? pinyinLib.wordPinyin(word) : '');
    const status = card ? cardStatus(statesById.get(card.id)) : null;
    repo.recordLookup({ word, readingId: doc.id, sentenceIndex: st.idx });
    const lookups = await repo.lookupCount(word);
    const chars = [...word].filter(isHanChar);
    const mark = marks.get(word) || null;
    const setMark = async (m) => {
      const next = mark === m ? null : m;
      await repo.markWord(word, next);
      if (next) marks.set(word, next); else marks.delete(word);
      cue(next === 'weak' ? 'tap' : 'good');
      toast(next === 'weak' ? 'Đã đánh dấu chưa nhớ: từ này sẽ được tô màu khi gặp lại.' : next === 'known' ? 'Đã đánh dấu đã nhớ.' : 'Đã bỏ đánh dấu.');
      closeSheet();
      rerender();
    };
    const meaningInput = h('input', { type: 'text', placeholder: 'Nghĩa tiếng Việt', 'aria-label': 'Nghĩa của từ', autocomplete: 'off' });
    const body = h('div', { class: 'inner' },
      h('div', { class: 'row between nowrap' },
        h('div', {},
          h('div', { class: 'han', lang: 'zh-CN', style: { fontSize: '44px', lineHeight: 1.1 } }, word),
          h('div', { style: { color: 'var(--accent-ink)', fontWeight: 700, fontSize: '20px' } }, py || '—')),
        h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe từ', onclick: () => speak(word, prefs.rate) }, icon('speaker'))),
      entries.length
        ? h('div', { style: { margin: '10px 0' } }, entries.map((c) => h('div', { style: { marginBottom: '4px' } },
            c.pos ? h('span', { class: 'badge', style: { marginRight: '6px' } }, c.pos) : null, h('strong', {}, c.meaning))))
        : h('div', { style: { margin: '10px 0' } },
            h('p', { class: 'muted small', style: { margin: '0 0 6px' } }, 'Chưa có trong từ vựng của bạn (app không tự đoán nghĩa). Gõ nghĩa nếu muốn lưu:'),
            meaningInput),
      chars.length > 1 ? h('div', { class: 'chars' }, chars.map((ch, k) => {
        const single = dict.map.get(ch)?.[0];
        const cp = single?.pinyin || (pinyinLib ? (st.charPy?.[[...st.hanzi].indexOf(ch)] || pinyinLib.wordPinyin(ch)) : '');
        return h('div', { class: 'char-row' }, h('span', { class: 'han' }, ch), h('span', { class: 'muted' }, cp), h('span', {}, single?.meaning || '—'));
      })) : null,
      h('div', { class: 'example' }, h('div', { class: 'muted small' }, 'Trong bài:'), h('div', { class: 'han', style: { fontSize: '20px' } }, st.hanzi), st.meaning ? h('div', { class: 'small' }, st.meaning) : null),
      h('p', { class: 'muted small' }, [status ? `Trạng thái: ${status === 'mastered' ? 'đã thuộc' : status === 'learning' ? 'đang học' : 'chưa học'}` : null, `Đã tra ${lookups} lần`].filter(Boolean).join(' · ')),
      h('div', { class: 'mark-row', role: 'group', 'aria-label': 'Đánh dấu từ' },
        h('button', { class: ['mark-btn', 'weak', mark === 'weak' ? 'on' : ''], type: 'button', 'aria-pressed': String(mark === 'weak'), onclick: () => setMark('weak') }, icon('flag'), 'Chưa nhớ'),
        h('button', { class: ['mark-btn', 'known', mark === 'known' ? 'on' : ''], type: 'button', 'aria-pressed': String(mark === 'known'), onclick: () => setMark('known') }, icon('check'), 'Đã nhớ')),
      card
        ? (card.lesson_id ? h('a', { class: 'btn block', style: { marginTop: '10px' }, href: `#/lesson/${encodeURIComponent(card.lesson_id)}` }, icon('lessons'), `Xem bài ${card.lesson_id.replace('L', '')}`) : null)
        : h('div', { class: 'row nowrap', style: { marginTop: '10px' } },
          h('button', {
              class: 'btn primary big', type: 'button', style: { flex: 1 },
              onclick: async () => {
                const c = await repo.saveReadingWord({ hanzi: word, pinyin: py, meaning: meaningInput.value.trim(), readingId: doc.id, sentenceIndex: st.idx, example: st.hanzi, exampleMeaning: st.meaning || '' });
                dict.map.set(word, [c]);
                cue('good');
                toast('Đã lưu: sẽ xuất hiện như từ mới trong buổi học tới.');
                closeSheet();
                rerender();
              },
            }, 'Lưu vào thẻ từ')));
    sheet.replaceChildren(body);
    scrim.classList.remove('hidden');
    sheet.classList.add('open');
  }

  // ---------------- dựng giao diện
  const content = h('div', { class: 'reader-body' });
  const playBtn = h('button', { class: 'pl-play', type: 'button', onclick: () => (playingAll ? stopAll() : playAll()) });
  function updatePlayBtn() {
    playBtn.replaceChildren(icon(playingAll ? 'pause' : 'play'));
    playBtn.setAttribute('aria-label', playingAll ? 'Dừng' : 'Nghe cả bài');
    posLabel.textContent = `Câu ${current + 1}/${flat.length}`;
  }
  async function playAll() {
    playingAll = true;
    updatePlayBtn();
    const start = current >= flat.length - 1 ? 0 : current;
    for (let i = start; i < flat.length && playingAll; i++) {
      setCurrent(i);
      if (mode === 'step') renderStep();
      updatePlayBtn();
      root.querySelector(`.sent[data-i="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await playSentence(flat[i]);
      await new Promise((r) => setTimeout(r, 250));
    }
    playingAll = false;
    updatePlayBtn();
  }
  const jump = (d) => {
    stopAll();
    const i = Math.max(0, Math.min(flat.length - 1, current + d));
    setCurrent(i);
    if (mode === 'step') renderStep();
    updatePlayBtn();
    root.querySelector(`.sent[data-i="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    playSentence(flat[i]);
  };

  const modeBar = h('div', { class: 'seg small-seg', role: 'tablist', 'aria-label': 'Chế độ đọc' },
    MODES.map((m) => h('button', {
      class: ['seg-btn', m.id === mode ? 'on' : ''], type: 'button', role: 'tab', 'aria-selected': String(m.id === mode),
      onclick: async () => { mode = m.id; await ctx.repo.saveSettings({ reading_mode: mode }); modeBar.querySelectorAll('.seg-btn').forEach((b, k) => b.classList.toggle('on', MODES[k].id === mode)); rerender(); },
    }, m.label)));

  const optBtn = (key, label) => h('button', {
    class: ['chip', 'opt', prefs[key] ? 'selected' : ''], type: 'button', 'aria-pressed': String(!!prefs[key]),
    onclick: async (e) => { prefs[key] = !prefs[key]; e.currentTarget.classList.toggle('selected', prefs[key]); e.currentTarget.setAttribute('aria-pressed', String(prefs[key])); await ctx.repo.saveSettings({ [`reading_${key}`]: prefs[key] }); rerender(); },
  }, label);
  const fontBtn = h('button', {
    class: 'chip opt', type: 'button', 'aria-label': 'Cỡ chữ',
    onclick: async () => { prefs.font = (prefs.font % 3) + 1; await ctx.repo.saveSettings({ reading_font: prefs.font }); rerender(); },
  }, 'Aa');
  const playerBar = h('div', { class: 'player', role: 'group', 'aria-label': 'Nghe bài' },
    h('button', { class: 'pl-btn', type: 'button', 'aria-label': 'Câu trước', onclick: () => jump(-1) }, icon('skipBack')),
    playBtn,
    h('button', { class: 'pl-btn', type: 'button', 'aria-label': 'Câu sau', onclick: () => jump(1) }, icon('skipFwd')),
    posLabel);
  if (!RATES.includes(prefs.rate)) prefs.rate = 1;
  const rateBtn = h('label', { class: 'pl-rate', title: 'Tốc độ đọc' },
    h('select', {
      'aria-label': 'Tốc độ đọc',
      onchange: async (e) => { prefs.rate = Number(e.target.value); await ctx.repo.saveSettings({ tts_rate: prefs.rate }); },
    }, RATES.map((r) => h('option', { value: String(r), selected: r === prefs.rate }, `${r}×`))));

  function tokenEl(st, t, i) {
    if (!t.word || ![...t.text].some(isHanChar)) return h('span', { class: 'punct' }, t.text);
    const inDict = dict.map.has(t.text);
    const entry = inDict ? dict.map.get(t.text)[0] : null;
    const saved = entry?.source === 'reading';
    const mark = marks.get(t.text);
    const unknown = !inDict && !mark;
    const showPy = prefs.pinyin && mode !== 'plain' && mode !== 'quiz' && st.charPy;
    // Mỗi chữ một ruby riêng: pinyin nằm đúng trên chữ, không dính liền và không tràn sang từ bên cạnh.
    const body = showPy ? [...t.text].map((ch, k) => h('ruby', {}, ch, h('rt', {}, st.charPy[t.start + k] || ''))) : t.text;
    return h('span', {
      class: ['tok', saved ? 'saved' : '', mark === 'weak' ? 'weak' : '', prefs.highlight && unknown ? 'unknown' : ''], role: 'button', tabindex: '0',
      title: mark === 'weak' ? 'Chưa nhớ' : undefined, dataset: { word: t.text },
      onclick: (e) => { e.stopPropagation(); setCurrent(st.idx); openWord(t.text, st); },
      onkeydown: (e) => { if (e.key === 'Enter') { setCurrent(st.idx); openWord(t.text, st); } },
    }, body);
  }

  const SPK = ['#e07b39', '#3a7bd5', '#2e9d63', '#9b59b6', '#c0392b', '#d4a017'];
  const spkColor = new Map();
  const avatar = (sp) => {
    if (!spkColor.has(sp)) spkColor.set(sp, SPK[spkColor.size % SPK.length]);
    return h('span', { class: 'spk-av han', style: { '--c': spkColor.get(sp) }, 'aria-hidden': 'true' }, [...sp][0]);
  };

  function sentenceEl(st, { big = false } = {}) {
    const showMeaning = mode === 'normal' && prefs.meaning;
    const meaningEl = h('div', { class: ['s-meaning', showMeaning ? '' : 'hidden'] }, st.meaning || '');
    const pyLine = mode !== 'plain' && mode !== 'quiz' && prefs.pinyin && !st.charPy && st.pinyin ? h('div', { class: 's-pinyin' }, st.pinyin) : null;
    let quizBox = null;
    if (mode === 'quiz') quizBox = quizEl(st);
    return h('div', { class: ['sent', big ? 'big' : '', st.idx === current ? 'active' : ''], dataset: { i: String(st.idx) } },
      h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '10px' } },
        st.speaker ? avatar(st.speaker) : null,
        h('button', {
          class: 'say', type: 'button', 'aria-label': 'Nghe câu',
          onclick: async () => { setCurrent(st.idx); if (mode === 'normal' || mode === 'plain') meaningEl.classList.remove('hidden'); await playSentence(st); },
        }, icon('play')),
        h('div', { style: { flex: 1, minWidth: 0 } },
          st.speaker ? h('div', { class: ['speaker', 'han', [...st.speaker].length < 2 ? 'sr-only' : ''], style: { color: spkColor.get(st.speaker) } }, st.speaker) : null,
          h('span', { class: 'han zh', lang: 'zh-CN', style: { fontSize: `${big ? FONT[prefs.font] + 6 : FONT[prefs.font]}px` } }, st.tokens.map((t, k) => tokenEl(st, t, k))),
          pyLine, meaningEl, quizBox)));
  }

  // Kiểm tra: đọc câu (không pinyin) rồi chọn nghĩa đúng trong 3 phương án lấy từ các câu khác của bài.
  const pool = [...new Set(flat.map((x) => x.meaning).filter(Boolean))];
  const answered = new Map();
  const scoreEl = h('span', { class: 'quiz-score' });
  const quizScore = () => {
    const right = [...answered].filter(([i, m]) => flat[i].meaning === m).length;
    return answered.size ? `Đúng ${right}/${answered.size} câu` : '';
  };
  function quizEl(st) {
    const reveal = h('div', { class: 'quiz-reveal' }, h('div', { class: 's-pinyin' }, st.pinyin || ''), h('div', { class: 's-meaning' }, st.meaning || ''));
    if (!st.meaning || pool.length < 3) {
      reveal.classList.add('hidden');
      const showBtn = h('button', { class: 'btn tinted', type: 'button', onclick: () => { reveal.classList.remove('hidden'); showBtn.remove(); setCurrent(st.idx); } }, 'Xem pinyin & nghĩa');
      return h('div', { class: 'quiz-box' }, showBtn, reveal);
    }
    const seed = hashStr(st.hanzi);
    const order = (k) => (a, b) => ((seed * k ^ hashStr(a)) >>> 0) - ((seed * k ^ hashStr(b)) >>> 0);
    const opts = [st.meaning, ...pool.filter((m) => m !== st.meaning).sort(order(3)).slice(0, 2)].sort(order(7));
    const prev = answered.get(st.idx);
    const box = h('div', { class: 'quiz-box' }, h('div', { class: 'q-ask' }, 'Câu này nghĩa là gì?'));
    const list = h('div', { class: 'quiz-opts' }, opts.map((m) => h('button', {
      class: ['quiz-opt', prev ? (m === st.meaning ? 'right' : m === prev ? 'wrong' : '') : ''], type: 'button', disabled: !!prev,
      onclick: async () => {
        const ok = m === st.meaning;
        answered.set(st.idx, m);
        setCurrent(st.idx);
        list.querySelectorAll('.quiz-opt').forEach((b, k) => { b.disabled = true; b.classList.toggle('right', opts[k] === st.meaning); b.classList.toggle('wrong', opts[k] === m && !ok); });
        box.append(reveal);
        cue(ok ? 'good' : 'bad');
        scoreEl.textContent = quizScore();
        const p = (await repo.get('reading_progress', doc.id)) || {};
        await repo.saveReadingProgress(doc.id, { guess_correct: (p.guess_correct || 0) + (ok ? 1 : 0), guess_total: (p.guess_total || 0) + 1 });
      },
    }, m)));
    box.append(list);
    if (prev) box.append(reveal);
    return box;
  }

  function renderStep() {
    const st = flat[current];
    content.replaceChildren(
      h('p', { class: 'muted small center' }, `Câu ${current + 1}/${flat.length}${doc.paragraphs[st.pi]?.title ? ` · ${doc.paragraphs[st.pi].title}` : ''}`),
      sentenceEl(st, { big: true }),
      h('div', { class: 'row nowrap', style: { marginTop: '16px' } },
        h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, disabled: current === 0, onclick: () => { setCurrent(current - 1); renderStep(); } }, icon('back'), 'Trước'),
        h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: () => playSentence(st, 0.5) }, 'Chậm 0.5×'),
        h('button', {
          class: 'btn primary big', type: 'button', style: { flex: 1.3 },
          onclick: () => {
            if (current < flat.length - 1) { setCurrent(current + 1); renderStep(); playSentence(flat[current]); }
            else { repo.saveReadingProgress(doc.id, { last_sentence_index: current, finished: true }); cue('done'); toast('Đã đọc xong bài!'); }
          },
        }, current < flat.length - 1 ? 'Câu tiếp' : 'Xong', icon('chevron'))));
    const sent = content.querySelector('.sent');
    if (prefs.meaning || mode === 'step') sent?.querySelector('.s-meaning')?.classList.remove('hidden');
  }

  function rerender() {
    if (mode === 'step') return renderStep();
    scoreEl.textContent = mode === 'quiz' ? quizScore() : '';
    content.replaceChildren(mode === 'quiz' ? h('p', { class: 'quiz-head' }, scoreEl) : null,...doc.paragraphs.map((p, pi) => h('section', { class: 'para' },
      p.title ? h('h3', { class: 'para-title han' }, p.title) : null,
      flat.filter((st) => st.pi === pi).map((st) => sentenceEl(st)))));
  }

  const lessonRow = doc.lesson_id ? await repo.get('lessons', doc.lesson_id) : null;
  const wordCount = new Set(flat.flatMap((x) => x.tokens.filter((t) => t.word && dict.map.has(t.text)).map((t) => t.text))).size;
  mount(root,
    h('div', { class: 'reader', style: { '--rd-font': `${FONT[prefs.font]}px` } },
      h('a', { class: 'btn ghost back-link', href: doc.kind === 'lesson' ? `#/lesson/${encodeURIComponent(doc.lesson_id)}` : '#/readings' }, icon('back'), doc.kind === 'lesson' ? 'Bài học' : 'Bài đọc'),
      h('header', { class: 'reader-hero px-box' },
        doc.lesson_id ? h('span', { class: 'rh-art' }, h('img', { src: `./lessons/${encodeURIComponent(doc.lesson_id)}.webp`, alt: '', onerror: (e) => e.target.parentNode.remove() })) : null,
        h('div', { class: 'rh-text' },
          h('div', { class: 'q-type' }, doc.subtitle),
          h('h1', { class: 'han' }, doc.title),
          lessonRow?.title_vi ? h('p', { class: 'muted', style: { margin: 0 } }, lessonRow.title_vi) : null,
          h('div', { class: 'rh-meta' },
            h('span', {}, icon('lessons'), `${flat.length} câu`),
            h('span', {}, icon('cards'), `${wordCount} từ vựng`),
            audioEl ? h('span', {}, icon('headphones'), 'MP3 của sách') : null))),
      h('div', { class: 'reader-tools' },
        modeBar,
        h('div', { class: 'tool-chips' }, optBtn('pinyin', 'Pinyin'), optBtn('meaning', 'Nghĩa'), optBtn('highlight', 'Tô từ lạ'), fontBtn)),
      !audioEl && !ttsSupported() ? h('p', { class: 'notice small' }, 'Trình duyệt không hỗ trợ đọc giọng máy.') : null,
      h('div', { class: 'reader-card px-box' }, content),
      h('div', { class: 'player-wrap' }, playerBar, rateBtn)),
    scrim, sheet);
  updatePlayBtn();

  rerender();
  ensurePinyin().then(() => { if (pinyinLib && prefs.pinyin) rerender(); requestAnimationFrame(() => root.querySelector(`.sent[data-i="${current}"]`)?.scrollIntoView({ block: 'center' })); });
  const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
  window.addEventListener('keydown', onKey);

  return () => {
    stopAll();
    clearTimeout(saveTimer);
    repo.saveReadingProgress(doc.id, { last_sentence_index: current });
    window.removeEventListener('keydown', onKey);
    audioEl?.pause();
    return tracker.stop();
  };
}

function hashStr(t) { let x = 2166136261; for (const c of t) x = Math.imul(x ^ c.codePointAt(0), 16777619); return x >>> 0; }

/** Token do người dùng cung cấp có thể không phủ hết câu: lấp các khoảng trống bằng từng ký tự. */
function fillTokenGaps(text, tokens) {
  const chars = [...text];
  const out = [];
  let i = 0;
  for (const t of [...tokens].sort((a, b) => a.start - b.start)) {
    while (i < t.start) { out.push({ text: chars[i], start: i, end: i + 1, word: isHanChar(chars[i]) }); i++; }
    if (t.start >= i) { out.push({ ...t, word: true }); i = t.end; }
  }
  while (i < chars.length) { out.push({ text: chars[i], start: i, end: i + 1, word: isHanChar(chars[i]) }); i++; }
  return out;
}
