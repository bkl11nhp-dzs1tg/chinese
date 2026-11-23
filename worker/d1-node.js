// Giả lập API D1 trên node:sqlite để test và chạy server đồng bộ trên máy (không dùng trên Cloudflare).
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
import { readFileSync } from 'node:fs';

export function createD1(file = ':memory:', migrations = []) {
  const db = new DatabaseSync(file);
  for (const m of migrations) db.exec(readFileSync(m, 'utf8'));
  const wrap = (sql, args = []) => ({
    bind: (...a) => wrap(sql, a),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    _exec: () => db.prepare(sql).run(...args),
  });
  return {
    prepare: (sql) => wrap(sql),
    batch: async (stmts) => {
      db.exec('BEGIN');
      try { for (const s of stmts) s._exec(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      return stmts.map(() => ({ success: true }));
    },
  };
}
