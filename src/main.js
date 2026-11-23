// Điểm vào: mở IndexedDB, dựng khung (thanh điều hướng), khởi động router, đăng ký service worker.

import './styles/tokens.css';
import './styles/pixel.css';
import './styles/app.css';
import { openDb, createRepo } from './db/repo.js';
import { createContext } from './app.js';
import { createRouter } from './router.js';
import { h, mount } from './ui/dom.js';
import { icon } from './ui/icons.js';
import * as today from './features/today/today.js';
import * as session from './features/session/session.js';
import * as cardsPage from './features/flashcards/cards-page.js';
import * as lessons from './features/lessons/lessons.js';
import * as exercisePage from './features/exercises/exercise-page.js';
import * as testPage from './features/exercises/test-page.js';
import * as reading from './features/reading/reading.js';
import { setFeedbackEnabled } from './ui/feedback.js';
import { syncContent } from './content.js';
import * as games from './features/games/games-page.js';
import * as stats from './features/stats/stats.js';
import * as settings from './features/settings/settings.js';

const NAV = [
  { name: 'today', label: 'Hôm nay', icon: 'today', match: ['today', 'session'] },
  { name: 'cards', label: 'Thẻ', icon: 'cards', match: ['cards', 'games', 'game'] },
  { name: 'lessons', label: 'Bài học', icon: 'lessons', match: ['lessons', 'lesson', 'exercise', 'test', 'readings', 'read'] },
  { name: 'stats', label: 'Thống kê', icon: 'stats', match: ['stats'] },
  { name: 'settings', label: 'Cài đặt', icon: 'settings', match: ['settings'] },
];

const routes = [
  { path: 'today', render: today.render },
  { path: 'session', render: session.render },
  { path: 'cards', render: cardsPage.render },
  { path: 'lessons', render: lessons.renderList },
  { path: 'lesson/:id', render: lessons.renderLesson },
  { path: 'exercise/:id', render: exercisePage.render },
  { path: 'test/:id', render: testPage.render },
  { path: 'readings', render: reading.renderList },
  { path: 'read/:id', render: reading.renderReader },
  { path: 'games', render: games.renderList },
  { path: 'game/:name', render: games.renderGame },
  { path: 'stats', render: stats.render },
  { path: 'settings', render: settings.render },
];

async function boot() {
  const appEl = document.getElementById('app');
  let repo;
  try {
    repo = createRepo(await openDb());
  } catch (e) {
    mount(appEl, h('main', { class: 'main' }, h('h1', {}, 'Không mở được bộ nhớ'), h('p', {}, `Trình duyệt chặn IndexedDB (${e.message}). Thử tắt chế độ ẩn danh hoặc cho phép lưu dữ liệu trang.`)));
    return;
  }
  const ctx = createContext(repo);
  await ctx.refreshSettings();
  setFeedbackEnabled(ctx.settings.sound_enabled);
  if (!(await repo.count('cards'))) mount(appEl, h('div', { class: 'splash' }, icon('logo'), h('p', {}, 'Đang chuẩn bị nội dung học…')));
  const sync = await syncContent(repo, ctx.settings);
  if (sync.status === 'installed' || sync.status === 'updated') await ctx.refreshSettings();

  const links = NAV.map((n) => h('a', { class: 'tab', href: `#/${n.name}`, dataset: { name: n.name } }, icon(n.icon), h('span', {}, n.label)));
  const offline = h('div', { class: 'offline-badge', 'aria-live': 'polite' });
  const updateOnline = () => { offline.textContent = navigator.onLine ? '' : 'Đang offline: vẫn học bình thường.'; };
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  mount(appEl, h('div', { class: 'shell' },
    h('nav', { class: 'nav', 'aria-label': 'Điều hướng chính' },
      h('div', { class: 'brand' }, icon('logo'), 'Tự học tiếng Trung'), links, offline),
    main));

  const router = createRouter(routes, {
    onChange: (m) => links.forEach((a) => {
      const item = NAV.find((n) => n.name === a.dataset.name);
      if (item.match.includes(m.name)) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }),
  });
  await router.start(main, ctx);
}

boot();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
