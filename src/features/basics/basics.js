// #/basics?tab=pinyin|tones|radicals|strokes — kiến thức nền: bảng pinyin, thanh điệu, 214 bộ thủ, nét và bút thuận.

import { h, mount } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { strokeViewer } from '../../ui/strokes.js';
import { loadDecomp } from '../../ui/char-anatomy.js';
import { leaves } from '../../core/decomp.js';
import { segmented } from '../reading/reading.js';
import {
  INITIAL_GROUPS, INITIALS, FINAL_GROUPS, TABLE_FINALS, spell, TONES, SANDHI, SPELLING,
  RADICALS_214, STROKES, STROKE_RULES,
} from './basics-data.js';

const TABS = [['pinyin', 'Pinyin'], ['tones', 'Thanh điệu'], ['radicals', 'Bộ thủ'], ['strokes', 'Nét chữ']];
let charsP = null;
const loadChars = () => (charsP ||= import('./pinyin-chars.json').then((m) => m.default || m));

export async function render(root, ctx, { query = {} } = {}) {
  const tab = TABS.some(([id]) => id === query.tab) ? query.tab : 'pinyin';
  const rate = ctx.settings.tts_rate;
  const body = h('div', { class: 'basics' });
  mount(root,
    h('div', { class: 'large-title' }, h('div', {}, h('div', { class: 'sub' }, 'Bài học'), h('h1', {}, 'Cơ bản')), segmented('basics')),
    h('div', { class: 'seg seg-fit basics-tabs', role: 'tablist' }, TABS.map(([id, label]) => h('a', {
      class: ['seg-btn', id === tab ? 'on' : ''], href: `#/basics?tab=${id}`, role: 'tab', 'aria-selected': String(id === tab),
    }, label))),
    body);
  if (tab === 'pinyin') await pinyinTab(body, rate);
  else if (tab === 'tones') await tonesTab(body, rate);
  else if (tab === 'radicals') await radicalsTab(body, ctx, rate, query);
  else strokesTab(body);
}

