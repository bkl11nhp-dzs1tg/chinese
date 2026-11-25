// API tài khoản + đồng bộ (mục 12). Chạy trên Cloudflare Workers với D1; cũng chạy được trên Node
// (scripts/sync-dev-server.js) với lớp giả lập D1 trên node:sqlite.
//
// POST /api/register   {username, password}          → {token, user}
// POST /api/login      {username, password}          → {token, user}
// POST /api/logout                                    → {ok}
// GET  /api/me                                        → {user}
// POST /api/account/delete {password}                 → {ok}   (xóa tài khoản và toàn bộ dữ liệu)
// POST /api/sync/push  {changes:[{store,key,data}]}   → {cursor}   (data = null nghĩa là xóa)
// GET  /api/sync/pull?cursor=N                         → {cursor, more, changes:[{store,key,data}]}
// GET  /api/audio/L01.mp3?t=TOKEN                     → MP3 của sách từ R2 (chỉ người đã đăng nhập; hỗ trợ Range để tua)

const STORES = new Set(['card_state', 'review_events', 'lesson_progress', 'study_sessions', 'settings', 'reading_progress', 'word_lookups', 'known_words', 'cards', 'readings']);
const PBKDF2_ITER = 100000; // giới hạn tối đa của Workers
const TOKEN_DAYS = 180;
const MAX_PUSH = 2000;
const MAX_RECORD_BYTES = 32 * 1024;
const PULL_LIMIT = 5000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 10;

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomB64 = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => b64url(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function hashPassword(password, salt, iterations = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256);
  return b64url(bits);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (origin || '*') : allowed[0] || 'null',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

async function readJson(request) {
  const text = await request.text();
  if (text.length > 8 * 1024 * 1024) throw new HttpError(413, 'Dữ liệu gửi lên quá lớn.');
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, 'JSON không hợp lệ.'); }
}

function normUsername(u) {
  const s = String(u || '').trim().toLowerCase();
  if (!/^[a-z0-9._@+-]{3,64}$/.test(s)) throw new HttpError(400, 'Tên đăng nhập 3–64 ký tự: chữ không dấu, số, . _ - @ +');
  return s;
}
function checkPassword(p) {
  if (typeof p !== 'string' || p.length < 8 || p.length > 200) throw new HttpError(400, 'Mật khẩu cần 8–200 ký tự.');
  return p;
}

async function newSession(db, userId, now) {
  const token = randomB64(32);
  await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now, now + TOKEN_DAYS * 86400000).run();
  return token;
}

async function auth(request, db, now, queryToken = null) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/) || (queryToken ? [null, queryToken] : null);
  if (!m) throw new HttpError(401, 'Chưa đăng nhập.');
  const row = await db.prepare('SELECT s.user_id, s.expires_at, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?')
    .bind(await sha256(m[1])).first();
  if (!row || row.expires_at < now) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.');
  return { id: row.user_id, username: row.username, tokenHash: await sha256(m[1]) };
}

async function loginGuard(db, username, now) {
  const row = await db.prepare('SELECT fails, window_start FROM login_attempts WHERE username = ?').bind(username).first();
  if (row && now - row.window_start < LOGIN_WINDOW_MS && row.fails >= LOGIN_MAX_FAILS) {
    throw new HttpError(429, 'Đăng nhập sai quá nhiều lần, thử lại sau 15 phút.');
  }
}
async function loginFail(db, username, now) {
  await db.prepare(`INSERT INTO login_attempts (username, fails, window_start) VALUES (?, 1, ?)
    ON CONFLICT(username) DO UPDATE SET
      fails = CASE WHEN ? - window_start > ? THEN 1 ELSE fails + 1 END,
      window_start = CASE WHEN ? - window_start > ? THEN ? ELSE window_start END`)
    .bind(username, now, now, LOGIN_WINDOW_MS, now, LOGIN_WINDOW_MS, now).run();
}

async function serveAudio(request, bucket, key, headers) {
  const head = await bucket.head(key);
  if (!head) throw new HttpError(404, 'Không có file nghe của bài này.');
  const size = head.size;
  const base = { ...headers, 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400', ETag: head.httpEtag };
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers: { ...base, 'Content-Length': String(size) } });
  const m = (request.headers.get('Range') || '').match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } });
    const obj = await bucket.get(key, { range: { offset: start, length: end - start + 1 } });
    return new Response(obj.body, { status: 206, headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
  }
  const obj = await bucket.get(key);
  return new Response(obj.body, { status: 200, headers: { ...base, 'Content-Length': String(size) } });
}

