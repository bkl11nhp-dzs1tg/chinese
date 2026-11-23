// Chạy một dãy câu hỏi trong khung toàn màn hình (mục 9.4).
// Dạng: choose, listen, fill, match, reorder.
// mode 'practice': chọn → "Kiểm tra" → khung phản hồi đúng/sai + giải thích → "Tiếp tục".
// mode 'test': chọn → "Tiếp" (không cho biết đúng/sai), chấm ở cuối.

import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { grade, answerText, shuffle, autoExercises } from '../../core/exercises.js';

const isHan = (s) => /\p{Script=Han}/u.test(s || '');
const TYPE_LABEL = { choose: 'Chọn đáp án đúng', listen: 'Nghe và chọn', fill: 'Điền vào chỗ trống', match: 'Ghép cặp', reorder: 'Sắp xếp thành câu' };

/** Gom bài tập luyện của một bài: bài tập câu của bài + câu tự sinh từ từ vựng. */
export function lessonExercises(lesson, data, { limit = Infinity, rand = Math.random } = {}) {
  const lessonCards = lesson.vocab_ids.map((id) => data.cardsById.get(id)).filter(Boolean);
  const custom = data.exercisesByLesson.get(lesson.id) || [];
  const auto = autoExercises(lessonCards, data.cards, { rand, lessonId: lesson.id });
  if (lessonCards.length >= 3) {
    const picked = shuffle(lessonCards, rand).slice(0, 5);
    auto.push({
      id: `auto-match-${lesson.id}`, lesson_id: lesson.id, type: 'match', prompt: 'Ghép chữ Hán với nghĩa',
      pairs: picked.map((c) => ({ left: c.hanzi, right: c.meaning })), card_ids: picked.map((c) => c.id), auto: true,
    });
  }
  let all = [...shuffle(auto, rand), ...custom];
  if (all.length > limit) all = shuffle(all, rand).slice(0, limit);
  return { exercises: all, lessonCards };
}

/**
 * @param {object} o
 * @param {ReturnType<import('../../ui/focus.js').focusShell>} o.shell
 * @param {Array} o.exercises
 * @param {'practice'|'test'} [o.mode]
 * @param {number} [o.rate] tốc độ đọc
 * @param {(i:number, n:number)=>void} [o.onProgress]
 * @param {(ex, ok:boolean, response)=>void} [o.onAnswer]
 * @param {(r:{score:number, correct:number, total:number, results:Array})=>void} o.onDone
 */
