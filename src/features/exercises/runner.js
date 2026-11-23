// Chạy một dãy câu hỏi trong khung toàn màn hình (mục 9.4).
// Dạng: choose, listen, fill, match, reorder.
// mode 'practice': chọn → "Kiểm tra" → khung phản hồi đúng/sai + giải thích → "Tiếp tục".
// mode 'test': chọn → "Tiếp" (không cho biết đúng/sai), chấm ở cuối.

import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { grade, answerText, shuffle, autoExercises } from '../../core/exercises.js';
import { gradePinyin, gradeSpeech } from '../../core/practice.js';

const isHan = (s) => /\p{Script=Han}/u.test(s || '');
const TYPE_LABEL = { choose: 'Chọn đáp án đúng', listen: 'Nghe và chọn', fill: 'Điền vào chỗ trống', match: 'Nối cặp', reorder: 'Sắp xếp thành câu', pinyin: 'Gõ bính âm', speak: 'Luyện nói' };
const PAIR_COLORS = ['#e07b39', '#3a7bd5', '#2e9d63', '#9b59b6', '#d4a017', '#c0392b'];

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
      ex.prompt && ex.type !== 'listen' ? h('div', { class: 'ex-prompt' }, renderPrompt(ex.prompt)) : h('div', { class: 'ex-prompt' }, ex.prompt || ''),
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
      const ok = ex.type === 'pinyin' ? gradePinyin(response, ex.answer)
        : ex.type === 'speak' ? !!response.ok
        : grade(ex.type === 'listen' ? { ...ex, type: 'choose' } : ex, response);
      results.push({ question: ex, correct: ok, response });
      onAnswer?.(ex, ok, response);
      body.querySelectorAll('button, input').forEach((b) => { b.disabled = true; });
      if (mode === 'test') { i++; next(); return; }
      mark(ok);
      const answer = ex.type === 'speak' ? (response.transcript ? `Máy nghe được: ${response.transcript}` : ex.target) : answerText(ex);
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
        onclick: () => { picked = o; opts.forEach((b) => b.classList.toggle('selected', b.dataset.v === o)); setReady(true); if (isHan(o)) speak(o, rate); },
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
      const matches = new Map(); // left → right
      const colorOf = new Map(); // left → màu
      let selLeft = null;
      const leftBtns = lefts.map((l) => h('button', { class: ['chip', 'mt-left', isHan(l) ? 'han' : ''], type: 'button', dataset: { v: l }, onclick: () => { if (answered) return; selLeft = selLeft === l ? null : l; if (isHan(l)) speak(l, rate); refresh(); } }, l));
      const rightBtns = rights.map((r) => h('button', {
        class: 'chip mt-right', type: 'button', dataset: { v: r },
        onclick: () => {
          if (answered) return;
          // Bấm nghĩa đã nối mà chưa chọn chữ: gỡ nối.
          if (!selLeft) { for (const [k, v] of matches) if (v === r) matches.delete(k); refresh(); return; }
          for (const [k, v] of matches) if (v === r) matches.delete(k);
          matches.set(selLeft, r);
          if (!colorOf.has(selLeft)) colorOf.set(selLeft, PAIR_COLORS[colorOf.size % PAIR_COLORS.length]);
          selLeft = lefts.find((l) => !matches.has(l)) || null;
          refresh();
        },
      }, r));
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'match-lines');
      svg.setAttribute('aria-hidden', 'true');
      const grid = h('div', { class: 'match-grid' }, h('div', { class: 'col' }, leftBtns), h('div', { class: 'col' }, rightBtns), svg);
      const status = h('p', { class: 'muted small center', style: { marginTop: '12px' } });
      let verdict = null; // sau khi chấm: left → đúng/sai
      function drawLines() {
        const box = grid.getBoundingClientRect();
        svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
        svg.replaceChildren();
        for (const [l, r] of matches) {
          const lb = leftBtns.find((b) => b.dataset.v === l)?.getBoundingClientRect();
          const rb = rightBtns.find((b) => b.dataset.v === r)?.getBoundingClientRect();
          if (!lb || !rb) continue;
          const x1 = lb.right - box.left, y1 = lb.top + lb.height / 2 - box.top;
          const x2 = rb.left - box.left, y2 = rb.top + rb.height / 2 - box.top;
          const color = verdict ? (verdict.get(l) ? 'var(--good)' : 'var(--bad)') : colorOf.get(l);
          const mid = (x1 + x2) / 2;
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('d', `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`);
          path.setAttribute('stroke', color);
          path.setAttribute('stroke-width', '3');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke-linecap', 'round');
          if (verdict && !verdict.get(l)) path.setAttribute('stroke-dasharray', '6 6');
          svg.append(path);
          for (const [cx, cy] of [[x1, y1], [x2, y2]]) {
            const c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', '5'); c.setAttribute('fill', color);
            svg.append(c);
          }
        }
      }
      function refresh() {
        leftBtns.forEach((b) => {
          const l = b.dataset.v;
          b.classList.toggle('selected', l === selLeft);
          b.classList.toggle('linked', matches.has(l));
          b.style.setProperty('--pair', colorOf.get(l) || 'transparent');
        });
        const used = new Map([...matches].map(([l, r]) => [r, l]));
        rightBtns.forEach((b) => {
          b.classList.toggle('linked', used.has(b.dataset.v));
          b.style.setProperty('--pair', used.has(b.dataset.v) ? colorOf.get(used.get(b.dataset.v)) : 'transparent');
        });
        status.textContent = `Đã nối ${matches.size}/${ex.pairs.length} · chọn chữ bên trái rồi nghĩa bên phải`;
        setReady(matches.size === ex.pairs.length);
        requestAnimationFrame(drawLines);
      }
      const ro = new ResizeObserver(() => drawLines());
      ro.observe(grid);
      selLeft = lefts[0];
      body.append(grid, status);
      refresh();
      getResponse = () => (matches.size === ex.pairs.length ? matches : null);
      mark = () => {
        verdict = new Map(ex.pairs.map((p) => [p.left, matches.get(p.left) === p.right]));
        leftBtns.forEach((b) => b.classList.add(verdict.get(b.dataset.v) ? 'correct' : 'wrong'));
        drawLines();
      };
      keyHandler = (e) => { if (e.key === 'Enter' && !answered) submit(); };
    } else if (ex.type === 'pinyin') {
      const input = h('input', { type: 'text', class: 'py-input', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'done', 'aria-label': 'Bính âm', placeholder: 'vd: ni hao' });
      input.addEventListener('input', () => setReady(input.value.trim() !== ''));
      body.append(
        h('div', { class: 'big-han' }, h('span', { class: 'han', lang: 'zh-CN' }, ex.hanzi),
          h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe', onclick: () => speak(ex.hanzi, rate) }, icon('speaker'))),
        input);
      getResponse = () => (input.value.trim() ? input.value : null);
      setTimeout(() => input.focus(), 50);
      keyHandler = (e) => { if (e.key === 'Enter' && !e.isComposing && !answered) submit(); };
    } else if (ex.type === 'speak') {
      const Rec = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
      let result = null;
      const heard = h('div', { class: 'heard muted', 'aria-live': 'polite' }, Rec ? 'Bấm micro rồi đọc to.' : 'Trình duyệt không nhận dạng giọng nói: hãy đọc to rồi tự đánh giá.');
      const micBtn = h('button', { class: 'btn primary mic-btn', type: 'button', 'aria-label': 'Bắt đầu nói' }, icon('mic'));
      body.append(
        h('div', { class: 'big-han speak-target' },
          h('span', { class: 'han', lang: 'zh-CN' }, ex.target),
          h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe mẫu', onclick: () => speak(ex.target, rate) }, icon('speaker'))),
        ex.pinyin ? h('div', { class: 'center', style: { color: 'var(--accent-ink)', fontWeight: 700 } }, ex.pinyin) : null,
        ex.meaning ? h('div', { class: 'center muted' }, ex.meaning) : null,
        Rec ? h('div', { class: 'center', style: { marginTop: '20px' } }, micBtn) : null,
        heard,
        h('div', { class: 'row nowrap self-grade' },
          h('button', { class: 'btn', type: 'button', style: { flex: 1 }, onclick: () => { result = { ok: false, self: true }; submit(); } }, 'Mình đọc chưa tốt'),
          h('button', { class: 'btn good', type: 'button', style: { flex: 1 }, onclick: () => { result = { ok: true, self: true }; submit(); } }, 'Mình đọc tốt')));
      if (Rec) {
        micBtn.onclick = () => {
          const rec = new Rec();
          rec.lang = 'zh-CN';
          rec.interimResults = false;
          rec.maxAlternatives = 3;
          micBtn.classList.add('listening');
          heard.textContent = 'Đang nghe…';
          rec.onresult = (e) => {
            const alts = [...e.results[0]].map((a) => a.transcript);
            const ok = alts.some((t) => gradeSpeech(t, ex.target));
            result = { ok, transcript: alts[0] };
            heard.textContent = `Máy nghe được: ${alts[0]}`;
            setReady(true);
          };
          rec.onerror = () => { heard.textContent = 'Không nghe rõ, thử lại hoặc tự đánh giá bên dưới.'; };
          rec.onend = () => micBtn.classList.remove('listening');
          rec.start();
        };
      }
      getResponse = () => result;
      keyHandler = (e) => { if (e.key === 'Enter' && !answered && result) submit(); };
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