export async function handle(request, env, { now = Date.now() } = {}) {
  const headers = cors(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const db = env.DB;
  try {
    if (path === '/api/health') return json({ ok: true }, 200, headers);

    if (request.method === 'POST' && path === '/api/register') {
      const body = await readJson(request);
      const username = normUsername(body.username);
      const password = checkPassword(body.password);
      const exists = await db.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
      if (exists) throw new HttpError(409, 'Tên đăng nhập đã có người dùng.');
      const id = crypto.randomUUID();
      const salt = randomB64(16);
      await db.prepare('INSERT INTO users (id, username, pass_hash, salt, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, username, await hashPassword(password, salt), salt, PBKDF2_ITER, now).run();
      await db.prepare('INSERT INTO counters (user_id, seq) VALUES (?, 0)').bind(id).run();
      return json({ token: await newSession(db, id, now), user: { id, username } }, 201, headers);
    }

    if (request.method === 'POST' && path === '/api/login') {
      const body = await readJson(request);
      const username = normUsername(body.username);
      await loginGuard(db, username, now);
      const u = await db.prepare('SELECT id, pass_hash, salt, iterations FROM users WHERE username = ?').bind(username).first();
      const ok = u && safeEqual(await hashPassword(String(body.password || ''), u.salt, u.iterations), u.pass_hash);
      if (!ok) {
        await loginFail(db, username, now);
        throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu.');
      }
      await db.prepare('DELETE FROM login_attempts WHERE username = ?').bind(username).run();
      return json({ token: await newSession(db, u.id, now), user: { id: u.id, username } }, 200, headers);
    }

    // MP3 của sách: <audio> không gửi được header nên token đi qua ?t=.
    const am = path.match(/^\/api\/audio\/(L\d{2}\.mp3)$/);
    if (am && (request.method === 'GET' || request.method === 'HEAD')) {
      await auth(request, db, now, url.searchParams.get('t'));
      if (!env.AUDIO) throw new HttpError(404, 'Chưa cấu hình kho âm thanh.');
      return serveAudio(request, env.AUDIO, am[1], headers);
    }

    const user = await auth(request, db, now);

    if (request.method === 'GET' && path === '/api/me') return json({ user: { id: user.id, username: user.username } }, 200, headers);

    if (request.method === 'POST' && path === '/api/logout') {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.tokenHash).run();
      return json({ ok: true }, 200, headers);
    }

    if (request.method === 'POST' && path === '/api/account/delete') {
      const body = await readJson(request);
      const u = await db.prepare('SELECT pass_hash, salt, iterations FROM users WHERE id = ?').bind(user.id).first();
      if (!u || !safeEqual(await hashPassword(String(body.password || ''), u.salt, u.iterations), u.pass_hash)) throw new HttpError(401, 'Mật khẩu không đúng.');
      await db.batch([
        db.prepare('DELETE FROM records WHERE user_id = ?').bind(user.id),
        db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
        db.prepare('DELETE FROM counters WHERE user_id = ?').bind(user.id),
        db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
      ]);
      return json({ ok: true }, 200, headers);
    }

    if (request.method === 'POST' && path === '/api/sync/push') {
      const body = await readJson(request);
      const changes = Array.isArray(body.changes) ? body.changes : [];
      if (changes.length > MAX_PUSH) throw new HttpError(413, `Tối đa ${MAX_PUSH} bản ghi mỗi lần.`);
      const stmts = [db.prepare('UPDATE counters SET seq = seq + 1 WHERE user_id = ?').bind(user.id)];
      for (const c of changes) {
        if (!STORES.has(c?.store) || typeof c.key !== 'string' || !c.key || c.key.length > 200) throw new HttpError(400, 'Bản ghi không hợp lệ.');
        const data = c.data == null ? null : JSON.stringify(c.data);
        if (data && data.length > MAX_RECORD_BYTES) throw new HttpError(413, 'Bản ghi quá lớn.');
        stmts.push(db.prepare(`INSERT INTO records (user_id, store, rkey, data, deleted, seq)
          VALUES (?, ?, ?, ?, ?, (SELECT seq FROM counters WHERE user_id = ?))
          ON CONFLICT(user_id, store, rkey) DO UPDATE SET data = excluded.data, deleted = excluded.deleted, seq = excluded.seq`)
          .bind(user.id, c.store, c.key, data, data == null ? 1 : 0, user.id));
      }
      await db.batch(stmts);
      const row = await db.prepare('SELECT seq FROM counters WHERE user_id = ?').bind(user.id).first();
      return json({ cursor: row?.seq ?? 0, accepted: changes.length }, 200, headers);
    }

    if (request.method === 'GET' && path === '/api/sync/pull') {
      const cursor = Math.max(0, Number(url.searchParams.get('cursor')) || 0);
      const { results } = await db.prepare('SELECT store, rkey, data, deleted, seq FROM records WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?')
        .bind(user.id, cursor, PULL_LIMIT + 1).all();
      let rows = results || [];
      let more = false;
      if (rows.length > PULL_LIMIT) {
        // Trang bị cắt giữa một lần đẩy: bỏ trọn lần đẩy cuối để lần sau lấy đủ.
        const lastSeq = rows[rows.length - 1].seq;
        rows = rows.filter((r) => r.seq !== lastSeq);
        more = true;
      }
      const head = await db.prepare('SELECT seq FROM counters WHERE user_id = ?').bind(user.id).first();
      const next = more ? (rows.length ? rows[rows.length - 1].seq : cursor) : Math.max(cursor, head?.seq ?? 0);
      return json({
        cursor: next,
        more,
        changes: rows.map((r) => ({ store: r.store, key: r.rkey, data: r.deleted ? null : JSON.parse(r.data) })),
      }, 200, headers);
    }

    throw new HttpError(404, 'Không có đường dẫn này.');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status, headers);
    console.error(e);
    return json({ error: 'Lỗi máy chủ.' }, 500, headers);
  }
}