export function exerciseRunner({ shell, exercises, mode = 'practice', rate = 1, onProgress, onAnswer, onDone }) {
  let i = 0;
  const results = [];
  let keyHandler = null;
  const onKey = (e) => keyHandler?.(e);
  window.addEventListener('keydown', onKey);
  const progress = onProgress || ((k, n) => shell.setProgress(k / n, `${Math.min(k + 1, n)}/${n}`));

  function next() {
    if (i >= exercises.length) {
      keyHandler = null;
      const correct = results.filter((r) => r.correct).length;
      const total = exercises.length;
      onDone({ score: total ? correct / total : 0, correct, total, results });
      return;
    }
    progress(i, exercises.length);
    render(exercises[i]);
  }

  function render(ex) {
    const body = h('div');
    const isLast = i === exercises.length - 1;
    const checkBtn = h('button', { class: 'btn primary big block', type: 'button', disabled: true },
      mode === 'test' ? (isLast ? 'Nộp bài' : 'Tiếp') : 'Kiểm tra');
    shell.setFooter(checkBtn);
    shell.main.replaceChildren(
      h('div', { class: 'q-type' }, TYPE_LABEL[ex.type] || ''),
      ex.prompt && ex.type !== 'listen' ? h('div', { class: 'ex-prompt' }, renderPrompt(ex.prompt)) : null,
      body);

    let answered = false;
    let getResponse = () => null;
    let mark = () => {};
    const setReady = (v) => { checkBtn.disabled = !v; };

    function submit() {
      if (answered) return;
      const response = getResponse();
      if (response == null) return;
      answered = true;
      const ok = grade(ex.type === 'listen' ? { ...ex, type: 'choose' } : ex, response);
      results.push({ question: ex, correct: ok, response });
      onAnswer?.(ex, ok, response);
      body.querySelectorAll('button, input').forEach((b) => { b.disabled = true; });
      if (mode === 'test') { i++; next(); return; }
      mark(ok);
      const answer = answerText(ex);
      shell.showSheet({
        ok,
        title: ok ? pickPraise() : 'Chưa đúng',
        detail: h('div', {},
          ok ? null : h('div', {}, 'Đáp án đúng: ', h('strong', { class: isHan(answer) ? 'han' : '' }, answer)),
          ex.explanation ? h('div', { class: 'muted', style: { marginTop: '4px' } }, ex.explanation) : null),
        onContinue: () => { i++; next(); },
      });
    }
    checkBtn.onclick = submit;

    if (ex.type === 'choose' || ex.type === 'listen') {
      let picked = null;
      const hanOpts = ex.options.every(isHan);
      const opts = ex.options.map((o, k) => h('button', {
        class: ['chip', isHan(o) ? 'han' : ''], type: 'button', dataset: { v: o },
        onclick: () => { picked = o; opts.forEach((b) => b.classList.toggle('selected', b.dataset.v === o)); setReady(true); if (ex.type === 'listen' || hanOpts) speak(o, rate); },
      }, o));
      if (ex.type === 'listen') {
        const play = () => speak(ex.speak, rate);
        body.append(
          h('div', { class: 'center' },
            h('button', { class: 'btn primary listen-btn', type: 'button', 'aria-label': 'Nghe lại', onclick: play }, icon('speaker')),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(ex.speak, 0.7) }, 'Nghe chậm')));
        setTimeout(play, 250);
      }
      body.append(h('div', { class: ['options', hanOpts ? 'han-grid' : ''] }, opts));
      getResponse = () => picked;
      mark = () => opts.forEach((b) => {
        b.classList.remove('selected');
        if (b.dataset.v === ex.answer) b.classList.add('correct');
        else if (b.dataset.v === picked) b.classList.add('wrong');
      });
      keyHandler = (e) => {
        const n = Number(e.key);
        if (!answered && n >= 1 && n <= opts.length) opts[n - 1].click();
        else if (!answered && e.key === 'Enter') submit();
      };
    } else if (ex.type === 'fill') {
      const input = h('input', { type: 'text', class: 'han-input', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'done', 'aria-label': 'Câu trả lời', placeholder: 'Gõ câu trả lời' });
      input.addEventListener('input', () => setReady(input.value.trim() !== ''));
      body.append(input);
      if (ex.options?.length) {
        body.append(h('div', { class: 'bank', style: { marginTop: '16px' } },
          ex.options.map((o) => h('button', { class: ['chip', isHan(o) ? 'han' : ''], type: 'button', onclick: () => { input.value = o; setReady(true); } }, o))));
      }
      getResponse = () => (input.value.trim() ? input.value : null);
      setTimeout(() => input.focus(), 50);
      keyHandler = (e) => { if (e.key === 'Enter' && !e.isComposing && !answered) submit(); };
    } else if (ex.type === 'reorder') {
      const pieces = shuffle(ex.options.map((t, k) => ({ t, k })));
      const chosen = [];
      const area = h('div', { class: 'build-area', 'aria-label': 'Câu đang xếp' });
      const bank = h('div', { class: 'bank' });
      const redraw = () => {
        area.replaceChildren(...chosen.map((p, idx) => h('button', { class: 'chip han', type: 'button', onclick: () => { chosen.splice(idx, 1); redraw(); } }, p.t)));
        bank.replaceChildren(...pieces.map((p) => h('button', {
          class: ['chip', 'han', chosen.includes(p) ? 'used' : ''], type: 'button',
          onclick: () => { if (!chosen.includes(p)) { chosen.push(p); speak(p.t, rate); redraw(); } },
        }, p.t)));
        setReady(chosen.length === pieces.length);
      };
      redraw();
      body.append(area, bank);
      getResponse = () => (chosen.length === pieces.length ? chosen.map((p) => p.t) : null);
      keyHandler = (e) => { if (e.key === 'Enter' && !answered) submit(); };
    } else if (ex.type === 'match') {
      const lefts = shuffle(ex.pairs.map((p) => p.left));
      const rights = shuffle(ex.pairs.map((p) => p.right));
      const matches = new Map();
      let selLeft = null;
      const leftBtns = lefts.map((l) => h('button', { class: ['chip', isHan(l) ? 'han' : ''], type: 'button', dataset: { v: l }, onclick: () => { selLeft = l; refresh(); } }, l));
      const rightBtns = rights.map((r) => h('button', {
        class: 'chip', type: 'button', dataset: { v: r },
        onclick: () => {
          if (!selLeft) return;
          for (const [k, v] of matches) if (v === r) matches.delete(k);
          matches.set(selLeft, r);
          selLeft = lefts.find((l) => !matches.has(l)) || null;
          refresh();
        },
      }, r));
      const status = h('p', { class: 'muted small center', style: { marginTop: '12px' } });
      function refresh() {
        leftBtns.forEach((b) => {
          b.classList.toggle('selected', b.dataset.v === selLeft);
          b.style.opacity = matches.has(b.dataset.v) && b.dataset.v !== selLeft ? '.55' : '';
        });
        rightBtns.forEach((b) => { b.style.opacity = [...matches.values()].includes(b.dataset.v) ? '.55' : ''; });
        status.textContent = `Đã ghép ${matches.size}/${ex.pairs.length} · chọn chữ bên trái rồi nghĩa bên phải`;
        setReady(matches.size === ex.pairs.length);
      }
      selLeft = lefts[0];
      refresh();
      body.append(h('div', { class: 'match-grid' }, h('div', { class: 'col' }, leftBtns), h('div', { class: 'col' }, rightBtns)), status);
      getResponse = () => (matches.size === ex.pairs.length ? matches : null);
      mark = () => leftBtns.forEach((b) => {
        const want = ex.pairs.find((p) => p.left === b.dataset.v)?.right;
        b.style.opacity = '';
        b.classList.add(matches.get(b.dataset.v) === want ? 'correct' : 'wrong');
      });
      keyHandler = (e) => { if (e.key === 'Enter' && !answered) submit(); };
    }
  }

  next();
  return { destroy: () => window.removeEventListener('keydown', onKey) };
}

const PRAISE = ['Chính xác!', 'Tuyệt!', 'Giỏi lắm!', 'Đúng rồi!', '很好！'];
function pickPraise() { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; }

function renderPrompt(text) {
  return text.split(/(\p{Script=Han}[\p{Script=Han}＿_\s，。？！、…—]*)/u).filter(Boolean)
    .map((part) => (isHan(part) ? h('span', { class: 'han', lang: 'zh-CN' }, part) : part));
}
