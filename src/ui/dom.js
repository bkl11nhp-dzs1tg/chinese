// Helper DOM nhỏ: h() tạo phần tử, toast, hộp thoại xác nhận.

// append/replaceChildren gốc in null/undefined/false thành chữ "null"… trên màn hình:
// bỏ qua các giá trị rỗng để mọi chỗ dùng `điều kiện ? phần tử : null` đều an toàn.
for (const proto of [globalThis.Element?.prototype, globalThis.DocumentFragment?.prototype]) {
  if (!proto || proto.__nullSafe) continue;
  for (const name of ['append', 'prepend', 'replaceChildren']) {
    const orig = proto[name];
    proto[name] = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false)); };
  }
  proto.__nullSafe = true;
}

export function h(tag, props = {}, ...children) {
  const el = tag === 'svg' || props?.svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false || k === 'svg') continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string' && !(el instanceof SVGElement)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function mount(container, ...children) {
  container.replaceChildren();
  append(container, children);
}

let toastTimer;
export function toast(message, ms = 2500) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

/** Hộp thoại xác nhận. Trả về Promise<boolean>. */
export function confirmDialog({ title, body, ok = 'Đồng ý', cancel = 'Hủy', danger = false }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { 'aria-labelledby': 'dlg-title' },
      h('h2', { id: 'dlg-title' }, title),
      body ? (body instanceof Node ? body : h('p', {}, body)) : null,
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => close(false) }, cancel),
        h('button', { class: ['btn', danger ? 'danger' : 'primary'], type: 'button', onclick: () => close(true) }, ok)),
    );
    function close(v) { dlg.close(); dlg.remove(); resolve(v); }
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(false); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/** Tải một đối tượng/chuỗi xuống thành file. */
export function downloadFile(name, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileText(file) {
  return file.text ? file.text() : new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });
}

export const pct = (x) => `${Math.round(x * 100)}%`;

/** Ghi chú dài → từng câu một dòng (tách sau dấu . ; và xuống dòng; giữ nguyên dấu). */
export function noteLines(text, cls = 'note-lines') {
  const parts = String(text || '').split(/(?<=[.;。；])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  return h('ul', { class: cls }, parts.map((p) => h('li', {}, p)));
}
