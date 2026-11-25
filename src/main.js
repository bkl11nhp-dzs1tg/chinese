// Điểm vào: mở IndexedDB, dựng khung (đầu trang + điều hướng), khởi động router, đồng bộ, service worker.

import './styles/tokens.css';
import './styles/pixel.css';
import './styles/app.css';
import './styles/v4.css';
import './styles/glass.css';
import './styles/landing.css';
import './styles/polish.css';
import { openDb, createRepo } from './db/repo.js';
import { createContext, applyTheme } from './app.js';
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
import * as practice from './features/practice/practice.js';
import * as account from './features/account/account.js';
import * as landing from './features/landing/landing.js';
import { initInstall, canInstall, promptInstall } from './install.js';
import { initZhKeyboard } from './ui/zh-keyboard.js';
import { setFeedbackEnabled } from './ui/feedback.js';
import { syncContent } from './content.js';
import { loadAccount, syncNow } from './sync.js';
import * as games from './features/games/games-page.js';
import * as stats from './features/stats/stats.js';
import * as settings from './features/settings/settings.js';

const NAV = [
  { name: 'today', label: 'Hôm nay', icon: 'today', match: ['today', 'session'] },
  { name: 'lessons', label: 'Bài học', icon: 'lessons', match: ['lessons', 'lesson', 'exercise', 'test', 'readings', 'read'] },
  { name: 'practice', label: 'Luyện tập', icon: 'target', match: ['practice', 'games', 'game'] },
  { name: 'cards', label: 'Thẻ', icon: 'cards', match: ['cards'] },
  { name: 'stats', label: 'Thống kê', icon: 'stats', match: ['stats'] },
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
  { path: 'practice', render: practice.renderHub },
  { path: 'practice/:skill', render: practice.renderSkill },
  { path: 'games', render: practice.renderHub },
  { path: 'game/:name', render: games.renderGame },
  { path: 'stats', render: stats.render },
  { path: 'settings', render: settings.render },
  { path: 'account', render: account.render },
  { path: 'welcome', render: landing.render },
];

const prefersDark = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
const effectiveTheme = (t) => (t === 'dark' || t === 'light' ? t : prefersDark() ? 'dark' : 'light');

initInstall();

