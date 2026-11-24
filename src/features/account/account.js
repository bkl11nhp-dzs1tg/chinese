// #/account: đăng nhập / tạo tài khoản để đồng bộ tiến độ giữa nhiều thiết bị.

import { h, mount, toast, confirmDialog } from '../../ui/dom.js';
import { icon, badgeIcon, artOr } from '../../ui/icons.js';
import { loadAccount, signIn, signOut, deleteAccount, syncNow, syncUrl } from '../../sync.js';

const fmtTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : 'chưa');

export async function render(root, ctx) {
  const acct = loadAccount();
  if (acct) return renderSignedIn(root, ctx, acct);

  let register = false;
  const userInput = h('input', { type: 'text', id: 'acc-user', autocomplete: 'username', autocapitalize: 'off', spellcheck: false, placeholder: 'tên đăng nhập hoặc email' });
  const passInput = h('input', { type: 'password', id: 'acc-pass', autocomplete: 'current-password', placeholder: 'ít nhất 8 ký tự' });
  const err = h('p', { class: 'form-error', role: 'alert' });
  const submitBtn = h('button', { class: 'btn primary big block', type: 'submit' });
  const switchBtn = h('button', { class: 'btn ghost block', type: 'button' });
  const title = h('h2', {});
  const update = () => {
    title.textContent = register ? 'Tạo tài khoản' : 'Đăng nhập';
    submitBtn.textContent = register ? 'Tạo tài khoản và đồng bộ' : 'Đăng nhập và đồng bộ';
    switchBtn.textContent = register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Tạo mới';
    passInput.autocomplete = register ? 'new-password' : 'current-password';
    err.textContent = '';
  };
  switchBtn.onclick = () => { register = !register; update(); };
  update();

  const form = h('form', { class: 'account-form', onsubmit: async (e) => {
    e.preventDefault();
    err.textContent = '';
    submitBtn.disabled = true;
    try {
      await signIn({ url: syncUrl(), username: userInput.value, password: passInput.value, register });
      const r = await syncNow(ctx.repo);
      await ctx.refreshSettings();
      toast(r.pulled ? `Đã đồng bộ: nhận ${r.pulled}, gửi ${r.pushed} bản ghi.` : 'Đã đăng nhập và đồng bộ.');
      window.dispatchEvent(new Event('sync:changed'));
      ctx.navigate(`account?r=${Date.now()}`);
    } catch (e2) {
      err.textContent = e2.message;
    } finally {
      submitBtn.disabled = false;
    }
  } },
  title,
  h('label', { class: 'field' }, h('span', {}, 'Tên đăng nhập'), userInput),
  h('label', { class: 'field' }, h('span', {}, 'Mật khẩu'), passInput),
  err, submitBtn, switchBtn);

  mount(root,
    h('div', { class: 'large-title' }, h('div', {}, h('div', { class: 'sub' }, 'Đồng bộ nhiều thiết bị'), h('h1', {}, 'Tài khoản'))),
    h('div', { class: 'account-layout' },
      h('section', { class: 'card px-box' }, form),
      h('section', { class: 'card px-box account-info' },
        artOr('sync', badgeIcon('cloud')),
        h('h3', {}, 'Học trên điện thoại, tiếp tục trên máy tính'),
        h('ul', { class: 'check-list' },
          h('li', {}, icon('check'), 'Tiến độ thẻ, lịch ôn, điểm kiểm tra, thời gian học, từ đã lưu'),
          h('li', {}, icon('check'), 'Vẫn học offline bình thường; có mạng thì tự đồng bộ'),
          h('li', {}, icon('check'), 'Không đăng nhập vẫn dùng đầy đủ, dữ liệu chỉ ở máy này'),
          h('li', {}, icon('check'), 'Mật khẩu được mã hóa, có thể xóa tài khoản bất cứ lúc nào')))));
}

function renderSignedIn(root, ctx, acct) {
  const status = h('p', { class: 'muted' }, `Lần đồng bộ gần nhất: ${fmtTime(acct.last_sync_at)}`);
  const syncBtn = h('button', { class: 'btn primary big block', type: 'button', onclick: async () => {
    syncBtn.disabled = true;
    status.textContent = 'Đang đồng bộ…';
    try {
      const r = await syncNow(ctx.repo);
      await ctx.refreshSettings();
      status.textContent = `Đã đồng bộ lúc ${fmtTime(r.at)} · nhận ${r.pulled}, gửi ${r.pushed} bản ghi.`;
      if (r.changedLocal) window.dispatchEvent(new Event('sync:changed'));
    } catch (e) {
      status.textContent = e.message;
    } finally { syncBtn.disabled = false; }
  } }, icon('refresh'), 'Đồng bộ ngay');

  mount(root,
    h('div', { class: 'large-title' }, h('div', {}, h('div', { class: 'sub' }, 'Đồng bộ nhiều thiết bị'), h('h1', {}, 'Tài khoản'))),
    h('div', { class: 'account-layout' },
      h('section', { class: 'card px-box stack' },
        h('div', { class: 'row nowrap', style: { gap: '14px' } },
          h('span', { class: 'avatar' }, (acct.username || '?')[0].toUpperCase()),
          h('div', { class: 'grow' }, h('strong', { style: { fontSize: '19px' } }, acct.username), h('div', { class: 'muted small' }, 'Đang đồng bộ giữa các thiết bị'))),
        status, syncBtn,
        h('button', { class: 'btn block', type: 'button', onclick: async () => {
          if (!(await confirmDialog({ title: 'Đăng xuất?', body: 'Dữ liệu học vẫn giữ trên máy này; chỉ ngừng đồng bộ.', ok: 'Đăng xuất' }))) return;
          await signOut(ctx.repo);
          toast('Đã đăng xuất.');
          window.dispatchEvent(new Event('sync:changed'));
          ctx.navigate(`account?r=${Date.now()}`);
        } }, icon('logout'), 'Đăng xuất')),
      h('section', { class: 'card px-box stack' },
        h('h3', {}, 'Xóa tài khoản'),
        h('p', { class: 'muted small' }, 'Xóa tài khoản và toàn bộ dữ liệu trên máy chủ. Dữ liệu trên máy này vẫn giữ.'),
        h('button', { class: 'btn danger block', type: 'button', onclick: async () => {
          const pass = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Mật khẩu' });
          if (!(await confirmDialog({ title: 'Xóa tài khoản?', body: h('div', {}, h('p', {}, 'Nhập mật khẩu để xác nhận. Không thể hoàn tác.'), pass), ok: 'Xóa vĩnh viễn', danger: true }))) return;
          try { await deleteAccount(ctx.repo, pass.value); toast('Đã xóa tài khoản.'); ctx.navigate(`account?r=${Date.now()}`); } catch (e) { toast(e.message); }
        } }, icon('trash'), 'Xóa tài khoản'))));
}
