// #/account: đăng nhập / tạo tài khoản để đồng bộ tiến độ giữa nhiều thiết bị (Cloudflare Worker + D1).

import { h, mount, toast, confirmDialog } from '../../ui/dom.js';
import { icon, artOr } from '../../ui/icons.js';
import { loadAccount, signIn, signOut, deleteAccount, syncNow, syncUrl } from '../../sync.js';

const LAST_USER = 'chinese-last-username';
const USER_RX = /^[a-z0-9._@+-]{3,64}$/;

/** "vừa xong", "3 phút trước", "hôm qua 21:05"… */
export function ago(t, now = Date.now()) {
  if (!t) return 'chưa đồng bộ';
  const s = Math.round((now - t) / 1000);
  if (s < 45) return 'vừa xong';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export async function render(root, ctx, { query = {} } = {}) {
  const acct = loadAccount();
  if (acct) return renderSignedIn(root, ctx, acct);
  // Chưa đăng nhập: hiện trang giới thiệu kèm form đăng nhập (không đổi địa chỉ để tránh chuyển trang chồng nhau).
  document.body.classList.add('landing-mode');
  const landing = await import('../landing/landing.js');
  return landing.render(root, ctx, { query: { auth: query.mode === 'register' ? 'register' : 'login' } });
}

/** Khối đăng nhập / tạo tài khoản (dùng trên trang giới thiệu). */
export function authCard(ctx, { register: startRegister = false } = {}) {
  let register = startRegister;
  let busy = false;
  const remembered = (() => { try { return localStorage.getItem(LAST_USER) || ''; } catch { return ''; } })();

  const field = ({ id, label, ic, input, extra = null }) => {
    const msg = h('small', { class: 'f-msg', id: `${id}-msg` });
    input.id = id;
    input.setAttribute('aria-describedby', `${id}-msg`);
    const wrap = h('div', { class: 'f-field' },
      h('label', { class: 'f-label', for: id }, label),
      h('div', { class: 'f-box' }, h('span', { class: 'f-ic' }, icon(ic)), input, extra),
      msg);
    return { wrap, msg, input, set(text, bad = true) { msg.textContent = text || ''; wrap.classList.toggle('bad', !!text && bad); wrap.classList.toggle('ok', !text && input.value.length > 0); } };
  };
  const eyeBtn = (inp) => {
    const b = h('button', { class: 'f-eye', type: 'button', 'aria-label': 'Hiện mật khẩu', 'aria-pressed': 'false' }, icon('eye'));
    b.onclick = () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.setAttribute('aria-pressed', String(show)); b.classList.toggle('on', show); inp.focus(); };
    return b;
  };

  const userIn = h('input', { type: 'text', autocomplete: 'username', autocapitalize: 'off', autocorrect: 'off', spellcheck: false, inputmode: 'email', value: remembered, maxlength: 64 });
  const passIn = h('input', { type: 'password', placeholder: '••••••••', maxlength: 200 });
  const pass2In = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Nhập lại mật khẩu', maxlength: 200 });
  const fUser = field({ id: 'acc-user', label: 'Tên đăng nhập', ic: 'user', input: userIn });
  const fPass = field({ id: 'acc-pass', label: 'Mật khẩu', ic: 'lock', input: passIn, extra: eyeBtn(passIn) });
  const fPass2 = field({ id: 'acc-pass2', label: 'Nhập lại mật khẩu', ic: 'lock', input: pass2In, extra: eyeBtn(pass2In) });
  const meter = h('div', { class: 'pw-meter', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
  fPass.wrap.append(meter);

  const formErr = h('div', { class: 'form-alert', role: 'alert' });
  const submitBtn = h('button', { class: 'btn primary big block', type: 'submit' });
  const tabs = h('div', { class: 'seg auth-tabs', role: 'tablist', 'aria-label': 'Đăng nhập hoặc đăng ký' },
    h('button', { class: 'seg-btn', type: 'button', role: 'tab', dataset: { m: 'login' }, onclick: () => setMode(false) }, 'Đăng nhập'),
    h('button', { class: 'seg-btn', type: 'button', role: 'tab', dataset: { m: 'register' }, onclick: () => setMode(true) }, 'Tạo tài khoản'));

  const strength = (p) => (p.length >= 12 ? 1 : 0) + (/[A-Z]/.test(p) && /[a-z]/.test(p) ? 1 : 0) + (/\d/.test(p) && /[^A-Za-z0-9]/.test(p) ? 1 : 0) + (p.length >= 8 ? 1 : 0);
  function validate({ touchAll = false } = {}) {
    const u = userIn.value.trim().toLowerCase();
    const p = passIn.value;
    let ok = true;
    const show = (f, text, touched) => { if (touched || touchAll) f.set(text); if (text) ok = false; };
    show(fUser, !u ? 'Nhập tên đăng nhập' : !USER_RX.test(u) ? '3–64 ký tự: chữ không dấu, số, . _ - @ +' : '', userIn.dataset.touched);
    show(fPass, !p ? 'Nhập mật khẩu' : register && p.length < 8 ? 'Ít nhất 8 ký tự' : '', passIn.dataset.touched);
    if (register) show(fPass2, pass2In.value !== p ? 'Hai mật khẩu chưa khớp' : '', pass2In.dataset.touched);
    const sc = register && p ? strength(p) : 0;
    meter.className = `pw-meter s${sc}`;
    meter.classList.toggle('hidden', !register || !p);
    submitBtn.disabled = busy;
    return ok;
  }
  for (const inp of [userIn, passIn, pass2In]) {
    inp.addEventListener('input', () => { formErr.textContent = ''; formErr.classList.remove('on'); validate(); });
    inp.addEventListener('blur', () => { inp.dataset.touched = '1'; validate(); });
  }

  function setMode(r) {
    register = r;
    tabs.querySelectorAll('.seg-btn').forEach((b) => { const on = (b.dataset.m === 'register') === r; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    fPass2.wrap.classList.toggle('hidden', !r);
    passIn.autocomplete = r ? 'new-password' : 'current-password';
    submitBtn.replaceChildren(r ? 'Tạo tài khoản' : 'Đăng nhập', icon('chevron'));
    title.textContent = r ? 'Tạo tài khoản mới' : 'Chào mừng trở lại';
    formErr.textContent = ''; formErr.classList.remove('on');
    [fUser, fPass, fPass2].forEach((f) => f.set(''));
    validate();
  }

  const title = h('h2', { class: 'auth-title' });
  const form = h('form', { class: 'auth-form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!validate({ touchAll: true })) { form.querySelector('.f-field.bad input')?.focus(); return; }
    if (!navigator.onLine) { showErr('Đang offline. Kết nối mạng rồi thử lại.'); return; }
    busy = true;
    submitBtn.classList.add('loading');
    submitBtn.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), register ? 'Đang tạo tài khoản…' : 'Đang đăng nhập…');
    try {
      const username = userIn.value.trim().toLowerCase();
      await signIn({ url: syncUrl(), username, password: passIn.value, register });
      try { localStorage.setItem(LAST_USER, username); } catch { /* bỏ qua */ }
      submitBtn.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Đang đồng bộ…');
      const r = await syncNow(ctx.repo);
      await ctx.refreshSettings();
      toast(register ? 'Đã tạo tài khoản' : r.pulled ? `Đã tải ${r.pulled} bản ghi từ máy khác` : 'Đã đăng nhập');
      window.dispatchEvent(new Event('sync:changed'));
      await ctx.repo.saveSettings({ onboarded: true });
      await ctx.refreshSettings();
      ctx.navigate('today');
    } catch (err) {
      showErr(err.message, err.status);
    } finally {
      busy = false;
      submitBtn.classList.remove('loading');
      submitBtn.replaceChildren(register ? 'Tạo tài khoản' : 'Đăng nhập', icon('chevron'));
      submitBtn.disabled = false;
    }
  } },
  title, tabs, fUser.wrap, fPass.wrap, fPass2.wrap, formErr, submitBtn);

  function showErr(msg, status) {
    formErr.replaceChildren(icon('info'), h('span', {}, msg));
    formErr.classList.add('on');
    if (status === 409) { fUser.set('Tên này đã có người dùng'); userIn.focus(); }
    else if (status === 401) { fPass.set(' ', true); passIn.select(); }
  }

  setMode(register);
  return h('section', { class: 'auth-card', id: 'auth' },
    h('img', { class: 'auth-cloud', src: './art/deco/cloud.webp', alt: '', 'aria-hidden': 'true' }),
    form);
}

function renderSignedIn(root, ctx, acct) {
  const when = h('span', {}, ago(acct.last_sync_at));
  const statusDot = h('span', { class: ['sync-dot', navigator.onLine ? 'ok' : 'off'] });
  const statusText = h('span', {}, navigator.onLine ? 'Tự đồng bộ mỗi phút' : 'Đang offline – sẽ đồng bộ khi có mạng');
  const result = h('p', { class: 'sync-result', 'aria-live': 'polite' });
  const syncBtn = h('button', { class: 'btn primary big block', type: 'button', onclick: async () => {
    syncBtn.disabled = true;
    syncBtn.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Đang đồng bộ…');
    try {
      const r = await syncNow(ctx.repo);
      await ctx.refreshSettings();
      when.textContent = ago(r.at);
      result.textContent = r.pulled || r.pushed ? `Nhận ${r.pulled} · gửi ${r.pushed} bản ghi` : 'Đã khớp với máy chủ';
      result.className = 'sync-result ok';
      if (r.changedLocal) window.dispatchEvent(new Event('sync:changed'));
    } catch (e) {
      result.textContent = e.message;
      result.className = 'sync-result bad';
    } finally {
      syncBtn.disabled = false;
      syncBtn.replaceChildren(icon('refresh'), 'Đồng bộ ngay');
    }
  } }, icon('refresh'), 'Đồng bộ ngay');
  const tick = setInterval(() => { when.textContent = ago(loadAccount()?.last_sync_at); }, 30_000);
  const onSync = () => { when.textContent = ago(loadAccount()?.last_sync_at); };
  window.addEventListener('sync:changed', onSync);

  const logoutBtn = h('button', { class: 'btn block', type: 'button', onclick: async () => {
    if (!(await confirmDialog({ title: 'Đăng xuất?', body: 'Dữ liệu học vẫn giữ trên máy này; chỉ ngừng đồng bộ.', ok: 'Đăng xuất' }))) return;
    await signOut(ctx.repo);
    toast('Đã đăng xuất');
    window.dispatchEvent(new Event('sync:changed'));
    ctx.navigate(`account?r=${Date.now()}`);
  } }, icon('logout'), 'Đăng xuất');
  const danger = h('details', { class: 'danger-zone' },
    h('summary', {}, icon('trash'), 'Xóa tài khoản'),
    h('p', { class: 'muted small' }, 'Xóa tài khoản và toàn bộ dữ liệu trên máy chủ. Dữ liệu trên máy này vẫn giữ.'),
    h('button', { class: 'btn danger block', type: 'button', onclick: async () => {
      const pass = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Mật khẩu', placeholder: 'Mật khẩu' });
      if (!(await confirmDialog({ title: 'Xóa tài khoản?', body: h('div', {}, h('p', {}, 'Nhập mật khẩu để xác nhận. Không thể hoàn tác.'), pass), ok: 'Xóa vĩnh viễn', danger: true }))) return;
      try { await deleteAccount(ctx.repo, pass.value); toast('Đã xóa tài khoản'); window.dispatchEvent(new Event('sync:changed')); ctx.navigate(`account?r=${Date.now()}`); } catch (e) { toast(e.message); }
    } }, 'Xóa vĩnh viễn'));

  // Một thẻ duy nhất ở giữa: ảnh bìa → avatar + tên → trạng thái đồng bộ → nút → xóa tài khoản (gập).
  mount(root,
    h('div', { class: 'large-title' }, h('h1', {}, 'Tài khoản')),
    h('section', { class: 'acct-card' },
      h('div', { class: 'acct-cover' }, h('img', { src: './art/deco/scene.webp', alt: '' })),
      h('div', { class: 'acct-body' },
        h('div', { class: 'profile-head' },
          h('span', { class: 'avatar' }, (acct.username || '?')[0].toUpperCase()),
          h('div', { class: 'grow' }, h('strong', { class: 'p-name' }, acct.username), h('div', { class: 'p-status' }, statusDot, statusText))),
        h('div', { class: 'sync-box' },
          h('div', { class: 'sb-row' }, icon('cloudCheck'), h('span', { class: 'grow' }, 'Lần đồng bộ gần nhất'), h('b', {}, when)),
          result),
        h('div', { class: 'acct-actions' }, syncBtn, logoutBtn),
        danger)));
  return () => { clearInterval(tick); window.removeEventListener('sync:changed', onSync); };
}
