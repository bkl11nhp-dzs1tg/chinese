// Nhắc học bằng thông báo của app (không cần Telegram).
// - Khi app đang mở (kể cả chạy nền ở tab khác): đến giờ nhắc mà hôm nay chưa học → hiện thông báo.
// - App đã cài (Chrome/Android): đăng ký đồng bộ định kỳ để service worker tự kiểm tra kể cả khi đã đóng app (nếu trình duyệt cho phép).

import { loadAccount } from './sync.js';

const LAST_KEY = 'chinese-reminder-last';
const b64ToBytes = (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };

async function api(path, body) {
  const a = loadAccount();
  if (!a?.url || !a?.token) throw new Error('Chưa đăng nhập');
  const res = await fetch(`${a.url}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Đăng ký nhận thông báo đẩy từ máy chủ (nhắc đúng giờ kể cả khi đã đóng app). Cần đăng nhập. Trả về true nếu thành công. */
export async function syncPushSubscription({ enabled, time }) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg?.pushManager || !loadAccount()) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!enabled) {
      if (sub) { await api('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
      return true;
    }
    const { key } = await api('/api/push/key');
    if (!key) return false;
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    const [hh, mm] = String(time || '20:00').split(':').map(Number);
    const d = new Date(); d.setHours(hh || 0, mm || 0, 0, 0);
    await api('/api/push/subscribe', { endpoint: sub.endpoint, remind_utc_min: d.getUTCHours() * 60 + d.getUTCMinutes(), tz_offset_min: -d.getTimezoneOffset() });
    return true;
  } catch { return false; }
}

export const notifySupported = () => 'Notification' in globalThis;
export const notifyPermission = () => (notifySupported() ? Notification.permission : 'unsupported');

export async function askPermission() {
  if (!notifySupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

async function show(title, body) {
  const opts = { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: 'study-reminder', renotify: true, data: { url: './#/today' } };
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
  if (reg?.showNotification) return reg.showNotification(title, opts);
  if (notifySupported()) new Notification(title, opts);
}

/** Thông báo thử (nút trong Cài đặt). */
export const testNotification = () => show('Chinese', 'Thông báo nhắc học đã bật 🌸');

const today = () => new Date().toDateString();
const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const toMin = (hhmm) => { const [h, m] = String(hhmm || '20:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/** Bắt đầu kiểm tra mỗi phút. studiedToday(): Promise<boolean>. */
export function startReminder(ctx, studiedToday) {
  const check = async () => {
    const s = ctx.settings;
    if (!s.reminder_enabled || notifyPermission() !== 'granted') return;
    if (minutesNow() < toMin(s.reminder_time)) return;
    let last = null; try { last = localStorage.getItem(LAST_KEY); } catch { /* bỏ qua */ }
    if (last === today()) return;
    if (await studiedToday()) return;
    try { localStorage.setItem(LAST_KEY, today()); } catch { /* bỏ qua */ }
    await show('Đến giờ học tiếng Trung rồi 🔥', 'Dành 15 phút giữ chuỗi ngày học nhé!');
  };
  check();
  setInterval(check, 60_000);
  // Đồng bộ định kỳ (chỉ có trên một số trình duyệt khi đã cài app).
  navigator.serviceWorker?.ready?.then((reg) => reg.periodicSync?.register('study-reminder', { minInterval: 12 * 3600_000 }).catch(() => {}));
}
