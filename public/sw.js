// Service worker: học được khi mất mạng (mục 4.2).
// - Trang (navigation): mạng trước, mất mạng thì dùng bản đã lưu.
// - File build có mã băm và font Google: cache trước. Ảnh/đồ họa/icon: mạng trước, mất mạng dùng cache.
// Đổi VERSION khi cần xóa cache cũ.
const VERSION = 'v6';
const CACHE = `chinese-study-${VERSION}`;
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('chinese-study-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  // Gói nội dung: mạng trước (để nhận bản mới), mất mạng thì dùng bản đã lưu.
  if (sameOrigin && url.pathname.endsWith('/content/pack.json')) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req)),
    );
    return;
  }
  if (sameOrigin && url.pathname.includes('/content/audio/')) return; // MP3 lớn: không cache

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // File không có mã băm trong tên (ảnh bài học, đồ họa, icon…): mạng trước để luôn nhận bản mới,
  // mất mạng mới dùng bản đã lưu. File build có mã băm (/assets/…) không đổi nội dung → cache trước.
  if (sameOrigin && !url.pathname.includes('/assets/')) {
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req)),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});

// ---------------- Thông báo nhắc học
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './#/today', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => c.url.startsWith(self.registration.scope));
    if (w) { w.navigate?.(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});

// Đồng bộ định kỳ (Chrome khi đã cài app): chỉ nhắc nếu không có cửa sổ app nào đang mở.
// Không đọc được dữ liệu học ở đây một cách tin cậy nên chỉ nhắc chung, tối đa 1 lần/ngày.
self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'study-reminder') return;
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window' });
    if (open.length) return;
    const c = await caches.open('chinese-reminder');
    const day = new Date().toDateString();
    const last = await c.match('last');
    if (last && (await last.text()) === day) return;
    if (new Date().getHours() < 18) return;
    await c.put('last', new Response(day));
    await self.registration.showNotification('Đến giờ học tiếng Trung rồi 🔥', { body: 'Dành 15 phút giữ chuỗi ngày học nhé!', icon: './icons/icon-192.png', tag: 'study-reminder', data: { url: './#/today' } });
  })());
});

// Thông báo đẩy từ máy chủ (không kèm nội dung): hiện lời nhắc cố định, trừ khi đang mở app.
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window' });
    if (wins.some((w) => w.focused)) return;
    await self.registration.showNotification('Đến giờ học tiếng Trung rồi 🔥', { body: 'Dành 15 phút giữ chuỗi ngày học nhé!', icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: 'study-reminder', data: { url: './#/today' } });
  })());
});
