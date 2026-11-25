import { describe, it, expect } from 'vitest';
import { createD1 } from '../worker/d1-node.js';
import { handle } from '../worker/src/handler.js';
import { runReminders, dueNow, localDay } from '../worker/src/push.js';

async function setup() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const env = {
    DB: createD1(':memory:', ['worker/migrations/0001_init.sql', 'worker/migrations/0002_push.sql']), ALLOWED_ORIGINS: '*',
    VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey)),
    VAPID_PUBLIC: btoa(String.fromCharCode(...pub)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  };
  const call = (path, body, token) => handle(new Request(`http://x${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }), env).then((r) => r.json());
  const { token } = await call('/api/register', { username: 'push1', password: 'matkhau123' });
  return { env, call, token };
}

describe('nhắc học bằng thông báo đẩy', () => {
  it('giờ và ngày theo múi giờ máy', () => {
    const now = Date.UTC(2026, 10, 25, 13, 5); // 20:05 giờ VN
    expect(dueNow(now, 13 * 60)).toBe(true);
    expect(dueNow(now, 12 * 60)).toBe(false);
    expect(localDay(now, 420).key).toBe('2026-11-25');
    expect(localDay(Date.UTC(2026, 10, 25, 18), 420).key).toBe('2026-11-26');
  });
  it('gửi khi đến giờ mà chưa học; không gửi lại trong ngày; không gửi nếu đã học', async () => {
    const { env, call, token } = await setup();
    expect((await call('/api/push/key')).key).toBe(env.VAPID_PUBLIC);
    await call('/api/push/subscribe', { endpoint: 'https://push.example.com/abc', remind_utc_min: 13 * 60, tz_offset_min: 420 }, token);
    const sent = [];
    const fetchImpl = async (url, init) => { sent.push({ url, auth: init.headers.Authorization }); return new Response(null, { status: 201 }); };
    const now = Date.UTC(2026, 10, 25, 13, 5);
    expect((await runReminders(env, { now, fetchImpl })).sent).toBe(1);
    expect(sent[0].auth).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    expect((await runReminders(env, { now: now + 5 * 60000, fetchImpl })).sent).toBe(0);
    // Ngày hôm sau đã học → không nhắc
    const next = now + 86400000;
    await call('/api/sync/push', { changes: [{ store: 'study_sessions', key: 's1', data: { id: 's1', started_at: next - 3600000, active_ms: 600000 } }] }, token);
    expect((await runReminders(env, { now: next, fetchImpl })).sent).toBe(0);
  });
  it('endpoint hết hạn (410) bị xóa', async () => {
    const { env, call, token } = await setup();
    await call('/api/push/subscribe', { endpoint: 'https://push.example.com/old', remind_utc_min: 13 * 60, tz_offset_min: 420 }, token);
    await runReminders(env, { now: Date.UTC(2026, 10, 25, 13, 1), fetchImpl: async () => new Response(null, { status: 410 }) });
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs').first();
    expect(left.n).toBe(0);
  });
});
