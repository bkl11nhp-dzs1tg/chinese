// #/welcome: trang giới thiệu + cài app (lần đầu mở app hiện trang này).
// Bố cục gọn: chữ 汉语 viết dọc, một câu giới thiệu, nút vào học, thẻ từ bấm lật thử.

import { h, mount, toast } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { canInstall, promptInstall, isStandalone, isIOS } from '../../install.js';

const DEMO = [
  { hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'xin chào' },
  { hanzi: '谢谢', pinyin: 'xièxie', meaning: 'cảm ơn' },
  { hanzi: '学习', pinyin: 'xuéxí', meaning: 'học tập' },
];

export async function render(root, ctx) {
  const data = await ctx.loadAll();
  const started = data.states.length > 0;
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
  const card = h('button', { class: 'demo-card', type: 'button', 'aria-label': 'Thẻ thử: bấm để lật' }, face, hint);
  const paintCard = () => {
    const d = DEMO[di];
    card.classList.toggle('flipped', flipped);
    face.replaceChildren(
      h('span', { class: 'han demo-han', lang: 'zh-CN' }, d.hanzi),
      flipped ? h('span', { class: 'demo-py' }, d.pinyin) : null,
      flipped ? h('span', { class: 'demo-vi' }, d.meaning) : null);
    hint.textContent = flipped ? 'Bấm để sang thẻ khác' : 'Bấm để lật';
  };
  card.onclick = () => {
    if (!flipped) { flipped = true; speak(DEMO[di].hanzi); } else { flipped = false; di = (di + 1) % DEMO.length; }
    paintCard();
  };
  paintCard();

  // ---------- cài app
  const installArea = h('span', { class: 'ld-install-inline' });
  function paintInstall() {
    if (isStandalone()) installArea.replaceChildren();
    else if (canInstall()) installArea.replaceChildren(h('button', { class: 'ld-link', type: 'button', onclick: async () => { if ((await promptInstall()) === 'accepted') toast('Đã cài app.'); paintInstall(); } }, icon('download'), 'Cài app'));
    else if (isIOS()) installArea.replaceChildren(h('span', { class: 'ld-note' }, 'Cài app: Chia sẻ → Thêm vào MH chính'));
    else installArea.replaceChildren();
  }
  window.addEventListener('install:changed', paintInstall);
  paintInstall();

  mount(root, h('div', { class: 'ld' },
    // 1. Màn đầu
    h('section', { class: 'ld-open' },
      h('div', { class: 'ld-vert', 'aria-hidden': 'true' },
        h('span', { class: 'han' }, '汉语'),
        h('span', { class: 'ld-seal' }, icon('logo'))),
      h('div', { class: 'ld-copy' },
        h('p', { class: 'ld-kicker' }, 'Hán ngữ quyển 1 – 2'),
        h('h1', {}, 'Mỗi ngày một ít,', h('br'), 'nhớ lâu từng chữ.'),
        h('p', { class: 'ld-lead' }, 'Giáo trình Hán ngữ, 15 phút mỗi ngày.'),
        h('div', { class: 'ld-actions' },
          h('button', { class: 'btn primary big', type: 'button', onclick: start }, started ? 'Học tiếp' : 'Vào học', icon('chevron')),
          installArea)),
      h('div', { class: 'ld-demo' }, card)),
));

  return () => { window.removeEventListener('install:changed', paintInstall); };
}
