// Màn kết quả dùng chung: vòng điểm, số câu đúng, thời gian.

import { h } from '../../ui/dom.js';
import { speak } from '../../ui/speech.js';
import { artOr, icon } from '../../ui/icons.js';
import { formatDuration } from '../../core/stats.js';

export function scoreRing(score, { size = 148, stroke = 14, passed = null } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('class', 'ring');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Điểm ${Math.round(score * 100)}%`);
  const color = passed === false ? 'var(--bad)' : passed === true || score >= 0.8 ? 'var(--good)' : score < 0.5 ? 'var(--bad)' : 'var(--accent)';
  svg.innerHTML = `
    <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
    <circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" style="stroke:${color}"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score)}" ${score < 0.01 ? 'visibility="hidden"' : ''} transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" style="font:900 34px var(--font);fill:var(--ink)">${Math.round(score * 100)}%</text>`;
  return svg;
}

/** Danh sách từ làm sai (đã đưa vào hàng ôn) kèm nút "Ôn ngay". */
export function reviewWords(cards, { rate = 1 } = {}) {
  if (!cards.length) return null;
  return h('section', { class: 'review-words' },
    h('div', { class: 'rw-head' }, h('strong', {}, `Từ cần ôn (${cards.length})`), h('a', { class: 'btn primary', href: '#/session?mode=review' }, 'Ôn ngay')),
    h('div', { class: 'rw-list' }, cards.map((c) => h('button', { class: 'rw-item', type: 'button', onclick: () => speak(c.hanzi, rate) },
      h('span', { class: 'han', lang: 'zh-CN' }, c.hanzi), h('span', { class: 'rw-py' }, c.pinyin), h('span', { class: 'rw-vi' }, c.meaning)))));
}

export function resultView({ title, score, correct, total, activeMs, note, passed = null, emoji }) {
  return h('div', { class: 'result' },
    artOr((passed ?? score >= 0.7) ? 'pass' : 'retry', emoji || null),
    h('h1', {}, title),
    h('div', { style: { margin: '20px 0' } }, scoreRing(score, { passed })),
    h('div', { class: 'grid', style: { maxWidth: '360px', margin: '0 auto' } },
      h('div', { class: 'tile px-box' }, h('div', { class: 'value' }, `${correct}/${total}`), h('div', { class: 'label' }, 'câu đúng')),
      h('div', { class: 'tile px-box' }, h('div', { class: 'value' }, activeMs != null ? formatDuration(activeMs) : '—'), h('div', { class: 'label' }, 'thời gian'))),
    note ? h('p', { class: 'muted', style: { marginTop: '20px' } }, note) : null);
}

// ---------------------------------------------------------------- danh sách câu vừa làm
const HAN_RX = /\p{Script=Han}/u;

/** Đề bài dạng chữ cho danh sách xem lại. */
export function questionText(q) {
  if (q.qa) return q.qa.q.zh;
  if (q.type === 'listen') return `Nghe: ${q.speak}`;
  if (q.type === 'draw') {
    if (q.mode === 'listen') return `Nghe rồi viết: ${q.pinyin || ''}`.trim();
    if (q.mode === 'pinyin') return `Viết chữ có pinyin: ${q.pinyin}`;
    if (q.mode === 'trace') return `Viết theo mẫu: ${q.meaning}`;
    return `Viết chữ có nghĩa: ${q.meaning}`;
  }
  if (q.type === 'freewrite') return `Đặt câu với ${q.word}`;
  if (q.type === 'speak') return `${q.prompt}: ${q.target}`;
  if (q.compose) return `Ghép: ${q.compose.parts.join(' + ')}`;
  if (q.type === 'compose') return `Dịch: ${q.prompt}`;
  return q.prompt || '';
}

/** Câu trả lời của người học thành chữ. */
export function responseText(q, r) {
  if (r == null) return '—';
  if (q.type === 'draw' || (q.type === 'compose' && q.compose)) return r.score != null ? `Bài viết đạt ${Math.round(r.score * 100)}%` : '—';
  if (q.type === 'compose') return r.text || (r.score != null ? `${Math.round(r.score * 100)}%` : '—');
  if (q.type === 'freewrite') return r.text || '—';
  if (q.type === 'speak') return r.transcript || (r.self ? (r.ok ? 'Tự đánh giá: đọc tốt' : 'Tự đánh giá: chưa tốt') : '—');
  if (Array.isArray(r)) return r.join('');
  if (r instanceof Map) return [...r].map(([k, v]) => `${k} = ${v}`).join(' · ');
  if (typeof r === 'object') return r.text || r.value || '—';
  return String(r);
}

