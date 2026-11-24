// #/welcome: trang giới thiệu + đăng nhập (lần đầu mở app, bấm logo, hoặc vào Tài khoản khi chưa đăng nhập).
// Gọn trong một màn: chữ 汉语 + lời nhắn + nút học, thẻ lật thử nhỏ, khối đăng nhập (điện thoại: gập lại, bấm mở).

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

  // ---------- thẻ lật thử
  let di = 0;
  let flipped = false;
  const face = h('div', { class: 'demo-face' });
  const dots = h('span', { class: 'demo-dots', 'aria-hidden': 'true' }, DEMO.map(() => h('i')));
  const hint = h('span', { class: 'demo-hint' });
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

  // ---------- cài app (chỉ khi trình duyệt cho cài)
  const installArea = h('div', { class: 'lp-install' });
  function paintInstall() {
    if (!isStandalone() && canInstall()) installArea.replaceChildren(h('button', { class: 'ld-install-btn', type: 'button', onclick: async () => { if ((await promptInstall()) === 'accepted') toast('Đã cài app'); paintInstall(); } }, h('span', { class: 'if-logo' }, icon('logo')), h('span', { class: 'if-text' }, h('b', {}, 'Cài app lên máy'), h('small', {}, 'Mở nhanh, học offline')), icon('download')));
    else installArea.replaceChildren();
  }
  window.addEventListener('install:changed', paintInstall);
  paintInstall();

  // ---------- tài khoản
  const acct = loadAccount();
  const wide = globalThis.matchMedia?.('(min-width: 900px)').matches;
  const account = acct
    ? h('section', { class: 'lp-acct signed' },
        h('span', { class: 'avatar' }, (acct.username || '?')[0].toUpperCase()),
        h('div', { class: 'grow' }, h('b', {}, acct.username), h('small', {}, 'Đang đồng bộ giữa các thiết bị')),
        h('a', { class: 'btn tinted', href: '#/account' }, 'Tài khoản'))
    : h('details', { class: 'lp-acct', open: !!query.auth || wide },
        h('summary', {},
          h('span', { class: 'lp-acct-ic' }, icon('cloudCheck')),
          h('span', { class: 'grow' }, h('b', {}, 'Đăng nhập / Tạo tài khoản'), h('small', {}, 'Đồng bộ tiến độ trên nhiều thiết bị')),
          h('span', { class: 'lp-acct-chev' }, icon('chevron'))),
        authCard(ctx, { register: query.auth === 'register' }));

  const deco = (name, cls) => h('img', { class: ['deco', cls], src: `./art/deco/${name}.webp`, alt: '', 'aria-hidden': 'true', decoding: 'async' });
  mount(root, h('div', { class: 'lp' },
    // Đồ họa dính sát góc màn hình (ảnh có mép cắt vuông nên đặt vào góc).
    h('div', { class: 'lp-bg', 'aria-hidden': 'true' }, deco('branch', 'lp-branch'), deco('mountains', 'lp-mtn'), deco('pavilion', 'lp-pavilion')),
    h('div', { class: 'lp-main' },
      h('section', { class: 'lp-hero' },
        h('div', { class: 'lp-vert', 'aria-hidden': 'true' }, h('span', { class: 'han' }, '汉语')),
        h('div', { class: 'lp-copy' },
          h('h1', {}, 'Tự học tiếng Trung', h('br'), h('em', {}, 'mỗi ngày.')),
          h('p', { class: 'lp-lead' }, started ? `Bạn đã học ${learned} từ. Thêm 15 phút hôm nay nhé!` : 'Tiếp thu mỗi bài học chỉ từ 15 phút.'))),
      h('div', { class: 'lp-cta' },
        h('button', { class: 'btn primary big lp-go', type: 'button', onclick: start }, started ? 'Học tiếp' : 'Bắt đầu học', icon('chevron')),
        installArea),
      h('section', { class: 'lp-scene' }, card)),
    h('div', { class: 'lp-side' }, account)));

  if (query.auth) requestAnimationFrame(() => root.querySelector('.lp-acct')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  return () => { window.removeEventListener('install:changed', paintInstall); };
}
