// Quy tắc gộp dữ liệu học giữa nhiều thiết bị (mục 12.1). Hàm thuần.
// Mỗi store đồng bộ có khóa riêng và luật gộp riêng; nội dung sách (cards gốc, lessons, exercises,
// readings) không đồng bộ vì mọi thiết bị đều lấy từ cùng gói nội dung.

const STATUS_RANK = { todo: 0, doing: 1, done: 2 };
const max = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b));

export const SYNC_STORES = {
  card_state: { key: 'card_id' },
  review_events: { key: 'id' },
  lesson_progress: { key: 'lesson_id' },
  study_sessions: { key: 'id' },
  settings: { key: 'key' },
  reading_progress: { key: 'reading_id' },
  word_lookups: { key: 'id' },
  known_words: { key: 'word' },
  // Chỉ thẻ người học tự tạo (lưu từ bài đọc); thẻ từ gói nội dung không đồng bộ.
  cards: { key: 'id', filter: (c) => c.source === 'reading' },
  // Bài hát / thoại phim người học tự thêm.
  readings: { key: 'id', filter: (r) => r.source === 'user' },
};

/** Cài đặt chỉ thuộc về một thiết bị, không đồng bộ. */
export const LOCAL_SETTINGS = new Set(['content_version', 'last_export_at', 'last_sync_at', 'sync_url']);

export function recordKey(store, rec) {
  return String(rec[SYNC_STORES[store].key]);
}

export function shouldSync(store, rec) {
  const def = SYNC_STORES[store];
  if (!def || !rec) return false;
  if (store === 'settings' && LOCAL_SETTINGS.has(rec.key)) return false;
  return def.filter ? def.filter(rec) : true;
}

/** Gộp bản trên máy (local) và bản từ server (remote) của cùng một khóa. Trả về bản kết quả. */
export function mergeRecord(store, local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  switch (store) {
    case 'card_state': {
      const lt = local.last_reviewed_at ?? -1;
      const rt = remote.last_reviewed_at ?? -1;
      if (lt !== rt) return lt > rt ? local : remote;
      return (local.repetitions ?? 0) >= (remote.repetitions ?? 0) ? local : remote;
    }
    case 'lesson_progress': {
      const status = (STATUS_RANK[local.status] ?? 0) >= (STATUS_RANK[remote.status] ?? 0) ? local.status : remote.status;
      return {
        ...remote,
        ...local,
        status,
        best_score: max(local.best_score, remote.best_score),
        test_best: max(local.test_best, remote.test_best),
        attempts: max(local.attempts, remote.attempts) ?? 0,
        test_attempts: max(local.test_attempts, remote.test_attempts),
        test_last: (local.updated_at ?? 0) >= (remote.updated_at ?? 0) ? local.test_last : remote.test_last,
        updated_at: max(local.updated_at, remote.updated_at),
        grammar_done: [...new Set([...(local.grammar_done || []), ...(remote.grammar_done || [])])],
      };
    }
    case 'study_sessions':
      return (remote.active_ms ?? 0) > (local.active_ms ?? 0) ? remote : local;
    case 'settings':
      return (remote.updated_at ?? 0) > (local.updated_at ?? 0) ? remote : local;
    case 'reading_progress': {
      const newer = (remote.updated_at ?? 0) > (local.updated_at ?? 0) ? remote : local;
      return {
        ...newer,
        lookups: max(local.lookups, remote.lookups) ?? 0,
        guess_total: max(local.guess_total, remote.guess_total) ?? 0,
        guess_correct: max(local.guess_correct, remote.guess_correct) ?? 0,
        finished: !!(local.finished || remote.finished),
      };
    }
    case 'readings':
      return (remote.updated_at ?? 0) > (local.updated_at ?? 0) ? remote : local;
    case 'cards':
      // Giữ bản có nghĩa (người học có thể đã gõ nghĩa trên một thiết bị).
      return local.meaning && !/^\(chưa có nghĩa/.test(local.meaning) ? local : remote;
    case 'known_words':
      return (remote.marked_at ?? 0) > (local.marked_at ?? 0) ? remote : local;
    default:
      // review_events, word_lookups: bất biến, giữ bản đang có.
      return local;
  }
}

/** So sánh nội dung hai bản ghi (để biết có cần ghi/đẩy lại không). */
export function sameRecord(a, b) {
  return stableJson(a) === stableJson(b);
}

export function stableJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`;
}

/** Băm ngắn (FNV-1a 32 bit) để nhớ bản đã đồng bộ mà không phải lưu cả bản ghi. */
export function hashRecord(rec) {
  const s = stableJson(rec);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