function correctText(q) {
  if (q.type === 'speak') return q.target;
  if (q.type === 'freewrite') return q.sample?.zh || q.word;
  if (q.type === 'match') return q.pairs.map((p) => `${p.left} = ${p.right}`).join(' · ');
  if (Array.isArray(q.answer)) return q.type === 'reorder' ? q.answer.join('') : q.answer.join(' / ');
  return q.answer ?? '';
}

/** Chữ Hán nên đọc khi bấm loa của một câu. */
function speakText(q) {
  if (q.qa) return q.qa.q.zh;
  if (q.speak) return q.speak;
  if (q.hanzi) return q.hanzi;
  const a = correctText(q);
  return HAN_RX.test(a) ? a : null;
}

const zhSpan = (text) => h('span', { class: HAN_RX.test(text) ? 'han' : '', lang: HAN_RX.test(text) ? 'zh-CN' : null }, text);

/**
 * Danh sách mọi câu vừa làm: đề, câu trả lời của bạn, đáp án; lọc Tất cả / Sai / Đúng.
 * results: [{ question, correct, response }] từ exerciseRunner.
 */
export function answerList(results, { rate = 1, title = 'Các câu vừa làm' } = {}) {
  const items = (results || []).filter((r) => r.question && r.question.type !== 'study');
  if (!items.length) return null;
  const nWrong = items.filter((r) => !r.correct).length;
  let filter = 'all';
  const list = h('ol', { class: 'answer-list' });
  const seg = h('div', { class: 'seg seg-fit al-filter', role: 'tablist' });
  const tabs = [['all', `Tất cả ${items.length}`], ['wrong', `Sai ${nWrong}`], ['right', `Đúng ${items.length - nWrong}`]];
  function draw() {
    seg.replaceChildren(...tabs.map(([id, label]) => h('button', {
      class: ['seg-btn', filter === id ? 'on' : ''], type: 'button', role: 'tab', 'aria-selected': String(filter === id),
      onclick: () => { filter = id; draw(); },
    }, label)));
    const shown = items.map((r, i) => ({ r, i })).filter(({ r }) => filter === 'all' || (filter === 'wrong' ? !r.correct : r.correct));
    list.replaceChildren(...(shown.length ? shown.map(({ r, i }) => {
      const q = r.question;
      const say = speakText(q);
      const qText = questionText(q);
      const yours = responseText(q, r.response);
      const right = correctText(q);
      return h('li', { class: ['al-item', r.correct ? 'ok' : 'bad'] },
        h('span', { class: 'al-mark', 'aria-label': r.correct ? 'Đúng' : 'Sai' }, icon(r.correct ? 'check' : 'close')),
        h('div', { class: 'al-body' },
          h('div', { class: 'al-q' }, h('span', { class: 'al-n' }, `${i + 1}.`), zhSpan(qText)),
          q.qa ? h('div', { class: 'al-sub' }, q.qa.q.vi) : null,
          h('div', { class: ['al-a', r.correct ? 'ok' : 'bad'] }, h('small', {}, 'Bạn trả lời'), zhSpan(yours)),
          !r.correct && right && right !== yours ? h('div', { class: 'al-a ok' }, h('small', {}, 'Đáp án'), zhSpan(right)) : null,
          r.fixed ? h('div', { class: 'al-sub' }, 'Đã làm lại đúng') : null,
          q.qa ? h('div', { class: 'al-sub' }, `${q.qa.a.zh} – ${q.qa.a.vi}`) : q.explanation ? h('div', { class: 'al-sub' }, q.explanation) : null),
        say ? h('button', { class: 'btn tinted icon-only al-say', type: 'button', 'aria-label': 'Nghe', onclick: () => speak(say, rate) }, icon('speaker')) : null);
    }) : [h('li', { class: 'al-empty' }, filter === 'wrong' ? 'Không có câu sai.' : 'Chưa có câu đúng.')]));
  }
  draw();
  return h('section', { class: 'answer-review' },
    h('div', { class: 'al-head' }, h('strong', {}, title), seg),
    list);
}
