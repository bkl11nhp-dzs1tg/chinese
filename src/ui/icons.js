// Icon nét mảnh 24×24, tự vẽ. Icon điều hướng có lớp tô (.tone) đậm lên khi đang chọn. Logo: con dấu chữ 中.

const PATHS = {
  today: '<path class="tone" fill="currentColor" fill-opacity=".16" stroke="none" d="M2.5 19.5 8 12.5l3.5 4 3-3.5 7 6.5z"/><path d="M7.5 11.5a4.5 4.5 0 0 1 9 0"/><path d="M12 3v2.2M5.2 6l1.5 1.5M18.8 6l-1.5 1.5M3 11.5h1.8M19.2 11.5H21"/><path d="M2.5 19.5 8 12.5l3.5 4 3-3.5 7 6.5"/><path d="M2.5 19.5h19"/>',
  cards: '<rect class="tone" fill="currentColor" fill-opacity=".16" stroke="none" x="3.5" y="6" width="12.5" height="15" rx="2.5"/><path d="M8 3h9.5A3 3 0 0 1 20.5 6v11.5"/><rect x="3.5" y="6" width="12.5" height="15" rx="2.5"/><path d="M9.7 8.6v1M6.5 10.5h6.5v1.3M7.6 12.8h4.6l-2.3 1.7v3.3l-1 .6M6.5 15.4h6.5"/>',
  lessons: '<path class="tone" fill="currentColor" fill-opacity=".16" stroke="none" d="M12 6.5C10 5 7 4.5 3.5 5v13.5C7 18 10 18.5 12 20z"/><path d="M12 6.5C10 5 7 4.5 3.5 5v13.5C7 18 10 18.5 12 20c2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Z"/><path d="M12 6.5V20"/><path d="M15.5 5.2V11l1.5-1.2 1.5 1.2V5.1"/>',
  stats: '<rect class="tone" fill="currentColor" fill-opacity=".16" stroke="none" x="4" y="13" width="3.6" height="7" rx="1.8"/><rect class="tone" fill="currentColor" fill-opacity=".16" stroke="none" x="10.2" y="9.5" width="3.6" height="10.5" rx="1.8"/><rect class="tone" fill="currentColor" fill-opacity=".16" stroke="none" x="16.4" y="11.5" width="3.6" height="8.5" rx="1.8"/><rect x="4" y="13" width="3.6" height="7" rx="1.8"/><rect x="10.2" y="9.5" width="3.6" height="10.5" rx="1.8"/><rect x="16.4" y="11.5" width="3.6" height="8.5" rx="1.8"/><path d="M4 8.5 9 5l4 2.5 6.5-4"/><path d="M17 3.5h2.5V6"/>',
  settings: '<path class="tone" fill="currentColor" fill-opacity=".16" stroke="none" d="M18.76 10.20 L21.17 10.43 L21.17 13.57 L18.76 13.80 L18.06 15.51 L19.59 17.37 L17.37 19.59 L15.51 18.06 L13.80 18.76 L13.57 21.17 L10.43 21.17 L10.20 18.76 L8.49 18.06 L6.63 19.59 L4.41 17.37 L5.94 15.51 L5.24 13.80 L2.83 13.57 L2.83 10.43 L5.24 10.20 L5.94 8.49 L4.41 6.63 L6.63 4.41 L8.49 5.94 L10.20 5.24 L10.43 2.83 L13.57 2.83 L13.80 5.24 L15.51 5.94 L17.37 4.41 L19.59 6.63 L18.06 8.49Z"/><path d="M18.76 10.20 L21.17 10.43 L21.17 13.57 L18.76 13.80 L18.06 15.51 L19.59 17.37 L17.37 19.59 L15.51 18.06 L13.80 18.76 L13.57 21.17 L10.43 21.17 L10.20 18.76 L8.49 18.06 L6.63 19.59 L4.41 17.37 L5.94 15.51 L5.24 13.80 L2.83 13.57 L2.83 10.43 L5.24 10.20 L5.94 8.49 L4.41 6.63 L6.63 4.41 L8.49 5.94 L10.20 5.24 L10.43 2.83 L13.57 2.83 L13.80 5.24 L15.51 5.94 L17.37 4.41 L19.59 6.63 L18.06 8.49Z"/><circle cx="12" cy="12" r="3"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  game: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="17.5" cy="13.5" r=".9" fill="currentColor"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  flame: '<path d="M12 21.5c-4.1 0-7-2.8-7-6.6 0-3.3 2-5.3 3.4-7 .3 1.8 1.2 3 2.4 3.6.1-3.2 1.6-6.3 4.2-8.5-.3 3.4 4 6.1 4 11.7 0 4.1-2.9 6.8-7 6.8Z" fill="currentColor" fill-opacity=".2"/><path d="M12 21.5c-4.1 0-7-2.8-7-6.6 0-3.3 2-5.3 3.4-7 .3 1.8 1.2 3 2.4 3.6.1-3.2 1.6-6.3 4.2-8.5-.3 3.4 4 6.1 4 11.7 0 4.1-2.9 6.8-7 6.8Z"/><path d="M12 21.5c-1.8 0-3-1.3-3-3 0-2 1.6-3.1 2.4-4.6.9 1.3 3.6 2.4 3.6 4.7 0 1.7-1.2 2.9-3 2.9Z" fill="currentColor"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z" fill="currentColor" stroke="none"/>',
  trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 6.5H4.5a3 3 0 0 0 3.5 4M16 6.5h3.5a3 3 0 0 1-3.5 4"/><path d="M12 13.5v3.5M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.8"/><rect x="16" y="14" width="4.5" height="6.5" rx="1.8"/>',
  pencil: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3.5 3.5"/>',
  repeat: '<path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19l-3-3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5l3 3"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  lantern: '<path d="M12 2.5V4"/><rect x="9" y="4" width="6" height="2" rx=".6"/><ellipse cx="12" cy="11.5" rx="6.3" ry="5.5" fill="currentColor" fill-opacity=".22"/><ellipse cx="12" cy="11.5" rx="6.3" ry="5.5"/><path d="M9.3 6.6c-1.5 3-1.5 6.8 0 9.8M14.7 6.6c1.5 3 1.5 6.8 0 9.8"/><rect x="9.5" y="17" width="5" height="1.8" rx=".6"/><path d="M12 18.8v2.7M10.8 21.5h2.4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" fill-opacity=".18"/><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.5 9.2 4.7 4.7 0 0 0 7 18.5Z" fill="currentColor" fill-opacity=".16"/><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.5 9.2 4.7 4.7 0 0 0 7 18.5Z"/>',
  cloudCheck: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.5 9.2 4.7 4.7 0 0 0 7 18.5Z"/><path d="m9.3 13.8 2 2 3.8-4"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12.5" rx="2.5"/><path d="M6 9.8h.01M9.3 9.8h.01M12.6 9.8h.01M15.9 9.8h.01M18.2 9.8h.01M6 13h.01M18.2 13h.01M8.5 15.6h7"/><path d="M9.3 13h5.4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity=".2"/><circle cx="12" cy="12" r="3"/>',
  tone: '<path d="M3 17c2-5 3.5-9 5-9s1.5 6 3 6 2-8 4-8 2.5 5 6 3"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="15" cy="6" r=".9" fill="currentColor"/>',
  blocks: '<rect x="3" y="13" width="7.5" height="7" rx="1.6"/><rect x="13.5" y="13" width="7.5" height="7" rx="1.6" fill="currentColor" fill-opacity=".18"/><rect x="8.2" y="4" width="7.5" height="7" rx="1.6"/>',
  pause: '<rect x="7" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  skipBack: '<path d="M6 5v14"/><path d="M18 5.5v13L9 12z" fill="currentColor"/>',
  skipFwd: '<path d="M18 5v14"/><path d="M6 5.5v13l9-6.5z" fill="currentColor"/>',
  logout: '<path d="M14 4.5h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  puzzle: '<path d="M4 8h3.5a2 2 0 1 1 4 0H15v3.5a2 2 0 1 1 0 4V20H4z"/><path d="M15 8h5v12h-5"/>',
  party: '<path d="M4 20 8.5 7.5l8 8z"/><path d="M13 4.5c.5 1 .3 2-.5 2.7M17 8c1-.4 2-.1 2.7.6M15 3l.3 1M20 6.5l1-.3M19.5 12l1 .5"/><circle cx="16.5" cy="5.5" r=".8" fill="currentColor"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.5 6 3h4l2 5M15.5 10.5 18 3h-4l-2 5"/><path d="m12 12.5.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" fill="currentColor" stroke="none"/>',
  muscle: '<path d="M5 18c0-6 2-11 6-12l1.5 2.5L10 10c2 1 3 3 3 5 1.5-2 4-2.5 6-1 0 3-3 5-7 5H5z"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V3.5h6v1"/><path d="m8.5 12 2 2 4-4.5M8.5 17.5h7"/>',
  books: '<path d="M4 20V5h4v15M8 20V7h4v13"/><path d="m13 7.5 3.8-1 3.2 12.5-3.8 1z"/><path d="M3 20.5h18"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4.5c4-2 6 2 10 0s4 0 4 0v8s-1-2-4 0-6-2-10 0"/>',
  thumb: '<path d="M7 11v9H4v-9z"/><path d="M7 11l4-7c1.5 0 2.5 1 2.2 2.5L12.5 10H18a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  download: '<path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 19.5h15"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  chat: '<path d="M4.5 5.5h15v10h-9l-4.5 4v-4h-1.5z"/><path d="M8.5 10.5h7"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  cat: '<path d="M5 20v-9l-1-6 4.5 3h7L20 5l-1 6v9z"/><circle cx="9.5" cy="13.5" r=".9" fill="currentColor"/><circle cx="14.5" cy="13.5" r=".9" fill="currentColor"/><path d="M11 16.5h2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',
};

