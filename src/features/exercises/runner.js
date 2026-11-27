// Chạy một dãy câu hỏi trong khung toàn màn hình (mục 9.4).
// Dạng: choose, listen, fill, match, reorder.
// mode 'practice': chọn → "Kiểm tra" → khung phản hồi đúng/sai + giải thích → "Tiếp tục".
// mode 'test': chọn → "Tiếp" (không cho biết đúng/sai), chấm ở cuối.

import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { speak } from '../../ui/speech.js';
import { grade, answerText, shuffle, autoExercises } from '../../core/exercises.js';
import { gradePinyin, gradeSpeech, gradeSentence } from '../../core/practice.js';
import { writeArea, sheetArea, PASS_INK } from './handwriting.js';
import { strokeViewer } from '../../ui/strokes.js';
import { charAnatomy } from '../../ui/char-anatomy.js';
import { translateZhVi } from '../../core/translate.js';

const isHan = (s) => /\p{Script=Han}/u.test(s || '');
const TYPE_LABEL = { choose: 'Chọn đáp án đúng', listen: 'Nghe và chọn', fill: 'Điền vào chỗ trống', match: 'Nối cặp', reorder: 'Sắp xếp thành câu', pinyin: 'Gõ pinyin', speak: 'Luyện nói', draw: 'Viết chữ', compose: 'Viết câu', study: 'Từ mới', sheet: 'Tập viết', missing: 'Điền chữ còn thiếu', freewrite: 'Đặt câu' };
const DRAW_LABEL = { trace: 'Viết theo mẫu', meaning: 'Tự viết', pinyin: 'Tự viết', listen: 'Tự viết' };
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
 * @param {number} [o.startAt]  làm tiếp từ câu thứ startAt (khôi phục bài đang làm dở)
 * @param {Array} [o.initialResults]  kết quả các câu đã làm trước đó
 * @param {(i:number, results:Array)=>void} [o.onStep]  gọi mỗi khi sang câu mới (để lưu tiến độ)
 */