/** Mở hộp thoại; tự đóng khi bấm ra ngoài hoặc đổi trang. */
function showDialog(dlg) {
  const onHash = () => dlg.close();
  dlg.addEventListener('close', () => { window.removeEventListener('hashchange', onHash); dlg.remove(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  window.addEventListener('hashchange', onHash);
  document.body.append(dlg);
  dlg.showModal();
}

// ---------------------------------------------------------------- pinyin
async function pinyinTab(body, rate) {
  const chars = await loadChars();
  // Phát âm một âm tiết: lấy chữ của thanh 1 (hoặc thanh đầu tiên có).
  const sample = (syl) => { const t = chars[syl]; if (!t) return null; return t[1] || t[2] || t[3] || t[4] || t[0]; };
  const say = (syl) => { const s = sample(syl); if (s) speak(s[0], rate); };
  const soundChip = ([label, syl, vi]) => h('button', { class: 'py-chip', type: 'button', onclick: () => say(syl), 'aria-label': `${label}, đọc gần như ${vi}` },
    h('b', {}, label), h('small', {}, vi));

  const groups = (list) => list.map((g) => h('div', { class: 'py-group' },
    h('div', { class: 'py-gname' }, g.name),
    h('div', { class: 'py-chips' }, g.items.map(soundChip))));

  // Bảng ghép: hàng = vận mẫu, cột = thanh mẫu (cột đầu: không có thanh mẫu).
  const cols = ['', ...INITIALS];
  const table = h('table', { class: 'py-table' },
    h('thead', {}, h('tr', {}, h('th', { class: 'corner' }, ''), cols.map((c) => h('th', { scope: 'col' }, c || '–')))),
    h('tbody', {}, TABLE_FINALS.map((f) => h('tr', {},
      h('th', { scope: 'row' }, f),
      cols.map((ini) => {
        const syl = spell(ini, f);
        if (!syl || !chars[syl]) return h('td', { class: 'empty' });
        return h('td', {}, h('button', { class: 'py-cell', type: 'button', onclick: () => openSyllable(syl, chars[syl], rate) }, syl));
      })))));

  body.append(
    h('div', { class: 'section-title' }, 'Thanh mẫu · 21 + y, w'),
    h('div', { class: 'group py-box' }, groups(INITIAL_GROUPS)),
    h('div', { class: 'section-title' }, 'Vận mẫu · 36'),
    h('div', { class: 'group py-box' }, groups(FINAL_GROUPS)),
    h('div', { class: 'section-title' }, 'Bảng ghép âm'),
    h('div', { class: 'py-table-wrap group' }, table),
    h('div', { class: 'section-title' }, 'Quy tắc viết'),
    h('div', { class: 'group' }, SPELLING.map(([rule, short, ex]) => h('div', { class: 'row-link static' },
      h('span', { class: 'grow' }, h('div', { class: 'title' }, rule), h('div', { class: 'meta' }, short)),
      h('span', { class: 'py-ex' }, ex.join(' · '))))));
}

/** Bảng 4 thanh của một âm tiết. */
function openSyllable(syl, tones, rate) {
  const order = ['1', '2', '3', '4', '0'].filter((t) => tones[t]);
  const playAll = async () => {
    for (const t of order) {
      if (!dlg.isConnected) return;
      speak(tones[t][0], rate);
      await new Promise((r) => setTimeout(r, 1000 / Math.max(0.5, rate)));
    }
  };
  const dlg = h('dialog', { class: 'scope-dialog syl-dialog', 'aria-label': `Âm tiết ${syl}` },
    h('div', { class: 'row between nowrap' }, h('h2', { style: { margin: 0 } }, syl),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', onclick: () => dlg.close() }, icon('close'))),
    h('div', { class: 'syl-tones' }, order.map((t) => h('button', { class: ['syl-tone', `t${t}`], type: 'button', onclick: () => speak(tones[t][0], rate) },
      h('span', { class: 'st-n' }, t === '0' ? 'nhẹ' : `thanh ${t}`),
      h('strong', {}, tones[t][1]),
      h('span', { class: 'han', lang: 'zh-CN' }, tones[t][0])))),
    h('button', { class: 'btn primary block', type: 'button', onclick: playAll }, icon('speaker'), 'Nghe lần lượt'));
  showDialog(dlg);
  speak(tones[order[0]][0], rate);
}

// ---------------------------------------------------------------- thanh điệu
function contour(pts, n) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 60 50');
  svg.setAttribute('class', `tone-svg t${n}`);
  svg.setAttribute('aria-hidden', 'true');
  const y = (v) => 45 - (v - 1) * 10;
  const x = (u) => 8 + u * 44;
  let lines = '';
  for (let k = 1; k <= 5; k++) lines += `<line x1="4" x2="56" y1="${y(k)}" y2="${y(k)}" class="grid"/>`;
  const d = pts.length === 3
    ? `M${x(pts[0][0])} ${y(pts[0][1])} Q${x(pts[1][0])} ${y(pts[1][1]) + 8} ${x(pts[2][0])} ${y(pts[2][1])}`
    : `M${x(pts[0][0])} ${y(pts[0][1])} L${x(pts[1][0])} ${y(pts[1][1])}`;
  svg.innerHTML = `${lines}<path d="${d}" class="curve"/>`;
  return svg;
}

async function tonesTab(body, rate) {
  body.append(
    h('div', { class: 'tone-grid' }, TONES.map((t) => h('button', { class: ['tone-card', `t${t.n}`], type: 'button', onclick: () => speak(t.ex[0], rate) },
      h('div', { class: 'tc-top' }, h('strong', {}, t.name), h('span', { class: 'tc-mark' }, t.mark)),
      contour(t.pts, t.n),
      h('div', { class: 'tc-vi' }, t.vi),
      h('div', { class: 'tc-like' }, t.like),
      h('div', { class: 'tc-ex' }, h('span', { class: 'han', lang: 'zh-CN' }, t.ex[0]), h('span', {}, t.ex[1]), h('small', {}, t.ex[2]))))),
    h('div', { class: 'section-title' }, 'Biến điệu'),
    h('div', { class: 'sandhi' }, SANDHI.map((s) => h('div', { class: 'group sandhi-card' },
      h('div', { class: 'sd-head' }, h('strong', {}, s.title), h('span', { class: 'badge' }, s.rule)),
      h('div', { class: 'sd-ex' }, s.ex.map(([zh, py, said]) => h('button', { class: 'sd-item', type: 'button', onclick: () => speak(zh, rate) },
        h('span', { class: 'han', lang: 'zh-CN' }, zh), h('small', { class: 'sd-py' }, py), h('b', {}, said))))))),
    h('a', { class: 'btn primary big block basics-cta', href: '#/practice/tones?scope=upto' }, icon('target'), 'Luyện thanh điệu'));
}

// ---------------------------------------------------------------- bộ thủ
async function radicalsTab(body, ctx, rate, query) {
  const [data, decomp] = await Promise.all([ctx.loadAll(), loadDecomp()]);
  // Từ vựng của sách theo bộ thủ (bộ chính của chữ hoặc có mặt trong thành phần).
  const formsOf = (r) => new Set([r.ch, ...r.alt]);
  const examples = new Map();
  // Số chữ trong từ vựng có bộ này là bộ chính (để chọn nhóm "Hay gặp").
  const mainCount = new Map();
  const seenCh = new Set();
  for (const c of data.cards) for (const ch of String(c.hanzi || '')) {
    if (seenCh.has(ch) || !decomp[ch]?.r) continue;
    seenCh.add(ch);
    const r = RADICALS_214.find((x) => x.ch === decomp[ch].r || x.alt.includes(decomp[ch].r));
    if (r) mainCount.set(r.no, (mainCount.get(r.no) || 0) + 1);
  }
  for (const r of RADICALS_214) {
    const forms = formsOf(r);
    const words = [];
    for (const c of data.cards) {
      const hz = String(c.hanzi || '');
      if ([...hz].some((ch) => { const d = decomp[ch]; return d && (forms.has(d.r) || leaves(d.d).some((p) => forms.has(p))) || forms.has(ch); })) words.push(c);
      if (words.length >= 24) break;
    }
    examples.set(r.no, words);
  }
  let mode = query.all === '1' ? 'all' : 'common';
  const search = h('input', { type: 'search', placeholder: 'Tìm bộ: 水, thủy, nước…', 'aria-label': 'Tìm bộ thủ', value: '' });
  const listEl = h('div', { class: 'rad-list' });
  const modeSeg = h('div', { class: 'seg seg-fit' });
  const common = RADICALS_214.filter((r) => (mainCount.get(r.no) || 0) >= 3).sort((a, b) => mainCount.get(b.no) - mainCount.get(a.no));
  function draw() {
    modeSeg.replaceChildren(...[['common', `Hay gặp · ${common.length}`], ['all', 'Đủ 214 bộ']].map(([id, label]) => h('button', {
      class: ['seg-btn', mode === id ? 'on' : ''], type: 'button', onclick: () => { mode = id; draw(); },
    }, label)));
    const term = search.value.trim().toLowerCase();
    const match = (r) => !term || r.ch === term || r.alt.includes(term) || `${r.name} ${r.meaning}`.toLowerCase().includes(term);
    const card = (r) => h('button', { class: 'rad-card', type: 'button', onclick: () => openRadical(r, examples.get(r.no), rate) },
      h('span', { class: 'rad-ch han', lang: 'zh-CN' }, r.ch),
      h('span', { class: 'rad-info' },
        h('strong', {}, r.name),
        h('span', { class: 'rad-mean' }, r.meaning),
        r.alt.length ? h('span', { class: 'rad-alt han', lang: 'zh-CN' }, r.alt.join(' ')) : null),
      mainCount.get(r.no) ? h('span', { class: 'rad-count' }, mainCount.get(r.no)) : null);
    if (mode === 'common' && !term) {
      listEl.replaceChildren(h('div', { class: 'rad-grid' }, common.map(card)));
      return;
    }
    const rows = RADICALS_214.filter(match);
    const byStroke = [...new Set(rows.map((r) => r.strokes))];
    listEl.replaceChildren(...(rows.length ? byStroke.map((n) => [
      h('div', { class: 'section-title' }, `${n} nét`),
      h('div', { class: 'rad-grid' }, rows.filter((r) => r.strokes === n).map(card))]).flat() : [h('p', { class: 'muted center' }, 'Không có bộ phù hợp.')]));
  }
  search.addEventListener('input', draw);
  body.append(h('div', { class: 'filters rad-filters' }, search, modeSeg), listEl,
    h('a', { class: 'btn primary big block basics-cta', href: '#/practice/parts?scope=upto' }, icon('radical'), 'Luyện ghép bộ thủ'));
  draw();
}

function openRadical(r, words, rate) {
  const dlg = h('dialog', { class: 'scope-dialog rad-dialog', 'aria-label': `Bộ ${r.name}` },
    h('div', { class: 'row between nowrap' },
      h('h2', { style: { margin: 0 } }, `Bộ ${r.name}`, h('span', { class: 'muted rad-no' }, ` · số ${r.no} · ${r.strokes} nét`)),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', onclick: () => dlg.close() }, icon('close'))),
    h('p', { class: 'rad-d-mean' }, r.meaning, r.alt.length ? h('span', { class: 'han', lang: 'zh-CN' }, ` · ${r.alt.join(' ')}`) : null),
    strokeViewer(r.ch, { size: 120 }),
    words.length ? [h('div', { class: 'section-title' }, `Trong từ đã có (${words.length})`),
      h('div', { class: 'rad-words' }, words.map((c) => h('button', { class: 'rw-item', type: 'button', onclick: () => speak(c.hanzi, rate) },
        h('span', { class: 'han', lang: 'zh-CN' }, c.hanzi), h('span', { class: 'rw-py' }, c.pinyin), h('span', { class: 'rw-vi' }, c.meaning))))] : null);
  showDialog(dlg);
}

// ---------------------------------------------------------------- nét chữ
function strokesTab(body) {
  const openChar = (title, chars) => {
    const dlg = h('dialog', { class: 'scope-dialog rad-dialog', 'aria-label': title },
      h('div', { class: 'row between nowrap' }, h('h2', { style: { margin: 0 } }, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', onclick: () => dlg.close() }, icon('close'))),
      strokeViewer(chars.replace(/\s/g, ''), { size: 120 }));
    showDialog(dlg);
  };
  body.append(
    h('div', { class: 'section-title' }, `Nét cơ bản & nét ghép · ${STROKES.length}`),
    h('div', { class: 'stroke-grid' }, STROKES.map(([s, zh, py, vi, ex]) => h('button', { class: 'stroke-card', type: 'button', onclick: () => openChar(`${vi} · ${zh}`, ex) },
      h('span', { class: 'sc-glyph han', lang: 'zh-CN' }, s),
      h('strong', {}, vi),
      h('span', { class: 'sc-zh' }, h('span', { class: 'han', lang: 'zh-CN' }, zh), ` ${py}`),
      h('span', { class: 'sc-ex han', lang: 'zh-CN' }, ex)))),
    h('div', { class: 'section-title' }, 'Quy tắc bút thuận'),
    h('div', { class: 'group' }, STROKE_RULES.map(([rule, ex], k) => h('button', { class: 'row-link', type: 'button', onclick: () => openChar(rule, ex) },
      h('span', { class: 'icon-box rule-n' }, String(k + 1)),
      h('span', { class: 'grow' }, h('div', { class: 'title' }, rule)),
      h('span', { class: 'han rule-ex', lang: 'zh-CN' }, ex),
      icon('play')))));
}
