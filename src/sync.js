// Tài khoản và đồng bộ nhiều thiết bị. Dữ liệu vẫn nằm trong IndexedDB (học offline bình thường);
// khi có mạng và đã đăng nhập: kéo thay đổi từ server → gộp theo luật (core/syncmerge) → đẩy thay đổi của máy này.

import { SYNC_STORES, shouldSync, recordKey, mergeRecord, sameRecord, hashRecord } from './core/syncmerge.js';

const ACCOUNT_KEY = 'chinese-study-account';
const PUSH_CHUNK = 1000;
export const DEFAULT_SYNC_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SYNC_URL) || '';

// ---------------------------------------------------------------- tài khoản (lưu riêng từng máy, không vào bản sao lưu)
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
export function loadAccount() {
  try { return JSON.parse(storage()?.getItem(ACCOUNT_KEY) || 'null'); } catch { return null; }
}
function saveAccount(a) {
  try { a ? storage()?.setItem(ACCOUNT_KEY, JSON.stringify(a)) : storage()?.removeItem(ACCOUNT_KEY); } catch { /* bỏ qua */ }
}

const cleanUrl = (u) => String(u || '').trim().replace(/\/+$/, '');

async function api(url, path, { method = 'GET', body, token, fetchImpl = fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(`${cleanUrl(url)}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error('Không kết nối được máy chủ đồng bộ.');
    e.offline = true;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || `Lỗi máy chủ (${res.status}).`);
    e.status = res.status;
    throw e;
  }
  return data;
}

export async function signIn({ url, username, password, register = false, fetchImpl }) {
  if (!cleanUrl(url)) throw new Error('Chưa có địa chỉ máy chủ đồng bộ.');
  const r = await api(url, register ? '/api/register' : '/api/login', { method: 'POST', body: { username, password }, fetchImpl });
  const acct = { url: cleanUrl(url), token: r.token, username: r.user.username, cursor: 0, last_sync_at: null };
  saveAccount(acct);
  return acct;
}

/** Đăng xuất: xóa phiên ở server (nếu được) và quên siêu dữ liệu đồng bộ của máy này. Dữ liệu học vẫn giữ trên máy. */
export async function signOut(repo, { fetchImpl } = {}) {
  const a = loadAccount();
  if (a) await api(a.url, '/api/logout', { method: 'POST', token: a.token, fetchImpl }).catch(() => {});
  saveAccount(null);
  if (repo) for (const s of Object.keys(SYNC_STORES)) await repo.delete('sync_meta', s).catch(() => {});
}

export async function deleteAccount(repo, password, { fetchImpl } = {}) {
  const a = loadAccount();
  if (!a) throw new Error('Chưa đăng nhập.');
  await api(a.url, '/api/account/delete', { method: 'POST', body: { password }, token: a.token, fetchImpl });
  await signOut(repo, { fetchImpl });
}

/** Khi xóa toàn bộ dữ liệu trên máy: lần đồng bộ sau tải lại mọi thứ từ server. */
export async function resetSyncState(repo) {
  const a = loadAccount();
  if (a) saveAccount({ ...a, cursor: 0 });
  if (repo) for (const s of Object.keys(SYNC_STORES)) await repo.delete('sync_meta', s).catch(() => {});
}

// ---------------------------------------------------------------- đồng bộ
let running = null;

/** Đồng bộ một lượt. Trả về { status, pulled, pushed, changedLocal }. Gọi chồng nhau thì dùng chung một lượt. */
export function syncNow(repo, opts = {}) {
  if (!running) running = runSync(repo, opts).finally(() => { running = null; });
  return running;
}

async function runSync(repo, { fetchImpl, now = Date.now } = {}) {
  const acct = loadAccount();
  if (!acct?.token) return { status: 'signed-out' };
  const meta = new Map();
  for (const s of Object.keys(SYNC_STORES)) meta.set(s, (await repo.get('sync_meta', s))?.hashes || {});
  let pulled = 0;
  let changedLocal = 0;

  // 1. Kéo về và gộp
  let cursor = acct.cursor || 0;
  for (let page = 0; page < 200; page++) {
    const r = await api(acct.url, `/api/sync/pull?cursor=${cursor}`, { token: acct.token, fetchImpl });
    for (const c of r.changes) {
      if (!SYNC_STORES[c.store]) continue;
      const hashes = meta.get(c.store);
      const local = await repo.get(c.store, c.key);
      if (c.data == null) {
        if (local) { await repo.delete(c.store, c.key); changedLocal++; }
        delete hashes[c.key];
      } else {
        const merged = mergeRecord(c.store, local, c.data);
        if (!local || !sameRecord(merged, local)) { await repo.put(c.store, merged); changedLocal++; }
        hashes[c.key] = hashRecord(c.data);
      }
      pulled++;
    }
    cursor = r.cursor;
    if (!r.more) break;
  }

  // 2. Đẩy thay đổi của máy này
  const changes = [];
  for (const store of Object.keys(SYNC_STORES)) {
    const hashes = meta.get(store);
    const seen = new Set();
    for (const rec of await repo.getAll(store)) {
      if (!shouldSync(store, rec)) continue;
      const key = recordKey(store, rec);
      seen.add(key);
      const h = hashRecord(rec);
      if (hashes[key] !== h) changes.push({ store, key, data: rec, h });
    }
    for (const key of Object.keys(hashes)) if (!seen.has(key)) changes.push({ store, key, data: null, h: null });
  }
  for (let i = 0; i < changes.length; i += PUSH_CHUNK) {
    const chunk = changes.slice(i, i + PUSH_CHUNK);
    await api(acct.url, '/api/sync/push', { method: 'POST', token: acct.token, body: { changes: chunk.map(({ store, key, data }) => ({ store, key, data })) }, fetchImpl });
    for (const c of chunk) {
      const hashes = meta.get(c.store);
      if (c.h) hashes[c.key] = c.h; else delete hashes[c.key];
    }
  }

  for (const [store, hashes] of meta) await repo.put('sync_meta', { store, hashes });
  const done = { ...loadAccount(), cursor, last_sync_at: now() };
  saveAccount(done);
  return { status: 'ok', pulled, pushed: changes.length, changedLocal, at: done.last_sync_at };
}
