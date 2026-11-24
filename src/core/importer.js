// Đọc và kiểm tra nội dung (mục 8). Dùng chung cho app (Cài đặt → Nạp nội dung)
// và scripts/validate-content.js. Chỉ báo lỗi, không tự sửa dữ liệu.

import { parseCsv } from './csv.js';

export const VOCAB_COLUMNS = [
  'id', 'hanzi', 'pinyin', 'meaning', 'hsk_level', 'lesson_id',
  'example', 'example_pinyin', 'example_meaning', 'tags',
  'pos', 'han_viet', // tùy chọn: từ loại, âm Hán Việt
];
export const REQUIRED_COLUMNS = ['id', 'hanzi', 'pinyin', 'meaning'];
export const EXERCISE_TYPES = ['choose', 'fill', 'match', 'reorder'];
export const PACK_FORMAT = 'chinese-study-pack';

const issue = (source, line, message) => ({ source, line, message });
const str = (v) => (v == null ? '' : String(v).trim());

/** Chuẩn hóa NFC để chữ Hán và dấu pinyin so sánh được ổn định. */
const nfc = (v) => str(v).normalize('NFC');

// ---------------------------------------------------------------------------
// CSV từ vựng

export function parseVocabCsv(text, source = 'vocab.csv') {
  const errors = [];
  const warnings = [];
  const cards = [];
  const rows = parseCsv(text).filter((r) => r.cells.some((c) => c.trim() !== ''));
  if (!rows.length) {
    errors.push(issue(source, null, 'File rỗng.'));
    return { cards, errors, warnings };
  }
  const header = rows[0].cells.map((c) => c.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    errors.push(issue(source, rows[0].line, `Thiếu cột bắt buộc: ${missing.join(', ')}.`));
    return { cards, errors, warnings };
  }
  const unknown = header.filter((c) => c && !VOCAB_COLUMNS.includes(c));
  if (unknown.length) warnings.push(issue(source, rows[0].line, `Cột không dùng tới: ${unknown.join(', ')}.`));

  for (const { line, cells } of rows.slice(1)) {
    const rec = {};
    header.forEach((col, i) => { rec[col] = nfc(cells[i]); });
    if (cells.length > header.length && cells.slice(header.length).some((c) => c.trim())) {
      warnings.push(issue(source, line, 'Dòng có nhiều ô hơn tiêu đề; phần thừa bị bỏ qua (thiếu ngoặc kép?).'));
    }
    const card = buildCard(rec, source, line, errors);
    if (card) cards.push(card);
  }
  return { cards, errors, warnings };
}

function buildCard(rec, source, line, errors) {
  const missing = REQUIRED_COLUMNS.filter((c) => !str(rec[c]));
  if (missing.length) {
    errors.push(issue(source, line, `Thiếu ${missing.join(', ')}${rec.id ? ` (id ${rec.id})` : ''}.`));
    return null;
  }
  let hsk = null;
  const rawHsk = str(rec.hsk_level);
  if (rawHsk !== '') {
    const n = Number(rawHsk);
    if (!Number.isInteger(n) || n < 1 || n > 6) {
      errors.push(issue(source, line, `hsk_level phải là số nguyên 1–6 hoặc để trống, nhận được "${rawHsk}" (id ${rec.id}).`));
      return null;
    }
    hsk = n;
  }
  const tags = Array.isArray(rec.tags)
    ? rec.tags.map(str).filter(Boolean)
    : str(rec.tags).split(';').map((t) => t.trim()).filter(Boolean);
  return {
    id: nfc(rec.id),
    hanzi: nfc(rec.hanzi),
    pinyin: nfc(rec.pinyin),
    meaning: nfc(rec.meaning),
    hsk_level: hsk,
    lesson_id: nfc(rec.lesson_id) || null,
    example: nfc(rec.example),
    example_pinyin: nfc(rec.example_pinyin),
    example_meaning: nfc(rec.example_meaning),
    tags,
    pos: nfc(rec.pos),
    han_viet: nfc(rec.han_viet),
  };
}

// ---------------------------------------------------------------------------
// JSON bài học (một bài, mảng bài, hoặc gói {cards, lessons})