export function exerciseRunner({ shell, exercises, mode = 'practice', rate = 1, onProgress, onAnswer, onDone, startAt = 0, initialResults = [], onStep, nav = false }) {
  let i = Math.max(0, Math.min(startAt, exercises.length));
  const results = [...initialResults];
  const queue = [...exercises];
  let keyHandler = null;
  const onKey = (e) => keyHandler?.(e);
  window.addEventListener('keydown', onKey);
  const progress = onProgress || ((k, n, done = 0) => shell.setProgress((k + done) / n, `${Math.min(k + 1, n)}/${n}`));

  function next() {
    if (i >= queue.length) {
      keyHandler = null;
      const correct = results.filter((r) => r.correct).length;
      const total = exercises.length;
      onDone({ score: total ? correct / total : 0, correct, total, results });
      return;
    }
    onStep?.(i, results);
    progress(i, queue.length);
    render(queue[i]);
  }

  function goBack() {
    if (i === 0) return;
    i--;
    // Câu trước đã làm: bỏ kết quả cũ để làm lại.
    for (let k = results.length - 1; k >= 0; k--) if (results[k].question === queue[i]) results.splice(k, 1);
    next();
  }

  function render(ex) {
    const body = h('div');
    const isLast = i === queue.length - 1;
    const checkBtn = h('button', { class: 'btn primary big block', type: 'button', disabled: true },
      mode === 'test' ? (isLast ? 'Nộp bài' : 'Tiếp') : 'Kiểm tra');
    shell.setFooter(checkBtn);
    shell.main.replaceChildren(
      h('div', { class: 'q-type' }, ex._orig ? h('span', { class: 'retry-tag' }, icon('repeat'), 'Làm lại câu sai') : null, (ex.type === 'draw' && DRAW_LABEL[ex.mode]) || (ex.compose ? 'Ghép thành chữ' : null) || (ex.qa ? 'Hỏi đáp' : null) || TYPE_LABEL[ex.type] || '', ex.source === 'workbook' || String(ex.id).includes('-wb') ? h('span', { class: 'wb-tag' }, icon('lessons'), 'Sách bài tập') : null),
      ex.qa && ex.type !== 'listen' ? qaBubble(ex, rate)
        : (ex.type === 'draw' && ex.mode) || ex.type === 'sheet' || ex.compose ? null : ex.prompt && ex.type !== 'listen' ? h('div', { class: 'ex-prompt' }, renderPrompt(ex.prompt)) : h('div', { class: 'ex-prompt' }, ex.prompt || ''),
      body);
    if (ex.qa && ex.type !== 'listen') setTimeout(() => speak(ex.speak, rate), 250);
    // Quay lại câu trước (làm lại, kết quả cũ bị thay) / Bỏ qua câu này (không tính điểm).
    const navRow = nav && !ex._orig ? h('div', { class: 'card-nav ex-nav' },
      h('button', { class: 'btn ghost', type: 'button', disabled: i === 0, onclick: () => goBack() }, icon('back'), 'Quay lại'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { i++; next(); } }, 'Bỏ qua', icon('chevron'))) : null;
    if (navRow) shell.main.append(navRow);

    let answered = false;
    let getResponse = () => null;
    let mark = () => {};
    const setReady = (v) => { checkBtn.disabled = !v; };

    function submit() {
      if (answered) return;
      const response = getResponse();
      if (response == null) return;
      answered = true;
      if (ex.type === 'study') { i++; next(); return; } // thẻ xem từ: không chấm
      navRow?.remove();
      const ok = ex.type === 'pinyin' ? gradePinyin(response, ex.answer)
        : ex.type === 'speak' || ex.type === 'draw' || ex.type === 'sheet' || ex.type === 'compose' || ex.type === 'freewrite' ? !!response.ok
        : grade(ex.type === 'listen' ? { ...ex, type: 'choose' } : ex, response);
      const orig = ex._orig || ex;
      // Điểm và lịch ôn chỉ tính lần làm đầu; lần làm lại để sửa sai.
      if (!ex._orig) {
        results.push({ question: ex, correct: ok, response });
        onAnswer?.(ex, ok, response);
        onStep?.(i + 1, results); // lưu ngay: thoát lúc đang xem kết quả câu này cũng không phải làm lại
      }
      else if (ok) { const r = results.find((x) => x.question === orig); if (r) r.fixed = true; }
      progress(i, queue.length, 1); // trả lời xong: thanh chạy lên ngay
      body.querySelectorAll('button, input').forEach((b) => { b.disabled = true; });
      if (mode === 'test') { i++; next(); return; }
      mark(ok);
      const answer = ex.type === 'speak' ? (response.transcript ? `Máy nghe được: ${response.transcript}` : ex.target) : answerText(ex);
      const extra = ex.type === 'sheet' ? h('div', { class: 'score-line' }, `Viết đạt ${response.passed}/${response.reps} lần · trung bình ${Math.round(response.score * 100)}%`)
        : ex.type === 'freewrite' ? freewriteFeedback(ex, response) : ex.type === 'draw' || ex.type === 'compose' ? h('div', {}, h('div', { class: 'score-line' }, `Điểm: ${Math.round(response.score * 100)}%`, response.hinted ? ' · đã xem gợi ý' : response.guided ? ' · có tô theo mẫu' : ''),
        ex.type === 'draw' && !ok ? h('div', { class: 'sheet-strokes' }, strokeViewer(ex.hanzi, { size: 84 })) : null) : null;
      shell.showSheet({
        ok,
        title: ok ? pickPraise() : 'Chưa đúng',
        detail: h('div', {},
          ok || ex.type === 'freewrite' ? null : h('div', {}, 'Đáp án đúng: ', h('strong', { class: isHan(answer) ? 'han' : '' }, answer)),
          extra,
          ex.explanation ? h('div', { class: 'muted', style: { marginTop: '4px' } }, ex.explanation) : null),
        onContinue: () => { i++; next(); },
        // Làm lại ngay câu vừa sai (điểm vẫn tính lần đầu).
        onRetry: !ok && mode === 'practice' ? () => render({ ...orig, _orig: orig }) : null,
      });
    }
    checkBtn.onclick = submit;

    if (ex.compose) {
      // Ghép thành phần: thành phần in to, nối bằng dấu +, bố cục và nghĩa gợi ý bên dưới.
      body.append(h('div', { class: 'ask-card' },
        h('div', { class: 'ask-cap' }, h('span', {}, 'Thành phần'), ex.compose.struct ? h('span', { class: 'ask-n' }, ex.compose.struct) : null),
        h('div', { class: 'ask-parts' }, ex.compose.parts.map((p, k) => [k ? h('span', { class: 'ap-plus' }, '+') : null, h('span', { class: 'ap-part han', lang: 'zh-CN' }, p)])),
        ex.hint ? h('div', { class: 'ask-sub' }, ex.hint) : null));
    }
    if (ex.type === 'choose' || ex.type === 'listen') {
      let picked = null;
      // Lưới 2 cột chỉ cho đáp án chữ Hán ngắn; câu dài xếp mỗi đáp án một hàng.
      const hanOpts = ex.options.every((o) => isHan(o) && [...o].length <= 5);
      const opts = ex.options.map((o, k) => h('button', {
        class: ['chip', isHan(o) ? 'han' : ''], type: 'button', dataset: { v: o },
        onclick: () => { picked = o; opts.forEach((b) => b.classList.toggle('selected', b.dataset.v === o)); setReady(true); if (isHan(o)) speak(o, rate); },
      }, o));
      if (ex.type === 'listen') {
        const play = () => speak(ex.speak, rate);
        body.append(
          h('div', { class: 'center' },
            h('button', { class: 'btn primary listen-btn', type: 'button', 'aria-label': 'Nghe lại', onclick: play }, icon('speaker')),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(ex.speak, 0.5) }, 'Nghe chậm')));
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
    } else if (ex.type === 'study') {
      // Thẻ xem từ mới: chữ, pinyin, nghĩa, nghe, thứ tự nét (không chấm điểm).
      body.append(h('div', { class: 'study-card' },
        h('div', { class: 'sc-word han', lang: 'zh-CN' }, ex.hanzi),
        h('div', { class: 'sc-py' }, ex.pinyin, h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe', onclick: () => speak(ex.hanzi, rate) }, icon('speaker'))),
        h('div', { class: 'sc-vi' }, ex.meaning),
        strokeViewer(ex.hanzi, { size: [...ex.hanzi].length > 2 ? 96 : 130 }),
        charAnatomy(ex.hanzi, { pinyin: ex.pinyin, meaning: ex.meaning })));
      setTimeout(() => speak(ex.hanzi, rate), 300);
      checkBtn.textContent = 'Đã xem, viết thử';
      getResponse = () => ({ ok: true });
      setReady(true);
    } else if (ex.type === 'sheet') {
      // Trang tập viết: một từ viết nhiều lần; các ô đầu có mẫu mờ, các ô sau tự viết.
      const reps = ex.reps || 5;
      const counter = h('span', { class: 'ask-n' }, `0/${reps}`);
      const area = sheetArea(ex.hanzi, reps, { onChange: (n) => { counter.textContent = `${n}/${reps}`; setReady(n === reps); } });
      body.append(h('div', { class: 'ask-card ws-head' },
        h('div', { class: 'ask-cap' }, h('span', {}, `Viết ${reps} lần`), counter),
        h('div', { class: 'ws-word' },
          strokeViewer(ex.hanzi, { size: 76 }),
          h('div', { class: 'ws-info' },
            h('div', { class: 'ask-main py' }, ex.pinyin, h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe', onclick: () => speak(ex.hanzi, rate) }, icon('speaker'))),
            h('div', { class: 'ask-sub' }, ex.meaning)))),
        area.el);
      setTimeout(() => speak(ex.hanzi, rate), 300);
      getResponse = () => {
        const scores = area.scores();
        const passed = scores.filter((x) => x >= PASS_INK).length;
        const score = area.score();
        return { score, passed, reps, ok: passed >= Math.ceil(reps * 0.6) };
      };
      mark = () => area.showAnswer();
    } else if (ex.type === 'draw') {
      // Viết chữ bằng tay. mode: trace (viết theo mẫu) | meaning (chỉ nghĩa) | pinyin (chỉ pinyin) | listen (chỉ nghe) | mặc định (nghĩa + pinyin, có nút tô mẫu).
      const m = ex.mode;
      const area = writeArea(ex.hanzi, { onChange: (full) => setReady(full), guide: m === 'trace' ? 'on' : m ? 'hint' : 'toggle' });
      const sayBtn = h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe', onclick: () => speak(ex.hanzi, rate) }, icon('speaker'));
      // Thẻ đề: nhãn nhỏ (đề cho gì) + nội dung lớn + số chữ cần viết.
      const nChars = [...ex.hanzi].length;
      const ask = (cap, main, extra = null) => h('div', { class: 'ask-card' },
        h('div', { class: 'ask-cap' }, h('span', {}, cap), h('span', { class: 'ask-n' }, `${nChars} chữ`)),
        main, extra);
      const hint = m === 'meaning' ? ask('Nghĩa', h('div', { class: 'ask-main' }, ex.meaning))
        : m === 'pinyin' ? ask('Pinyin', h('div', { class: 'ask-main py' }, ex.pinyin))
        : m === 'listen' ? ask('Nghe', h('div', { class: 'ask-listen' }, h('button', { class: 'btn primary listen-btn', type: 'button', 'aria-label': 'Nghe lại', onclick: () => speak(ex.hanzi, rate) }, icon('speaker')), h('button', { class: 'btn ghost', type: 'button', onclick: () => speak(ex.hanzi, 0.5) }, 'Nghe chậm')))
        : m === 'trace' ? ask('Viết theo mẫu', h('div', { class: 'ask-main py' }, ex.pinyin, sayBtn), h('div', { class: 'ask-sub' }, ex.meaning))
        : h('div', { class: 'hw-hint' }, h('span', { class: 'hw-py' }, ex.pinyin), sayBtn);
      if (m === 'listen') setTimeout(() => speak(ex.hanzi, rate), 300);
      body.append(hint, area.el);
      // Đã xem gợi ý thì tính là chưa nhớ (từ được đưa vào danh sách ôn).
      getResponse = () => { const score = area.score(); return { score, ok: score >= PASS_INK && !area.usedHint?.(), guided: area.usedGuide(), hinted: area.usedHint?.() }; };
      mark = (ok) => area.showAnswer(ok);
    } else if (ex.type === 'freewrite') {
      // Đặt câu tự do với từ vừa học: kiểm tra có dùng từ, dịch máy câu của người học để tự đối chiếu, kèm câu mẫu.
      body.append(h('div', { class: 'ask-card' },
        h('div', { class: 'ask-cap' }, h('span', {}, 'Đặt câu với từ'), h('span', { class: 'ask-n' }, 'tự do')),
        h('div', { class: 'ask-main' }, h('span', { class: 'han', lang: 'zh-CN' }, ex.word), h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe', onclick: () => speak(ex.word, rate) }, icon('speaker'))),
        h('div', { class: 'ask-sub' }, `${ex.pinyin} · ${ex.meaning}`)));
      const input = h('textarea', { class: 'compose-input han', lang: 'zh-CN', rows: 2, autocomplete: 'off', spellcheck: false, 'aria-label': 'Câu của bạn' });
      input.addEventListener('input', () => setReady(input.value.trim() !== ''));
      body.append(input);
      getResponse = () => {
        const text = input.value.trim();
        if (!text) return null;
        const used = text.includes(ex.word);
        const long = [...text.replace(/[\s，。？！,.?!]/g, '')].length >= [...ex.word].length + 2;
        return { text, used, long, ok: used && long, score: used && long ? 1 : used ? 0.5 : 0 };
      };
      setTimeout(() => input.focus(), 50);
    } else if (ex.type === 'compose') {
      // Viết câu: đọc nghĩa tiếng Việt, tự gõ câu tiếng Trung (bàn phím chữ Hán / viết tay của điện thoại), máy chấm theo từng chữ.
      const input = h('textarea', { class: 'compose-input han', lang: 'zh-CN', rows: 2, autocomplete: 'off', spellcheck: false, 'aria-label': 'Câu tiếng Trung' });
      const diffBox = h('div', { class: 'compose-diff hidden' });
      input.addEventListener('input', () => setReady(input.value.trim() !== ''));
      body.append(input, diffBox);
      getResponse = () => { if (!input.value.trim()) return null; const r = gradeSentence(input.value, ex.answer); return { ...r, text: input.value }; };
      mark = () => {
        const r = gradeSentence(input.value, ex.answer);
        diffBox.replaceChildren(...r.diff.map((d) => h('span', { class: ['cd', d.kind], lang: 'zh-CN' }, d.ch)));
        diffBox.classList.remove('hidden');
      };
      setTimeout(() => input.focus(), 50);
    } else if (ex.type === 'pinyin') {
      const input = h('input', { type: 'text', class: 'py-input', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'done', 'aria-label': 'Pinyin', placeholder: 'vd: ni hao' });
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

/** Hỏi đáp: bong bóng câu hỏi (nghe lại, nghĩa) + yêu cầu. */
function qaBubble(ex, rate) {
  return h('div', { class: 'qa-ask' },
    h('div', { class: 'qa-bubble' },
      h('button', { class: 'btn tinted icon-only', type: 'button', 'aria-label': 'Nghe câu hỏi', onclick: () => speak(ex.qa.q.zh, rate) }, icon('speaker')),
      h('div', { class: 'grow' }, h('div', { class: 'han qa-zh', lang: 'zh-CN' }, ex.qa.q.zh), h('div', { class: 'qa-vi' }, ex.qa.q.vi))),
    ex.ask ? h('div', { class: 'ex-prompt qa-req' }, ex.ask) : null);
}

function renderPrompt(text) {
  return text.split(/(\p{Script=Han}[\p{Script=Han}＿_\s，。？！、…—]*)/u).filter(Boolean)
    .map((part) => (isHan(part) ? h('span', { class: 'han', lang: 'zh-CN' }, part) : part));
}

/** Phản hồi đặt câu: dùng từ chưa, độ dài, bản dịch máy câu của người học (để tự kiểm tra ý), câu mẫu trong bài. */
function freewriteFeedback(ex, r) {
  const tr = h('div', { class: 'fw-tr' }, h('span', { class: 'spinner sm' }), 'Đang dịch câu của bạn…');
  translateZhVi(r.text).then((t) => tr.replaceChildren(t ? h('span', {}, h('small', {}, 'Máy dịch câu của bạn: '), h('b', {}, t.text)) : h('small', {}, 'Chưa dịch được (cần mạng).')));
  return h('div', { class: 'fw-fb' },
    h('div', { class: ['fw-check', r.used ? 'ok' : 'no'] }, r.used ? `Đã dùng từ ${ex.word}` : `Câu chưa có từ ${ex.word}`),
    r.used && !r.long ? h('div', { class: 'fw-check no' }, 'Câu hơi ngắn, thêm chủ ngữ / tân ngữ nhé') : null,
    tr,
    ex.sample ? h('div', { class: 'fw-sample' }, h('small', {}, 'Câu mẫu trong bài: '), h('span', { class: 'han', lang: 'zh-CN' }, ex.sample.zh), ex.sample.vi ? h('span', { class: 'muted' }, ` – ${ex.sample.vi}`) : null) : null);
}
