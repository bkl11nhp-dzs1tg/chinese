// Service worker: học được khi mất mạng (mục 4.2).
// - Trang (navigation): mạng trước, mất mạng thì dùng bản đã lưu.
// - File build có mã băm và font Google: cache trước. Ảnh/đồ họa/icon: mạng trước, mất mạng dùng cache.
// Đổi VERSION khi cần xóa cache cũ.
const VERSION = 'v4';
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