export function parseContentJson(text, source = 'content.json') {
  const errors = [];
  const warnings = [];
  const cards = [];
  const lessons = [];
  const exercises = [];
  const readings = [];
  let data;
  try {
    data = typeof text === 'string' ? JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) : text;
  } catch (e) {
    errors.push(issue(source, null, `JSON không hợp lệ: ${e.message}`));
    return { cards, lessons, exercises, readings, errors, warnings };
  }

  // Bài đọc: một bài (có paragraphs), mảng bài đọc, hoặc gói có trường readings.
  const isReading = (x) => x && typeof x === 'object' && Array.isArray(x.paragraphs);
  if (isReading(data) || (Array.isArray(data) && data.length && data.every(isReading))) {
    (Array.isArray(data) ? data : [data]).forEach((r, i) => {
      const rd = buildReading(r, source, `bài đọc #${i + 1}${r?.id ? ` (${r.id})` : ''}`, errors);
      if (rd) readings.push(rd);
    });
    return { cards, lessons, exercises, readings, errors, warnings };
  }
  if (data && Array.isArray(data.readings)) {
    data.readings.forEach((r, i) => {
      const rd = buildReading(r, source, `readings[${i}]`, errors);
      if (rd) readings.push(rd);
    });
  }

  let lessonList = [];
  if (Array.isArray(data)) lessonList = data;
  else if (data && (Array.isArray(data.lessons) || Array.isArray(data.cards) || Array.isArray(data.readings))) {
    lessonList = data.lessons || [];
    (data.cards || []).forEach((c, i) => {
      const card = buildCard(c, source, `cards[${i}]`, errors);
      if (card) cards.push(card);
    });
  } else if (data && typeof data === 'object') lessonList = [data];

  lessonList.forEach((raw, i) => {
    const where = `bài #${i + 1}${raw?.id ? ` (${raw.id})` : ''}`;
    if (!raw || typeof raw !== 'object') {
      errors.push(issue(source, where, 'Bài học phải là một object.'));
      return;
    }
    if (!str(raw.id)) { errors.push(issue(source, where, 'Bài học thiếu id.')); return; }
    if (!str(raw.title)) errors.push(issue(source, where, 'Bài học thiếu title.'));
    const lesson = {
      id: nfc(raw.id),
      book: nfc(raw.book) || 'Khác',
      unit: Number.isFinite(Number(raw.unit)) ? Number(raw.unit) : null,
      order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : i + 1,
      title: nfc(raw.title),
      title_vi: nfc(raw.title_vi),
      vocab_ids: Array.isArray(raw.vocab_ids) ? raw.vocab_ids.map(nfc) : [],
      grammar_points: Array.isArray(raw.grammar_points)
        ? raw.grammar_points.map((g, k) => ({
            id: nfc(g.id) || `${raw.id}-g${k + 1}`,
            title: nfc(g.title),
            note: nfc(g.note),
            example: nfc(g.example),
            examples: Array.isArray(g.examples)
              ? g.examples.map((e) => ({ zh: nfc(e.zh), pinyin: nfc(e.pinyin), vi: nfc(e.vi) })).filter((e) => e.zh)
              : [],
            example_ids: Array.isArray(g.example_ids) ? g.example_ids.map(nfc) : [],
          }))
        : [],
      texts: Array.isArray(raw.texts)
        ? raw.texts.map((t, k) => ({
            title: nfc(t.title),
            lines: (Array.isArray(t.lines) ? t.lines : [])
              .map((ln) => ({ speaker: nfc(ln.speaker), zh: nfc(ln.zh), pinyin: nfc(ln.pinyin), vi: nfc(ln.vi) }))
              .filter((ln) => {
                if (!ln.zh) errors.push(issue(source, `${where} bài khóa #${k + 1}`, 'Có dòng bài khóa thiếu chữ Hán.'));
                return !!ln.zh;
              }),
          }))
        : [],
    };
    lessons.push(lesson);
    (Array.isArray(raw.exercises) ? raw.exercises : []).forEach((ex, k) => {
      const e = buildExercise(ex, lesson.id, source, `${where} bài tập #${k + 1}`, errors);
      if (e) exercises.push(e);
    });
  });
  return { cards, lessons, exercises, readings, errors, warnings };
}

