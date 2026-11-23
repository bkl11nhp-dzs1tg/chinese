// Migration theo phiên bản. Mỗi bước chỉ thêm, không xóa dữ liệu người dùng.

import { STORES } from './schema.js';

function createStores(db, version) {
  for (const [name, def] of Object.entries(STORES)) {
    if ((def.since || 1) !== version) continue;
    if (db.objectStoreNames.contains(name)) continue;
    const store = db.createObjectStore(name, { keyPath: def.keyPath });
    for (const [idx, path] of Object.entries(def.indexes || {})) store.createIndex(idx, path);
  }
}

export const MIGRATIONS = {
  1(db) { createStores(db, 1); },
  // v2: bài đọc, tiến độ đọc, lịch sử tra từ, từ đã biết.
  2(db) { createStores(db, 2); },
  // v3: siêu dữ liệu đồng bộ.
  3(db) { createStores(db, 3); },
};

export function runMigrations(db, oldVersion, newVersion, tx) {
  for (let v = oldVersion + 1; v <= newVersion; v++) MIGRATIONS[v]?.(db, tx);
}
