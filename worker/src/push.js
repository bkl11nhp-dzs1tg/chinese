// Web Push không kèm nội dung (không cần mã hóa payload): chỉ ký VAPID (ES256), service worker tự hiện thông báo cố định.
// Cron mỗi 15 phút: gửi cho máy nào đến giờ hẹn (theo giờ máy) mà hôm đó chưa có buổi học > 30 giây.

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlStr = (s) => b64url(enc.encode(s));

let keyCache = null;
async function signingKey(env) {
  if (!keyCache) keyCache = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return keyCache;
}

/** Header Authorization VAPID cho một endpoint. */
export async function vapidAuth(env, endpoint, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64urlStr(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64urlStr(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'https://example.com' }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(env), enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64url(sig)}, k=${env.VAPID_PUBLIC}`;
}

/** Gửi một lần đẩy trống. Trả về mã HTTP. */
export async function sendPush(env, endpoint, { fetchImpl = fetch, now } = {}) {
  const res = await fetchImpl(endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(env, endpoint, now), TTL: '3600', Urgency: 'normal', 'Content-Length': '0' } });
  return res.status;
}

/** Ngày theo giờ máy (YYYY-MM-DD) và mốc 0h ngày đó (ms UTC). */
export function localDay(now, tzOffsetMin) {
  const local = new Date(now + tzOffsetMin * 60000);
  const key = local.toISOString().slice(0, 10);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - tzOffsetMin * 60000;
  return { key, start };
}

/** Có trong cửa sổ 15 phút kể từ giờ hẹn không. */
export const dueNow = (now, remindUtcMin, windowMin = 15) => {
  const d = new Date(now);
  const nowMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  return ((nowMin - remindUtcMin + 1440) % 1440) < windowMin;
};

export async function runReminders(env, { now = Date.now(), fetchImpl = fetch } = {}) {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC) return { sent: 0, skipped: 'no-vapid' };
  const db = env.DB;
  const { results } = await db.prepare('SELECT endpoint, user_id, remind_utc_min, tz_offset_min, last_sent_day FROM push_subs').all();
  let sent = 0;
  for (const s of results || []) {
    if (!dueNow(now, s.remind_utc_min)) continue;
    const day = localDay(now, s.tz_offset_min);
    if (s.last_sent_day === day.key) continue;
    // Hôm nay (giờ máy) đã học chưa: có buổi học đồng bộ lên với thời gian học > 30 giây.
    const studied = await db.prepare(`SELECT 1 FROM records WHERE user_id = ? AND store = 'study_sessions' AND deleted = 0
      AND json_extract(data, '$.started_at') >= ? AND json_extract(data, '$.active_ms') > 30000 LIMIT 1`).bind(s.user_id, day.start).first();
    await db.prepare('UPDATE push_subs SET last_sent_day = ? WHERE endpoint = ?').bind(day.key, s.endpoint).run();
    if (studied) continue;
    let status = 0;
    try { status = await sendPush(env, s.endpoint, { fetchImpl, now }); } catch { status = 0; }
    if (status === 404 || status === 410) await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(s.endpoint).run();
    else if (status >= 200 && status < 300) sent++;
  }
  return { sent };
}
