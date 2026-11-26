// Bài đọc (mục 9.11) – dùng chung cho bài đọc nạp vào (data/readings) và bài khóa của sách.
// #/readings                danh sách
// #/read/R01                một bài đọc
// #/read/lesson:L05         bài khóa của bài 5
//
// Chế độ: Đọc thường · Từng câu · Kiểm tra (chọn nghĩa đúng của câu). Pinyin/Nghĩa bật tắt bằng nút riêng. Nút ▶ ở mỗi câu: nghe câu + hiện nghĩa.
// "Nghe cả bài": đọc lần lượt từng câu, tô sáng câu đang đọc (MP3 + audio_ms nếu có, không thì giọng máy).
// Bấm vào một từ: bảng tra từ (chữ, pinyin, nghĩa, giải thích từng chữ, câu ví dụ) + Lưu từ mới / Đã biết.

import { h, mount, toast, confirmDialog } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak, ttsSupported, RATES } from '../../ui/speech.js';
import { cue } from '../../ui/feedback.js';
import { buildDictionary, segmentSentence, isHanChar } from '../../core/segment.js';
import { cardStatus } from '../../core/srs.js';
import { lessonIdFromAudioName } from '../../core/audio.js';
import { lessonAudioSrc } from '../../content.js';
import { audioPlayer } from '../lessons/lessons.js';
import { lyricsToParagraphs, youtubeId, fmtTime } from '../../core/media.js';
import { translateZhVi } from '../../core/translate.js';
import { loadDecomp } from '../../ui/char-anatomy.js';
import { describeChar } from '../../core/decomp.js';


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
    id: r.id, kind: 'reading', media_kind: r.kind || 'text', media: r.media || null, user: r.source === 'user', lesson_id: r.lesson_id, title: r.title,
    subtitle: r.source === 'user' ? ({ song: 'Bài hát của bạn', film: 'Hội thoại của bạn' }[r.kind] || 'Câu chuyện của bạn') : [r.level ? `Cấp ${r.level}` : null, r.source].filter(Boolean).join(' · '),
    audio_file: r.audio_file,
    paragraphs: r.paragraphs.map((p) => ({ id: p.id, title: '', sentences: p.sentences })),
  };
}

// ---------------------------------------------------------------- danh sách
const KINDS = [
  { id: 'song', label: 'Bài hát', icon: 'headphones' },
  { id: 'film', label: 'Hội thoại', icon: 'chat' },
  { id: 'text', label: 'Câu chuyện', icon: 'books' },
];

export async function renderList(root, ctx, { query = {} } = {}) {
  const [allReadings, progress, lessons] = await Promise.all([ctx.repo.getAll('readings'), ctx.repo.getAll('reading_progress'), ctx.repo.lessonsOrdered()]);
  const readings = allReadings.filter((r) => !r.deleted);
  const prog = new Map(progress.map((p) => [p.reading_id, p]));
  const count = (doc) => doc.paragraphs.reduce((n, p) => n + p.sentences.length, 0);
  const row = (doc) => {
    const p = prog.get(doc.id);
    const n = count(doc);
    const at = p ? Math.min(n, (p.last_sentence_index || 0) + 1) : 0;
    const kind = KINDS.find((k) => k.id === doc.media_kind);
    return h('a', { class: 'row-link', href: `#/read/${encodeURIComponent(doc.id)}` },
      h('span', { class: ['icon-box', p?.finished ? 'done' : ''] }, p?.finished ? icon('check') : icon(kind?.icon || 'lessons')),
      h('span', { class: 'grow' },
        h('div', { class: 'title han' }, doc.title),
        h('div', { class: 'meta' }, [doc.media ? 'có video' : null, `${n} câu`, p ? (p.finished ? 'Đã học xong' : `Đang ở câu ${at}`) : null].filter(Boolean).join(' · '))),
      icon('chevron'));
  };
  let tab = KINDS.some((k) => k.id === query.k) ? query.k : 'song';
  const tabs = h('div', { class: 'seg seg-fit', role: 'tablist' }, KINDS.map((k) => h('a', {
    class: ['seg-btn', k.id === tab ? 'on' : ''], role: 'tab', href: `#/readings?k=${k.id}`, 'aria-selected': String(k.id === tab),
  }, k.label)));
  const lessonDocs = lessons.filter((l) => l.texts?.length).map(lessonToDoc);
  const mine = readings.filter((r) => (r.kind || 'text') === tab).map(readingToDoc);
  const addBtn = tab !== 'text' ? h('button', { class: 'btn primary block', type: 'button', onclick: () => openAddDialog(ctx, tab) }, icon('plus'), tab === 'song' ? 'Thêm bài hát' : 'Thêm hội thoại') : null;
  mount(root,
    h('div', { class: 'large-title' }, h('div', {}, h('div', { class: 'sub' }, 'Bài học'), h('h1', {}, 'Thư viện')), segmented('readings')),
    tabs,
    addBtn ? h('div', { class: 'add-media' }, addBtn) : null,
    mine.length ? h('div', { class: 'group' }, mine.map(row)) : h('p', { class: 'notice' }, tab === 'film' ? 'Chưa có hội thoại nào.' : tab === 'song' ? 'Chưa có bài hát nào.' : 'Chưa có câu chuyện riêng.'),
    tab === 'text' && lessonDocs.length ? [h('div', { class: 'section-title' }, 'Bài khóa trong sách'), h('div', { class: 'group' }, lessonDocs.map(row))] : null);
}

