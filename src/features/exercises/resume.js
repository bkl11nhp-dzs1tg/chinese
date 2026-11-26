// Lưu bài đang làm dở (luyện viết, luyện tập, kiểm tra…) để thoát ra vẫn làm tiếp được.
// Lưu trên máy (localStorage): danh sách câu, câu đang làm, kết quả các câu đã làm. Giữ tối đa 14 ngày.

import { h } from '../../ui/dom.js';
import { badgeIcon } from '../../ui/icons.js';

const PREFIX = 'chinese-resume:';
const MAX_AGE = 14 * 86_400_000;

/** Map (câu nối cặp) không lưu được dạng JSON: đổi thành mảng cặp. */
const plain = (v) => (v instanceof Map ? Object.fromEntries(v) : v);

export function loadResume(id, now = Date.now()) {
  try {
    const x = JSON.parse(localStorage.getItem(PREFIX + id) || 'null');
    if (!x || !Array.isArray(x.exercises) || now - (x.saved_at || 0) > MAX_AGE || x.i >= x.exercises.length) return null;
    // Câu hỏi trong kết quả trỏ lại đúng phần tử của danh sách (để xem lại và làm lại câu sai).
    x.results = (x.results || []).map((r) => ({ ...r, question: x.exercises[r.qi] ?? r.question }));
    return x;
  } catch {
    return null;
  }
}

export function saveResume(id, { exercises, i, results, meta = {} }, now = Date.now()) {
  if (!i) return; // chưa làm câu nào: không cần lưu
  const idx = new Map(exercises.map((q, k) => [q, k]));
  const data = {
    exercises, i, meta, saved_at: now,
    results: results.map((r) => ({ qi: idx.get(r.question) ?? -1, question: idx.has(r.question) ? null : r.question, correct: r.correct, fixed: r.fixed, response: plain(r.response) })),
  };
  try { localStorage.setItem(PREFIX + id, JSON.stringify(data)); } catch { /* bộ nhớ đầy: bỏ qua */ }
}

export function clearResume(id) {
  try { localStorage.removeItem(PREFIX + id); } catch { /* bỏ qua */ }
}

/** Màn chọn: làm tiếp bài dở hay làm lại từ đầu. */
export function resumeChoice(shell, saved, { title, onResume, onRestart }) {
  const done = saved.i;
  const total = saved.exercises.length;
  const right = saved.results.filter((r) => r.correct).length;
  shell.setProgress(done / total, `${done}/${total}`);
  shell.main.replaceChildren(h('div', { class: 'result resume-card' },
    badgeIcon('repeat'),
    h('div', { class: 'q-type' }, 'Đang làm dở'),
    h('h1', {}, title),
    h('div', { class: 'resume-bar', role: 'img', 'aria-label': `Đã làm ${done}/${total}` }, h('span', { style: { width: `${(done / total) * 100}%` } })),
    h('div', { class: 'group resume-meta' },
      h('div', { class: 'row-link static' }, h('span', { class: 'grow' }, 'Đã làm'), h('strong', {}, `${done}/${total} bước`)),
      saved.results.length ? h('div', { class: 'row-link static' }, h('span', { class: 'grow' }, 'Đúng'), h('strong', {}, `${right}/${saved.results.length} câu`)) : null,
      h('div', { class: 'row-link static' }, h('span', { class: 'grow' }, 'Lưu lúc'), h('strong', {}, new Date(saved.saved_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }))))));
  shell.setFooter(h('div', { class: 'row nowrap' },
    h('button', { class: 'btn big', type: 'button', style: { flex: 1 }, onclick: onRestart }, 'Làm lại'),
    h('button', { class: 'btn primary big', type: 'button', style: { flex: 1.3 }, onclick: onResume }, 'Làm tiếp')));
}

/** Có bài dở thì hỏi trước; không thì bắt đầu ngay. start(saved|null). */
export function startOrResume(shell, id, title, start) {
  const saved = loadResume(id);
  if (!saved) { start(null); return; }
  resumeChoice(shell, saved, { title, onResume: () => start(saved), onRestart: () => { clearResume(id); start(null); } });
}

/** Tham số exerciseRunner để làm tiếp + tự lưu sau mỗi câu. */
export function resumeOpts(id, saved, exercises, meta = {}) {
  return {
    startAt: saved?.i || 0,
    initialResults: saved?.results || [],
    onStep: (i, results) => saveResume(id, { exercises, i, results, meta }),
  };
}