/** Bài đọc (mục 9.11 d.2). Kiểm tra: id, câu không rỗng, audio_ms.end > start, tokens trong độ dài câu. */
function buildReading(raw, source, where, errors) {
  if (!raw || typeof raw !== 'object') { errors.push(issue(source, where, 'Bài đọc phải là object.')); return null; }
  const id = nfc(raw.id);
  if (!id) { errors.push(issue(source, where, 'Bài đọc thiếu id.')); return null; }
  let ok = true;
  const sentIds = new Set();
  const paragraphs = raw.paragraphs.map((p, pi) => ({
    id: nfc(p?.id) || `p${pi + 1}`,
    sentences: (Array.isArray(p?.sentences) ? p.sentences : []).map((st, si) => {
      const loc = `${where} câu ${pi + 1}.${si + 1}${st?.id ? ` (${st.id})` : ''}`;
      const hanzi = nfc(st?.hanzi);
      if (!hanzi) { errors.push(issue(source, loc, 'Câu rỗng (thiếu hanzi).')); ok = false; }
      const sid = nfc(st?.id) || `s${pi + 1}-${si + 1}`;
      if (sentIds.has(sid)) { errors.push(issue(source, loc, `id câu trùng: ${sid}`)); ok = false; }
      sentIds.add(sid);
      let audio_ms = null;
      if (st?.audio_ms) {
        const a = Number(st.audio_ms.start);
        const b = Number(st.audio_ms.end);
        if (!(Number.isFinite(a) && Number.isFinite(b) && b > a && a >= 0)) {
          errors.push(issue(source, loc, 'audio_ms.end phải lớn hơn audio_ms.start.'));
          ok = false;
        } else audio_ms = { start: a, end: b };
      }
      let tokens = null;
      if (Array.isArray(st?.tokens)) {
        const n = [...hanzi].length;
        const bad = st.tokens.some((t) => !(Number.isInteger(t.start) && Number.isInteger(t.end) && t.start >= 0 && t.end <= n && t.start < t.end));
        if (bad) { errors.push(issue(source, loc, 'tokens vượt quá độ dài câu.')); ok = false; }
        else tokens = st.tokens.map((t) => ({ text: [...hanzi].slice(t.start, t.end).join(''), start: t.start, end: t.end, word: true }));
      }
      return { id: sid, hanzi, pinyin: nfc(st?.pinyin), meaning: nfc(st?.meaning), audio_ms, tokens };
    }),
  }));
  if (!paragraphs.some((p) => p.sentences.length)) { errors.push(issue(source, where, 'Bài đọc không có câu nào.')); ok = false; }
  if (!ok) return null;
  const audioFile = typeof raw.audio === 'string' ? raw.audio : raw.audio?.file || raw.audio_file || null;
  return {
    id,
    title: nfc(raw.title) || id,
    level: Number.isFinite(Number(raw.level)) && raw.level != null ? Number(raw.level) : null,
    source: nfc(raw.source),
    audio_file: audioFile ? nfc(audioFile) : null,
    lesson_id: nfc(raw.lesson_id) || null,
    paragraphs,
  };
}

function buildExercise(ex, lessonId, source, where, errors) {
  if (!ex || typeof ex !== 'object') { errors.push(issue(source, where, 'Bài tập phải là object.')); return null; }
  const id = nfc(ex.id);
  if (!id) { errors.push(issue(source, where, 'Bài tập thiếu id.')); return null; }
  const type = str(ex.type);
  if (!EXERCISE_TYPES.includes(type)) {
    errors.push(issue(source, where, `Dạng bài tập "${type}" không hỗ trợ (chỉ ${EXERCISE_TYPES.join(', ')}).`));
    return null;
  }
  const options = Array.isArray(ex.options) ? ex.options.map(nfc) : [];
  const base = {
    id, lesson_id: lessonId, type,
    prompt: nfc(ex.prompt),
    options,
    answer: Array.isArray(ex.answer) ? ex.answer.map(nfc) : nfc(ex.answer),
    explanation: nfc(ex.explanation),
    card_ids: Array.isArray(ex.card_ids) ? ex.card_ids.map(nfc) : [],
    pairs: [],
  };
  const fail = (m) => { errors.push(issue(source, `${where} (${id})`, m)); return null; };

  if (type === 'choose') {
    if (options.length < 2) return fail('Dạng choose cần ít nhất 2 lựa chọn.');
    if (!options.includes(base.answer)) return fail('answer không nằm trong options.');
  } else if (type === 'fill') {
    const answers = Array.isArray(base.answer) ? base.answer : [base.answer];
    if (!answers.some(Boolean)) return fail('Dạng fill thiếu answer.');
  } else if (type === 'match') {
    const pairs = Array.isArray(ex.pairs) ? ex.pairs : [];
    base.pairs = pairs.map((p) => ({ left: nfc(p.left), right: nfc(p.right) })).filter((p) => p.left && p.right);
    if (base.pairs.length < 2) return fail('Dạng match cần ít nhất 2 cặp {left, right}.');
  } else if (type === 'reorder') {
    if (options.length < 2) return fail('Dạng reorder cần ít nhất 2 mảnh trong options.');
    const ans = Array.isArray(base.answer) ? base.answer.join('') : base.answer;
    const sortChars = (s) => [...s.replace(/\s+/g, '')].sort().join('');
    if (sortChars(ans) !== sortChars(options.join(''))) return fail('answer không ghép được từ đúng các mảnh trong options.');
  }
  return base;
}

// ---------------------------------------------------------------------------
// Kiểm tra chéo toàn bộ nội dung