/** Hộp thêm bài hát / đoạn thoại: tên, link YouTube (không bắt buộc), lời tiếng Trung (mỗi dòng một câu, nhận mốc [mm:ss]), bản dịch. */
function openAddDialog(ctx, kind, existing = null) {
  // Sửa: dựng lại lời từ các câu (giữ mốc thời gian, người nói, dòng trống giữa các đoạn).
  const lrc = (t) => (t == null ? '' : `[${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}] `);
  const zhInit = existing ? existing.paragraphs.map((p) => p.sentences.map((st) => `${lrc(st.t)}${st.speaker ? `${st.speaker}：` : ''}${st.hanzi}`).join('\n')).join('\n\n') : '';
  const viInit = existing ? existing.paragraphs.flatMap((p) => p.sentences.map((st) => st.meaning || '')).join('\n') : '';
  const title = h('input', { type: 'text', placeholder: kind === 'song' ? 'Tên bài hát' : 'Tên hội thoại / cảnh phim', 'aria-label': 'Tên', value: existing?.title || '' });
  const link = h('input', { type: 'url', placeholder: 'Link YouTube (không bắt buộc)', 'aria-label': 'Link YouTube', inputmode: 'url', value: existing?.media || '' });
  const zh = h('textarea', { rows: 7, class: 'han', lang: 'zh-CN', placeholder: '[00:12.30] 第一句\n[00:15.80] 第二句', 'aria-label': 'Lời tiếng Trung' });
  zh.value = zhInit;
  const vi = h('textarea', { rows: 5, placeholder: 'Câu 1\nCâu 2', 'aria-label': 'Bản dịch tiếng Việt' });
  vi.value = viInit;
  const err = h('p', { class: 'form-error' });
  const dlg = h('dialog', { class: 'media-dialog' },
    h('h2', {}, existing ? 'Sửa bài' : kind === 'song' ? 'Thêm bài hát' : 'Thêm hội thoại'),
    h('label', { class: 'field' }, h('span', {}, 'Tên'), title),
    h('label', { class: 'field' }, h('span', {}, 'Video'), link),
    h('label', { class: 'field' }, h('span', {}, 'Lời tiếng Trung'), zh),
    h('label', { class: 'field' }, h('span', {}, 'Bản dịch'), vi),
    err,
    h('div', { class: 'row nowrap' },
      h('button', { class: 'btn', type: 'button', style: { flex: 1 }, onclick: () => dlg.close() }, 'Hủy'),
      h('button', { class: 'btn primary', type: 'button', style: { flex: 1.4 }, onclick: async () => {
        const paragraphs = lyricsToParagraphs(zh.value, vi.value);
        if (!title.value.trim()) { err.textContent = 'Nhập tên'; title.focus(); return; }
        if (!paragraphs.length) { err.textContent = 'Dán lời tiếng Trung'; zh.focus(); return; }
        if (link.value.trim() && !youtubeId(link.value)) { err.textContent = 'Link YouTube chưa đúng'; link.focus(); return; }
        const id = existing?.id || `U-${Date.now().toString(36)}`;
        await ctx.repo.saveUserReading({ ...(existing || {}), id, title: title.value.trim(), kind, media: link.value.trim() || null, level: null, source_note: '', lesson_id: null, audio_file: null, paragraphs });
        dlg.close();
        toast(existing ? 'Đã lưu' : 'Đã thêm');
        ctx.navigate(`read/${encodeURIComponent(id)}?r=${Date.now()}`);
      } }, 'Lưu')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

/** Thanh chọn Lộ trình | Bài đọc ở đầu tab Bài học. */
export function segmented(active) {
  return h('div', { class: 'seg seg-fit seg-page', role: 'tablist' },
    h('a', { class: ['seg-btn', active === 'path' ? 'on' : ''], href: '#/lessons', role: 'tab', 'aria-selected': String(active === 'path') }, 'Lộ trình'),
    h('a', { class: ['seg-btn', active === 'readings' ? 'on' : ''], href: '#/readings', role: 'tab', 'aria-selected': String(active === 'readings') }, 'Thư viện'),
    h('a', { class: ['seg-btn', active === 'basics' ? 'on' : ''], href: '#/basics', role: 'tab', 'aria-selected': String(active === 'basics') }, 'Cơ bản'));
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
    flat.push({ ...st, pi, idx: flat.length, tokens: st.tokens?.length ? fillTokenGaps(st.hanzi, st.tokens) : segmentSentence(st.hanzi, dict, { icu: true }), charPy: null });
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
  // Giọng của từng người nói: xen kẽ nữ / nam theo thứ tự xuất hiện; tên quen trong sách thì theo giới tính.
  const FEMALE_NAMES = /玛丽|田芳|王兰|安娜|珍妮|罗兰|妈妈|姐姐|妹妹|阿姨|小姐|服务员|女/;
  const MALE_NAMES = /大卫|麦克|爱德华|张东|李昌浩|山本|田中|王|林|关|爸爸|哥哥|弟弟|先生|男/;
  const speakers = [...new Set(flat.map((x) => x.speaker).filter(Boolean))];
  const voiceMap = new Map();
  speakers.forEach((sp, i) => {
    const g = FEMALE_NAMES.test(sp) ? 'female' : MALE_NAMES.test(sp) ? 'male' : null;
    voiceMap.set(sp, g || (i % 2 === 0 ? 'female' : 'male'));
  });
  // Hai người cùng giới (vd A, B không rõ tên) → vẫn tách giọng.
  if (speakers.length === 2 && voiceMap.get(speakers[0]) === voiceMap.get(speakers[1]) && !FEMALE_NAMES.test(speakers[1]) && !MALE_NAMES.test(speakers[1])) {
    voiceMap.set(speakers[1], voiceMap.get(speakers[0]) === 'female' ? 'male' : 'female');
  }
  const voiceOf = (sp) => voiceMap.get(sp) || null;

  // Video YouTube (bài hát / thoại phim): câu có mốc thời gian → bấm ▶ thì tua video tới đó.
  const ytId = youtubeId(doc.media);
  const firstT = flat.find((x) => x.t != null)?.t ?? 0;
  const ytFrame = ytId ? h('iframe', { class: 'yt-frame', src: `https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&playsinline=1&rel=0${firstT > 0 ? `&start=${Math.floor(firstT)}` : ''}`, title: doc.title, allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true }) : null;
  const ytCmd = (func, args = []) => ytFrame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  // Nhận thời gian phát hiện tại từ YouTube (để tô câu theo video, không phải tua từng câu).
  let ytTime = 0;
  let ytPlaying = false;
  const timed = flat.filter((x) => x.t != null);
  const onYt = (e) => {
    if (!ytFrame || e.source !== ytFrame.contentWindow) return;
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    if (d?.event === 'infoDelivery' && d.info) {
      if (typeof d.info.currentTime === 'number') ytTime = d.info.currentTime;
      if (typeof d.info.playerState === 'number') ytPlaying = d.info.playerState === 1;
      if (typeof d.info.playerState === 'number' && timed.length) { playingAll = ytPlaying; updatePlayBtn(); }
      followVideo();
    } else if (d?.event === 'onReady' || d?.event === 'initialDelivery') ytListen();
  };
  const ytListen = () => ytFrame?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'reader' }), '*');
  if (ytFrame) { window.addEventListener('message', onYt); ytFrame.addEventListener('load', () => { ytListen(); setTimeout(ytListen, 800); }); }
  /** Câu ứng với thời điểm t của video. */
  const sentenceAt = (t) => { let k = -1; for (const x of timed) { if (x.t <= t + 0.15) k = x.idx; else break; } return k; };
  /** Phát từ mốc t: tua + phát, rồi kiểm tra lại (lệnh tua gửi lúc player chưa sẵn sàng sẽ bị bỏ qua). */
  function ytPlayFrom(t) {
    ytCmd('seekTo', [t, true]);
    ytCmd('playVideo');
    let tries = 0;
    const fix = setInterval(() => {
      tries++;
      if (Math.abs(ytTime - t) <= 2 || tries > 8) { clearInterval(fix); return; }
      if (ytTime < t - 2 || ytTime > t + 6) ytCmd('seekTo', [t, true]);
      ytCmd('playVideo');
    }, 400);
  }
  function followVideo() {
    if (!ytPlaying || !timed.length) return;
    const k = sentenceAt(ytTime);
    if (k >= 0 && k !== current) {
      setCurrent(k);
      if (mode === 'step') renderStep();
      updatePlayBtn();
      root.querySelector(`.sent[data-i="${k}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  function playSentence(st, rate = prefs.rate) {
    if (ytFrame && st.t != null) {
      if (!ytPlaying || Math.abs(ytTime - st.t) > 1.2) ytPlayFrom(st.t); else ytCmd('playVideo');
      stopSeg = () => ytCmd('pauseVideo');
      return Promise.resolve();
    }
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
      speak(st.hanzi, rate, { gender: st.speaker ? voiceOf(st.speaker) : null }).then(() => {
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
      toast(next === 'weak' ? 'Đã đánh dấu chưa nhớ' : next === 'known' ? 'Đã đánh dấu đã nhớ' : 'Đã bỏ đánh dấu');
      closeSheet();
      rerender();
    };
    const meaningInput = h('input', { type: 'text', placeholder: 'Nghĩa tiếng Việt', 'aria-label': 'Nghĩa của từ', autocomplete: 'off' });
    const mtLine = h('div', { class: 'mt-line' }, h('span', { class: 'spinner sm' }), 'Đang dịch…');
    if (!entries.length) {
      translateZhVi(word).then((r) => {
        if (r) {
          mtLine.replaceChildren(h('strong', { class: 'mt-text' }, r.text), h('span', { class: 'mt-src' }, r.source === 'cache' ? 'đã dịch' : r.source));
          if (!meaningInput.value) meaningInput.value = r.text;
        } else mtLine.replaceChildren(h('span', { class: 'muted small' }, 'Chưa dịch được (cần mạng). Gõ nghĩa để lưu:'));
      });
    }
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
            mtLine,
            meaningInput),
      chars.length > 1 ? h('div', { class: 'chars' }, chars.map((ch, k) => {
        const single = dict.map.get(ch)?.[0];
        const cp = single?.pinyin || (pinyinLib ? (st.charPy?.[[...st.hanzi].indexOf(ch)] || pinyinLib.wordPinyin(ch)) : '');
        // Nghĩa từng chữ: thẻ đã học, không có thì lấy từ dữ liệu cấu tạo chữ; kèm âm Hán Việt
        const hvEl = h('b', { class: 'cr-hv' });
        const meanEl = h('span', {}, single?.meaning || '—');
        loadDecomp().then((data) => {
          const d = describeChar(ch, data, cp);
          if (d?.hv) hvEl.textContent = d.hv;
          if (!single?.meaning && d?.meaning) meanEl.textContent = d.meaning.split(',').slice(0, 2).join(',');
        });
        return h('div', { class: 'char-row' }, h('span', { class: 'han' }, ch), h('span', { class: 'muted' }, cp), h('span', {}, hvEl, meanEl));
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
    if (ytFrame && timed.length) {
      const st = flat[current]?.t != null ? flat[current] : timed[0];
      // Đang dừng ở đầu video (chưa tới câu nào) → phát từ mốc câu đầu/câu đang chọn.
      if (!ytPlaying || Math.abs(ytTime - st.t) > 1.2) ytPlayFrom(st.t); else ytCmd('playVideo');
      stopSeg = () => ytCmd('pauseVideo');
      return;
    }
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
    return h('span', { class: ['spk-av', 'han', voiceOf(sp) === 'male' ? 'm' : 'f'], style: { '--c': spkColor.get(sp) }, title: voiceOf(sp) === 'male' ? 'Giọng nam' : 'Giọng nữ', 'aria-hidden': 'true' }, [...sp][0]);
  };

  function sentenceEl(st, { big = false } = {}) {
    const showMeaning = mode === 'normal' && prefs.meaning;
    const meaningEl = h('div', { class: ['s-meaning', showMeaning ? '' : 'hidden'] }, st.meaning || st.mt || '');
    if (!st.meaning && !st.mt) {
      // Câu chưa có bản dịch (vd bài hát tự thêm): dịch máy khi cần hiện nghĩa.
      const fill = () => translateZhVi(st.hanzi).then((r) => { if (r) { st.mt = r.text; meaningEl.replaceChildren(r.text, h('span', { class: 'mt-src' }, 'dịch máy')); } });
      if (showMeaning) fill();
      else new MutationObserver((_, ob) => { if (!meaningEl.classList.contains('hidden')) { ob.disconnect(); fill(); } }).observe(meaningEl, { attributes: true, attributeFilter: ['class'] });
    } else if (!st.meaning && st.mt) meaningEl.append(h('span', { class: 'mt-src' }, 'dịch máy'));
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
          st.t != null && ytFrame ? h('span', { class: 's-time' }, fmtTime(st.t)) : null,
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
      h('a', { class: 'btn ghost back-link', href: doc.kind === 'lesson' ? `#/lesson/${encodeURIComponent(doc.lesson_id)}` : `#/readings?k=${doc.media_kind || 'text'}` }, icon('back'), doc.kind === 'lesson' ? 'Bài học' : 'Thư viện'),
      h('header', { class: 'reader-hero px-box' },
        doc.lesson_id ? h('span', { class: 'rh-art' }, h('img', { src: `./lessons/${encodeURIComponent(doc.lesson_id)}.webp`, alt: '', onerror: (e) => e.target.parentNode.remove() })) : null,
        h('div', { class: 'rh-text' },
          doc.user ? h('div', { class: 'rh-actions' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sửa bài', title: 'Sửa bài', onclick: async () => openAddDialog(ctx, doc.media_kind, await repo.get('readings', doc.id)) }, icon('pencil')),
            h('button', { class: 'icon-btn danger-ic', type: 'button', 'aria-label': 'Xóa bài', title: 'Xóa bài', onclick: async () => { if (!(await confirmDialog({ title: 'Xóa bài này?', ok: 'Xóa', danger: true }))) return; await repo.deleteReading(doc.id); toast('Đã xóa'); ctx.navigate(`readings?k=${doc.media_kind}`); } }, icon('trash'))) : null,
          h('div', { class: 'q-type' }, doc.subtitle),
          h('h1', { class: 'han' }, doc.title),
          lessonRow?.title_vi ? h('p', { class: 'muted', style: { margin: 0 } }, lessonRow.title_vi) : null,
          h('div', { class: 'rh-meta' },
            h('span', {}, icon('lessons'), `${flat.length} câu`),
            h('span', {}, icon('cards'), `${wordCount} từ vựng`),
            audioEl ? h('span', {}, icon('headphones'), 'MP3 của sách') : null))),
      ytFrame ? h('div', { class: 'yt-wrap' }, ytFrame) : null,
      h('div', { class: 'reader-tools' },
        modeBar,
        h('div', { class: 'tool-chips' }, optBtn('pinyin', 'Pinyin'), optBtn('meaning', 'Nghĩa'), optBtn('highlight', 'Tô từ lạ'), fontBtn),
        audioSrc && !flat.some((x) => x.audio_ms) ? h('div', { class: 'reader-mp3' }, audioPlayer(audioSrc, 'MP3 của sách')) : null),
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
    window.removeEventListener('message', onYt);
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
