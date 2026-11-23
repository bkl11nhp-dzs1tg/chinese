// Định nghĩa các store IndexedDB (mục 6.1).

export const DB_NAME = 'chinese-study';
export const DB_VERSION = 2;

export const STORES = {
  cards: { keyPath: 'id', indexes: { lesson_id: 'lesson_id' } },
  card_state: { keyPath: 'card_id', indexes: { due_at: 'due_at' } },
  lessons: { keyPath: 'id', indexes: { order: 'order' } },
  exercises: { keyPath: 'id', indexes: { lesson_id: 'lesson_id' } },
  lesson_progress: { keyPath: 'lesson_id' },
  review_events: { keyPath: 'id', indexes: { created_at: 'created_at', card_id: 'card_id', session_id: 'session_id' } },
  study_sessions: { keyPath: 'id', indexes: { started_at: 'started_at' } },
  settings: { keyPath: 'key' },
  sync_queue: { keyPath: 'id', indexes: { created_at: 'created_at' } },
  // File âm thanh của bài (Blob), tách riêng để không nằm trong bản xuất JSON.
  audio: { keyPath: 'lesson_id' },
  // Bài đọc (mục 9.11, phiên bản 2)
  readings: { keyPath: 'id', since: 2 },
  reading_progress: { keyPath: 'reading_id', since: 2 },
  word_lookups: { keyPath: 'id', indexes: { word: 'word', created_at: 'created_at' }, since: 2 },
  known_words: { keyPath: 'word', since: 2 },
};

/** Store được đưa vào bản xuất/sao lưu JSON. */
export const EXPORT_STORES = [
  'cards', 'card_state', 'lessons', 'exercises', 'lesson_progress',
  'review_events', 'study_sessions', 'settings',
  'readings', 'reading_progress', 'word_lookups', 'known_words',
];
