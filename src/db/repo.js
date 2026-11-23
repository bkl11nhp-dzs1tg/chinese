// Hàm đọc/ghi dùng chung trên IndexedDB. Không phụ thuộc DOM, test được với fake-indexeddb.

import { DB_NAME, DB_VERSION, EXPORT_STORES, STORES } from './schema.js';
import { runMigrations } from './migrations.js';
import { newCardState, review, reviewLight, markMastered } from '../core/srs.js';
import { withDefaults } from '../core/settings.js';
import { uuid } from '../core/uuid.js';

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('Giao dịch bị hủy'));
});

export function openDb({ factory = globalThis.indexedDB, name = DB_NAME, version = DB_VERSION } = {}) {
  return new Promise((resolve, reject) => {
    const r = factory.open(name, version);
    r.onupgradeneeded = (e) => runMigrations(r.result, e.oldVersion, e.newVersion ?? version, r.transaction);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Cơ sở dữ liệu đang bị tab khác giữ, hãy đóng các tab cũ.'));
  });
}

export function createRepo(db) {
  // ---------------------------------------------------------------- cơ bản
  const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
  const get = (name, key) => req(store(name).get(key));
  const getAll = (name) => req(store(name).getAll());
  const count = (name) => req(store(name).count());
  const byIndex = (name, index, query) => req(store(name).index(index).getAll(query));

  async function put(name, value) {
    const tx = db.transaction(name, 'readwrite');
    tx.objectStore(name).put(value);
    await done(tx);
    return value;
  }
  async function putMany(name, values) {
    const tx = db.transaction(name, 'readwrite');
    const s = tx.objectStore(name);
    for (const v of values) s.put(v);
    await done(tx);
  }
  async function del(name, key) {
    const tx = db.transaction(name, 'readwrite');
    tx.objectStore(name).delete(key);
    await done(tx);
  }

  // ---------------------------------------------------------------- cài đặt
  async function getSettings() {
    const rows = await getAll('settings');
    return withDefaults(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }
  async function saveSettings(patch, now = Date.now()) {
    const tx = db.transaction('settings', 'readwrite');
    const s = tx.objectStore('settings');
    for (const [key, value] of Object.entries(patch)) s.put({ key, value, updated_at: now });
    await done(tx);
    return getSettings();
  }

  // ---------------------------------------------------------------- SRS
  /**
   * Ghi một lần chấm: cập nhật card_state và thêm review_event trong cùng một giao dịch.
   * mode: 'full' (SM-2), 'light' (trò chơi, nửa hệ số), 'none' (chỉ ghi sự kiện, ví dụ ôn lại trong buổi).
   */
  async function recordReview({ cardId, quality, activity, sessionId = null, now = Date.now(), mode = 'full' }) {
    const tx = db.transaction(['card_state', 'review_events'], 'readwrite');
    const states = tx.objectStore('card_state');
    const current = (await req(states.get(cardId))) || null;
    let next = current;
    if (mode === 'full') next = review(current || newCardState(cardId, now), quality, now);
    else if (mode === 'mastered') next = markMastered(current || newCardState(cardId, now), now);
    else if (mode === 'light' && current) next = reviewLight(current, quality, now);
    if (next && next !== current) states.put(next);
    const event = { id: uuid(), card_id: cardId, quality, activity, session_id: sessionId, created_at: now };
    tx.objectStore('review_events').put(event);
    await done(tx);
    return { state: next, event, previous: current };
  }

  /** Hoàn tác một lần chấm (nút "Quay lại"): khôi phục trạng thái cũ, xóa sự kiện. */
  async function undoReview({ cardId, previous, eventId }) {
    const tx = db.transaction(['card_state', 'review_events'], 'readwrite');
    if (previous) tx.objectStore('card_state').put(previous);
    else tx.objectStore('card_state').delete(cardId);
    if (eventId) tx.objectStore('review_events').delete(eventId);
    await done(tx);
  }

  /** Đưa thẻ (đã học) vào hàng đợi ôn ngay: due_at = now. */
  async function makeDue(cardIds, now = Date.now()) {
    const tx = db.transaction('card_state', 'readwrite');
    const s = tx.objectStore('card_state');
    for (const id of cardIds) {
      const st = await req(s.get(id));
      if (st && st.due_at > now) s.put({ ...st, due_at: now });
    }
    await done(tx);
  }

  // ---------------------------------------------------------------- nội dung
  /** Gộp nội dung: id đã có thì cập nhật nội dung hiển thị, giữ nguyên card_state và lesson_progress. */
  async function importContent({ cards = [], lessons = [], exercises = [], readings = [] }) {
    const tx = db.transaction(['cards', 'lessons', 'exercises', 'readings'], 'readwrite');
    const cs = tx.objectStore('cards');
    const ls = tx.objectStore('lessons');
    const es = tx.objectStore('exercises');
    for (const r of readings) tx.objectStore('readings').put(r);
    for (const c of cards) cs.put(c);
    for (const l of lessons) {
      const old = await req(ls.get(l.id));
      const vocab = old ? [...new Set([...l.vocab_ids, ...old.vocab_ids])] : l.vocab_ids;
      ls.put({ ...l, vocab_ids: vocab });
    }
    for (const e of exercises) es.put(e);
    await done(tx);
  }

  async function existingIds() {
    const keys = (name) => req(store(name).getAllKeys());
    const [cardIds, lessonIds, exerciseIds, readingIds] = await Promise.all([keys('cards'), keys('lessons'), keys('exercises'), keys('readings')]);
    return { cardIds: new Set(cardIds), lessonIds: new Set(lessonIds), exerciseIds: new Set(exerciseIds), readingIds: new Set(readingIds) };
  }

  // ---------------------------------------------------------------- bài học
  async function lessonsOrdered() {
    const ls = await getAll('lessons');
    return ls.sort((a, b) => (a.book || '').localeCompare(b.book || '', 'vi') || a.order - b.order || a.id.localeCompare(b.id));
  }

  async function saveLessonScore(lessonId, score, now = Date.now()) {
    const tx = db.transaction('lesson_progress', 'readwrite');
    const s = tx.objectStore('lesson_progress');
    const old = (await req(s.get(lessonId))) || { lesson_id: lessonId, status: 'todo', best_score: null, attempts: 0 };
    const next = {
      ...old,
      best_score: old.best_score == null ? score : Math.max(old.best_score, score),
      attempts: old.attempts + 1,
      status: old.status === 'todo' ? 'doing' : old.status,
      updated_at: now,
    };
    s.put(next);
    await done(tx);
    return next;
  }

  /** Lưu kết quả kiểm tra cuối bài: giữ điểm cao nhất, đếm số lần. */
  async function saveTestScore(lessonId, score, now = Date.now()) {
    const tx = db.transaction('lesson_progress', 'readwrite');
    const s = tx.objectStore('lesson_progress');
    const old = (await req(s.get(lessonId))) || { lesson_id: lessonId, status: 'todo', best_score: null, attempts: 0 };
    const next = {
      ...old,
      test_best: old.test_best == null ? score : Math.max(old.test_best, score),
      test_last: score,
      test_attempts: (old.test_attempts || 0) + 1,
      updated_at: now,
    };
    s.put(next);
    await done(tx);
    return next;
  }

  async function setLessonStatus(lessonId, status, now = Date.now()) {
    const old = (await get('lesson_progress', lessonId)) || { lesson_id: lessonId, best_score: null, attempts: 0 };
    if (old.status === status) return old;
    return put('lesson_progress', { ...old, status, updated_at: now });
  }

  // ---------------------------------------------------------------- bài đọc (mục 9.11)
  /** Lưu vị trí đọc; gộp với bản cũ (số lần tra, kết quả đoán). */
  async function saveReadingProgress(readingId, patch, now = Date.now()) {
    const tx = db.transaction('reading_progress', 'readwrite');
    const s = tx.objectStore('reading_progress');
    const old = (await req(s.get(readingId))) || { reading_id: readingId, last_sentence_index: 0, finished: false, lookups: 0, guess_correct: 0, guess_total: 0 };
    const next = { ...old, ...patch, updated_at: now };
    s.put(next);
    await done(tx);
    return next;
  }

  async function recordLookup({ word, readingId = null, sentenceIndex = null, now = Date.now() }) {
    const tx = db.transaction(['word_lookups', 'reading_progress'], 'readwrite');
    tx.objectStore('word_lookups').put({ id: uuid(), word, reading_id: readingId, sentence_index: sentenceIndex, created_at: now, saved: false });
    if (readingId) {
      const ps = tx.objectStore('reading_progress');
      const old = (await req(ps.get(readingId))) || { reading_id: readingId, last_sentence_index: 0, finished: false, lookups: 0, guess_correct: 0, guess_total: 0 };
      ps.put({ ...old, lookups: (old.lookups || 0) + 1, updated_at: now });
    }
    await done(tx);
  }

  const lookupCount = async (word) => (await byIndex('word_lookups', 'word', word)).length;

  /** Lưu từ mới từ bài đọc thành thẻ (source = reading), đi vào hàng đợi như thẻ mới. */
  async function saveReadingWord({ hanzi, pinyin, meaning, readingId, sentenceIndex, example = '', exampleMeaning = '', now = Date.now() }) {
    const id = `RD-${hanzi}`;
    const existing = await get('cards', id);
    const card = existing || {
      id, hanzi, pinyin, meaning: meaning || '(chưa có nghĩa — sửa trong file từ vựng)', hsk_level: null, lesson_id: null,
      example, example_pinyin: '', example_meaning: exampleMeaning, tags: ['bài đọc'], pos: '', han_viet: '',
      source: 'reading', reading_id: readingId, sentence_index: sentenceIndex, created_at: now,
    };
    if (!existing) await put('cards', card);
    return card;
  }

  const markKnown = (word, now = Date.now()) => put('known_words', { word, marked_at: now });
  const unmarkKnown = (word) => del('known_words', word);

  // ---------------------------------------------------------------- buổi học
  const saveSession = (session) => put('study_sessions', session);

  // ---------------------------------------------------------------- âm thanh
  const putAudio = (lessonId, blob, name) => put('audio', { lesson_id: lessonId, blob, name, size: blob.size });
  const getAudio = (lessonId) => get('audio', lessonId);
  async function audioIndex() {
    const keys = await req(store('audio').getAllKeys());
    return new Set(keys);
  }

  // ---------------------------------------------------------------- xuất / khôi phục / xóa
  async function exportAll(now = Date.now()) {
    const out = { format: 'chinese-study-backup', version: 1, exported_at: now };
    for (const name of EXPORT_STORES) out[name] = await getAll(name);
    return out;
  }

  async function restoreBackup(data) {
    if (data?.format !== 'chinese-study-backup') throw new Error('Không phải file sao lưu của app.');
    const names = EXPORT_STORES.filter((n) => Array.isArray(data[n]));
    const tx = db.transaction(names, 'readwrite');
    for (const n of names) {
      const s = tx.objectStore(n);
      s.clear();
      for (const row of data[n]) s.put(row);
    }
    await done(tx);
  }

  async function clearAll() {
    const names = Object.keys(STORES);
    const tx = db.transaction(names, 'readwrite');
    for (const n of names) tx.objectStore(n).clear();
    await done(tx);
  }

  return {
    db, get, getAll, count, byIndex, put, putMany, delete: del,
    getSettings, saveSettings,
    recordReview, undoReview, makeDue,
    importContent, existingIds,
    saveReadingProgress, recordLookup, lookupCount, saveReadingWord, markKnown, unmarkKnown,
    lessonsOrdered, saveLessonScore, saveTestScore, setLessonStatus,
    saveSession,
    putAudio, getAudio, audioIndex,
    exportAll, restoreBackup, clearAll,
  };
}
