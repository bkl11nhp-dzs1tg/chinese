// #/welcome: trang giới thiệu (lần đầu mở app, hoặc bấm logo).
// Hai cột: bên trái chữ 汉语 viết dọc + thẻ từ lớn bấm lật thử; bên phải thông điệp ngắn và nút học.

import { h, mount, toast } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { cue } from '../../ui/feedback.js';
import { authCard } from '../account/account.js';
import { loadAccount } from '../../sync.js';
import { canInstall, promptInstall, isStandalone } from '../../install.js';

const DEMO = [
  { hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'xin chào' },
  { hanzi: '谢谢', pinyin: 'xièxie', meaning: 'cảm ơn' },
  { hanzi: '学习', pinyin: 'xuéxí', meaning: 'học tập' },
];

export async function render(root, ctx, { query = {} } = {}) {
  const data = await ctx.loadAll();
  const learned = data.states.filter((s) => s.last_reviewed_at != null).length;
  const started = learned > 0;
  const start = async () => {
    await ctx.repo.saveSettings({ onboarded: true });
    await ctx.refreshSettings();
    ctx.navigate('today');
  };

  // ---------- thẻ thử
  let di = 0;
  let flipped = false;
  const face = h('div', { class: 'demo-face' });
  const hint = h('span', { class: 'demo-hint' });
  const dots = h('span', { class: 'demo-dots', 'aria-hidden': 'true' }, DEMO.map(() => h('i')));
  const card = h('button', { class: 'demo-card', type: 'button', 'aria-label': 'Thẻ thử: bấm để lật' }, face, dots, hint);
  const paintCard = () => {
    const d = DEMO[di];
    card.classList.toggle('flipped', flipped);
    face.replaceChildren(
      h('span', { class: 'han demo-han', lang: 'zh-CN' }, d.hanzi),
      flipped ? h('span', { class: 'demo-py' }, d.pinyin) : null,
      flipped ? h('span', { class: 'demo-vi' }, d.meaning) : null);
    [...dots.children].forEach((x, k) => x.classList.toggle('on', k === di));
    hint.replaceChildren(icon(flipped ? 'chevron' : 'repeat'));
  };
  card.onclick = () => {
    card.classList.remove('turn');
    void card.offsetWidth;
    card.classList.add('turn');
    if (!flipped) { flipped = true; speak(DEMO[di].hanzi); cue('tap'); } else { flipped = false; di = (di + 1) % DEMO.length; }
    paintCard();
  };
  paintCard();

  // ---------- cài app (một dòng nhỏ, chỉ khi cài được)
  const installArea = h('div', { class: 'ld-install' });
  function paintInstall() {
    if (isStandalone()) installArea.replaceChildren();
    else if (canInstall()) installArea.replaceChildren(h('button', { class: 'ld-install-btn', type: 'button', onclick: async () => { if ((await promptInstall()) === 'accepted') toast('Đã cài app.'); paintInstall(); } }, h('span', { class: 'if-logo' }, icon('logo')), h('span', { class: 'if-text' }, h('b', {}, 'Cài app lên máy'), h('small', {}, 'Mở nhanh, học offline')), icon('download')));
    else installArea.replaceChildren();
  }
  window.addEventListener('install:changed', paintInstall);
  paintInstall();

  const deco = (name, cls) => h('img', { class: ['deco', cls], src: `./art/deco/${name}.webp`, alt: '', 'aria-hidden': 'true', decoding: 'async' });
  mount(root, h('div', { class: 'ld' },
    deco('branch', 'ld-branch'),
    deco('petals', 'ld-petal'), deco('petals', 'ld-petal p2'), deco('petals', 'ld-petal p3'),
    // 1. Chữ 汉语 + lời nhắn + nút học
    h('section', { class: 'ld-hero' },
      h('div', { class: 'ld-vert', 'aria-hidden': 'true' }, h('span', { class: 'han' }, '汉语')),
      h('div', { class: 'ld-copy' },
        h('h1', {}, 'Tự học tiếng Trung', h('br'), h('em', {}, 'mỗi ngày.')),
        h('p', { class: 'ld-lead' }, started ? `Bạn đã học ${learned} từ. Thêm 15 phút hôm nay nhé!` : 'Tiếp thu mỗi bài học chỉ từ 15 phút.'),
        h('div', { class: 'ld-cta' },
          h('button', { class: 'btn primary big ld-go', type: 'button', onclick: start }, started ? 'Học tiếp' : 'Bắt đầu học', icon('chevron')),
          installArea))),
    // 2. Thẻ lật thử, đứng riêng
    h('section', { class: 'ld-try ld-scene' },
      deco('mountains', 'deco-mtn'), deco('pavilion', 'deco-pagoda'),
      card),
    // Tài khoản: đăng nhập để đồng bộ nhiều thiết bị (không bắt buộc).
    (() => {
      const acct = loadAccount();
      if (acct) return h('section', { class: 'ld-acct signed' }, h('span', { class: 'avatar' }, (acct.username || '?')[0].toUpperCase()), h('div', { class: 'grow' }, h('b', {}, acct.username), h('small', {}, 'Đang đồng bộ giữa các thiết bị')), h('a', { class: 'btn tinted', href: '#/account' }, 'Tài khoản'));
      return h('section', { class: 'ld-acct' }, h('h2', { class: 'ld-acct-title' }, 'Học trên nhiều thiết bị'), authCard(ctx, { register: query.auth === 'register' }));
    })(),
  ));

  if (query.auth) requestAnimationFrame(() => root.querySelector('#auth')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  return () => { window.removeEventListener('install:changed', paintInstall); };
}