async function boot() {
  const appEl = document.getElementById('app');
  let repo;
  try {
    repo = createRepo(await openDb());
  } catch (e) {
    mount(appEl, h('main', { class: 'main' }, h('h1', {}, 'Không mở được bộ nhớ'), h('p', {}, 'Trình duyệt đang chặn lưu dữ liệu. Hãy tắt chế độ ẩn danh hoặc cho phép trang lưu dữ liệu.')));
    return;
  }
  const ctx = createContext(repo);
  await ctx.refreshSettings();
  setFeedbackEnabled(ctx.settings.sound_enabled);
  // Lần đầu: giữ màn tải trong index.html, chỉ thêm dòng trạng thái.
  if (!(await repo.count('cards'))) { const m = appEl.querySelector('.boot-msg'); if (m) m.textContent = 'Đang chuẩn bị 30 bài học…'; }
  const sync = await syncContent(repo, ctx.settings);
  if (sync.status === 'installed' || sync.status === 'updated') await ctx.refreshSettings();

  // ---------- đầu trang
  const themeBtn = h('button', { class: 'icon-btn', type: 'button' });
  const paintTheme = () => {
    const dark = effectiveTheme(ctx.settings.theme) === 'dark';
    themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
    themeBtn.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    themeBtn.title = themeBtn.getAttribute('aria-label');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#170c12' : '#fbf3e8');
  };
  themeBtn.onclick = async () => {
    const next = effectiveTheme(ctx.settings.theme) === 'dark' ? 'light' : 'dark';
    await repo.saveSettings({ theme: next });
    await ctx.refreshSettings();
    applyTheme(next);
    paintTheme();
  };
  paintTheme();
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', paintTheme);

  const syncBtn = h('a', { class: 'icon-btn sync-btn', href: '#/account' });
  const paintSync = (state = '') => {
    const acct = loadAccount();
    syncBtn.className = `icon-btn sync-btn ${acct ? 'on' : ''} ${state}`;
    syncBtn.replaceChildren(acct ? icon(state === 'error' ? 'cloud' : 'cloudCheck') : icon('user'));
    const label = !acct ? 'Tài khoản: chưa đăng nhập' : state === 'busy' ? 'Đang đồng bộ…' : state === 'error' ? 'Đồng bộ lỗi, bấm để xem' : `Đã đồng bộ (${acct.username})`;
    syncBtn.setAttribute('aria-label', label);
    syncBtn.title = label;
  };
  paintSync();

  // Nút cài app nhỏ nổi ở góc (chỉ hiện khi trình duyệt cho cài; bấm × để ẩn).
  const FAB_KEY = 'chinese-install-fab-hidden';
  const fabHidden = () => { try { return localStorage.getItem(FAB_KEY) === '1'; } catch { return false; } };
  const hideFab = () => { try { localStorage.setItem(FAB_KEY, '1'); } catch { /* bỏ qua */ } paintInstall(); };
  const installBtn = h('div', { class: 'install-fab hidden', role: 'group', 'aria-label': 'Cài app' },
    h('button', { class: 'if-main', type: 'button', onclick: () => promptInstall().then(paintInstall) },
      h('span', { class: 'if-logo' }, icon('logo')), h('span', { class: 'if-text' }, h('b', {}, 'Cài app'), h('small', {}, 'Mở nhanh, học offline')), icon('download')),
    h('button', { class: 'if-close', type: 'button', 'aria-label': 'Ẩn', onclick: hideFab }, icon('close')));
  const paintInstall = () => installBtn.classList.toggle('hidden', !canInstall() || fabHidden() || document.body.classList.contains('landing-mode'));
  window.addEventListener('install:changed', paintInstall);
  const settingsBtn = h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Cài đặt', title: 'Cài đặt', dataset: { name: 'settings' } }, icon('settings'));
  const mkTabs = () => NAV.map((n) => h('a', { class: 'tab', href: `#/${n.name}`, dataset: { name: n.name } }, icon(n.icon), h('span', {}, n.label)));
  const topTabs = mkTabs();
  const bottomTabs = mkTabs();
  const offline = h('span', { class: 'offline-badge', 'aria-live': 'polite' });
  const updateOnline = () => { offline.textContent = navigator.onLine ? '' : 'Offline'; };
  window.addEventListener('online', () => { updateOnline(); autoSync(); });
  window.addEventListener('offline', updateOnline);
  updateOnline();

  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  document.documentElement.style.setProperty('--wave', `url(${new URL('./art/deco/wave.webp', location.href).href})`);
  document.body.append(h('div', { class: 'page-wave', 'aria-hidden': 'true' }));
  mount(appEl, h('div', { class: 'shell' },
    h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#/welcome', 'aria-label': 'Chinese – trang giới thiệu' }, icon('logo'), h('span', {}, 'Chinese')),
      h('nav', { class: 'top-tabs', 'aria-label': 'Điều hướng chính' }, topTabs),
      h('div', { class: 'top-actions' }, offline, themeBtn, syncBtn, settingsBtn)),
    main,
    h('nav', { class: 'nav', 'aria-label': 'Điều hướng chính (điện thoại)' }, bottomTabs),
    installBtn));

  const router = createRouter(routes, {
    onChange: (m) => {
      for (const a of [...topTabs, ...bottomTabs]) {
        const item = NAV.find((n) => n.name === a.dataset.name);
        if (item.match.includes(m.name)) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      }
      document.body.classList.toggle('landing-mode', m.name === 'welcome' || (m.name === 'account' && !loadAccount()));
      paintInstall();
      if (m.name === 'settings') settingsBtn.setAttribute('aria-current', 'page'); else settingsBtn.removeAttribute('aria-current');
    },
  });

  // ---------- tự đồng bộ (khi đã đăng nhập)
  let lastSync = 0;
  async function autoSync({ force = false } = {}) {
    if (!loadAccount() || !navigator.onLine) return;
    if (!force && Date.now() - lastSync < 55_000) return;
    lastSync = Date.now();
    paintSync('busy');
    try {
      const r = await syncNow(repo);
      paintSync();
      // Có dữ liệu mới từ máy khác: vẽ lại trang (trừ khi đang trong màn học toàn màn hình).
      if (r.changedLocal && !document.body.classList.contains('focus-mode')) { await ctx.refreshSettings(); router.reload(main, ctx); }
    } catch (e) {
      paintSync('error');
      if (e.status === 401) syncBtn.title = 'Phiên đăng nhập hết hạn, hãy đăng nhập lại';
    }
  }
  window.addEventListener('sync:changed', () => { paintSync(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autoSync({ force: true }); else autoSync(); });
  // Tự đồng bộ mỗi phút khi đang mở app (không cần bấm).
  setInterval(() => { if (document.visibilityState === 'visible') autoSync(); }, 60_000);
  window.addEventListener('hashchange', () => { if (/^#\/(today|stats|lessons)/.test(location.hash)) autoSync(); });

  if (!ctx.settings.onboarded && !location.hash) location.replace('#/welcome');
  initZhKeyboard(ctx);
  await router.start(main, ctx);
  autoSync({ force: true });
}

boot();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