export function validateContent({ cards = [], lessons = [], exercises = [], readings = [] }) {
  const errors = [];
  const warnings = [];
  const dupCheck = (items, label) => {
    const seen = new Set();
    for (const it of items) {
      if (seen.has(it.id)) errors.push(issue(label, null, `id trùng: ${it.id}`));
      seen.add(it.id);
    }
    return seen;
  };
  const cardIds = dupCheck(cards, 'từ vựng');
  const lessonIds = dupCheck(lessons, 'bài học');
  dupCheck(exercises, 'bài tập');
  dupCheck(readings, 'bài đọc');

  for (const c of cards) {
    if (c.lesson_id && !lessonIds.has(c.lesson_id)) {
      warnings.push(issue('từ vựng', null, `${c.id}: lesson_id "${c.lesson_id}" không có trong file bài học.`));
    }
  }
  for (const l of lessons) {
    for (const vid of l.vocab_ids) {
      if (!cardIds.has(vid)) warnings.push(issue('bài học', null, `${l.id}: vocab_ids có "${vid}" nhưng không có từ này.`));
    }
  }
  for (const e of exercises) {
    for (const cid of e.card_ids) {
      if (!cardIds.has(cid)) warnings.push(issue('bài tập', null, `${e.id}: card_ids có "${cid}" nhưng không có từ này.`));
    }
  }
  return {
    errors,
    warnings,
    counts: { cards: cards.length, lessons: lessons.length, exercises: exercises.length, readings: readings.length },
  };
}

/** Bổ sung vocab_ids cho bài từ cột lesson_id của từ vựng (giữ thứ tự, không trùng). */
export function linkLessonVocab(lessons, cards) {
  const byLesson = new Map();
  for (const c of cards) {
    if (!c.lesson_id) continue;
    if (!byLesson.has(c.lesson_id)) byLesson.set(c.lesson_id, []);
    byLesson.get(c.lesson_id).push(c.id);
  }
  return lessons.map((l) => {
    const ids = [...l.vocab_ids];
    for (const id of byLesson.get(l.id) || []) if (!ids.includes(id)) ids.push(id);
    return { ...l, vocab_ids: ids };
  });
}

/**
 * Đọc nhiều file cùng lúc: .csv → từ vựng, .json → bài học hoặc gói nội dung.
 * files: [{ name, text }]
 */
export function loadContentFiles(files) {
  const all = { cards: [], lessons: [], exercises: [], readings: [], errors: [], warnings: [] };
  for (const f of files) {
    const name = f.name || '';
    let r;
    if (/\.csv$/i.test(name)) r = { ...parseVocabCsv(f.text, name), lessons: [], exercises: [], readings: [] };
    else if (/\.json$/i.test(name)) r = parseContentJson(f.text, name);
    else { all.warnings.push(issue(name, null, 'Bỏ qua: chỉ nhận .csv và .json.')); continue; }
    all.cards.push(...r.cards);
    all.lessons.push(...r.lessons);
    all.exercises.push(...r.exercises);
    all.readings.push(...(r.readings || []));
    all.errors.push(...r.errors);
    all.warnings.push(...r.warnings);
  }
  all.lessons = linkLessonVocab(all.lessons, all.cards);
  const v = validateContent(all);
  all.errors.push(...v.errors);
  all.warnings.push(...v.warnings);
  all.counts = v.counts;
  return all;
}

/**
 * Xem trước khi gộp (mục 8.5): bao nhiêu mục mới, bao nhiêu mục sẽ cập nhật.
 * existing: { cardIds, lessonIds, exerciseIds } (Set hoặc mảng).
 */
export function planMerge(existing, incoming) {
  const toSet = (x) => (x instanceof Set ? x : new Set(x || []));
  const ex = { cards: toSet(existing.cardIds), lessons: toSet(existing.lessonIds), exercises: toSet(existing.exerciseIds), readings: toSet(existing.readingIds) };
  const split = (items, set) => ({
    added: items.filter((i) => !set.has(i.id)).length,
    updated: items.filter((i) => set.has(i.id)).length,
  });
  return {
    cards: split(incoming.cards, ex.cards),
    lessons: split(incoming.lessons, ex.lessons),
    exercises: split(incoming.exercises, ex.exercises),
    readings: split(incoming.readings || [], ex.readings),
  };
}

/** Gói nội dung để nạp một lần (dùng cho điện thoại). */
export function buildPack({ cards, lessons, exercises, readings = [] }) {
  const exByLesson = new Map();
  for (const e of exercises) {
    if (!exByLesson.has(e.lesson_id)) exByLesson.set(e.lesson_id, []);
    const { lesson_id, ...rest } = e;
    if (rest.type !== 'match') delete rest.pairs;
    exByLesson.get(e.lesson_id).push(rest);
  }
  return {
    format: PACK_FORMAT,
    version: 1,
    cards,
    lessons: lessons.map((l) => ({ ...l, exercises: exByLesson.get(l.id) || [] })),
    readings,
  };
}