export function icon(name, { title } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  if (name === 'logo') {
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = '<rect x="1" y="1" width="22" height="22" rx="5" fill="#e8344f"/>'
      + '<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="3.6" fill="none" stroke="#ffd1dc" stroke-width="1.1"/>'
      + '<path d="M6.8 8.4h10.4v6.4H6.8z" fill="none" stroke="#fff" stroke-width="2.1" stroke-linejoin="round"/>'
      + '<path d="M12 4.8v14.6" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/>';
  } else {
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = PATHS[name] || PATHS.today;
  }
  if (title) {
    const t = document.createElementNS(ns, 'title');
    t.textContent = title;
    svg.prepend(t);
    svg.setAttribute('role', 'img');
  } else svg.setAttribute('aria-hidden', 'true');
  return svg;
}

/** Huy hiệu icon tròn lớn (thay cho emoji ở màn kết quả). tone: accent | good | bad | ink */
export function badgeIcon(name, tone = 'accent') {
  const span = document.createElement('span');
  span.className = `icon-badge ${tone}`;
  span.setAttribute('aria-hidden', 'true');
  span.append(icon(name));
  return span;
}

/** Hình minh họa chung (public/art/<name>.webp). Chưa có file thì dùng phần tử dự phòng (hoặc ẩn đi). */
export function artOr(name, fallback = null) {
  const img = document.createElement('img');
  img.className = `art-img art-${name}`;
  img.alt = '';
  img.decoding = 'async';
  img.src = `./art/${name}.webp`;
  img.addEventListener('error', () => { if (fallback) img.replaceWith(fallback); else img.remove(); }, { once: true });
  return img;
}
