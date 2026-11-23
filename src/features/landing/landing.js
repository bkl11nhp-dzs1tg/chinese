// #/welcome: trang giới thiệu + cài app (lần đầu mở app hiện trang này).

import { h, mount, toast } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { canInstall, promptInstall, isStandalone, isIOS } from '../../install.js';

const FEATURES = [
  ['cards', 'orange', 'Từ vựng theo lịch ôn', '758 từ của Hán ngữ 1–2, ôn đúng lúc sắp quên.'],
  ['lessons', 'green', 'Bài khóa có tra từ', 'Bấm từng chữ để xem bính âm, nghĩa; nghe từng câu.'],
  ['target', 'blue', 'Luyện theo kỹ năng', 'Nghe, nói, đọc hiểu, thanh điệu, gõ bính âm, ghép câu.'],
  ['cloud', 'purple', 'Học mọi thiết bị', 'Học offline; đăng nhập để tiến độ theo bạn sang máy khác.'],
];

export async function render(root, ctx) {
  document.body.classList.add('landing-mode');
  const data = await ctx.loadAll();
  const words = data.cards.length;
  const lines = data.lessons.reduce((n, l) => n + (l.texts || []).reduce((m, t) => m + t.lines.length, 0), 0);
  const start = async () => {
    await ctx.repo.saveSettings({ onboarded: true });
    await ctx.refreshSettings();
    ctx.navigate('today');
  };
  const installBtn = h('button', { class: 'btn big', type: 'button', onclick: async () => {
    const r = await promptInstall();
    if (r === 'accepted') toast('Đã cài app.');
    paint();
  } }, icon('download'), 'Cài app');
  const installBox = h('section', { class: 'ld-install glass' });
  function paint() {
    installBtn.classList.toggle('hidden', !canInstall());
    if (isStandalone()) installBox.replaceChildren(h('div', {}, h('h2', {}, 'Bạn đang dùng bản đã cài'), h('p', { class: 'muted', style: { margin: 0 } }, 'Mở từ màn hình chính như một app bình thường.')));
    else if (canInstall()) installBox.replaceChildren(h('div', {}, h('h2', {}, 'Cài lên màn hình chính'), h('p', { class: 'muted', style: { margin: 0 } }, 'Mở nhanh như app, học được cả khi không có mạng.')), h('button', { class: 'btn primary big', type: 'button', onclick: () => installBtn.click() }, icon('download'), 'Cài app'));
    else if (isIOS()) installBox.replaceChildren(h('div', {}, h('h2', {}, 'Cài lên iPhone / iPad'), h('ol', { class: 'ld-steps' }, h('li', {}, 'Mở trang này bằng Safari'), h('li', {}, 'Bấm nút Chia sẻ'), h('li', {}, 'Chọn “Thêm vào MH chính”'))));
    else installBox.replaceChildren(h('div', {}, h('h2', {}, 'Cài lên máy'), h('p', { class: 'muted', style: { margin: 0 } }, 'Trên Chrome/Edge: bấm biểu tượng cài đặt ở thanh địa chỉ, hoặc menu ⋮ → “Cài đặt ứng dụng”.')));
  }
  window.addEventListener('install:changed', paint);
  paint();

  mount(root, h('div', { class: 'landing' },
    h('section', { class: 'ld-hero' },
      h('div', {},
        h('span', { class: 'ld-badge glass' }, icon('sparkle'), 'Miễn phí · không quảng cáo · học offline'),
        h('h1', {}, 'Học tiếng Trung theo giáo trình ', h('span', { class: 'han' }, '汉语'), '.'),
        h('p', { class: 'ld-lead' }, 'Từ vựng, bài khóa, ngữ pháp và bài kiểm tra cho 30 bài Hán ngữ quyển 1–2, mỗi ngày 15–20 phút.'),
        h('div', { class: 'ld-cta' },
          h('button', { class: 'btn primary big', type: 'button', onclick: start }, icon('play'), data.states.length ? 'Học tiếp' : 'Bắt đầu học'),
          installBtn),
        h('div', { class: 'ld-stats' },
          h('div', {}, h('b', {}, String(data.lessons.length)), h('span', {}, 'bài học')),
          h('div', {}, h('b', {}, String(words)), h('span', {}, 'từ vựng')),
          h('div', {}, h('b', {}, String(lines)), h('span', {}, 'câu bài khóa')))),
      h('div', { class: 'ld-collage', 'aria-hidden': 'true' },
        ['L01', 'L07', 'L13', 'L20', 'L23', 'L28'].map((id) => h('img', { src: `./lessons/${id}.webp`, alt: '', loading: 'lazy', onerror: (e) => e.target.remove() })))),
    h('section', { class: 'ld-features' }, FEATURES.map(([ic, tone, title, desc]) => h('div', { class: ['ld-feat', 'glass', `tone-${tone}`] },
      h('span', { class: 'sk-ic' }, icon(ic)), h('h3', {}, title), h('p', {}, desc)))),
    installBox));
  return () => { document.body.classList.remove('landing-mode'); window.removeEventListener('install:changed', paint); };
}
