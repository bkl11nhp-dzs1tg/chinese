// Chấm bài tập (mục 9.4) và tạo bài tập tự động từ từ vựng của bài.

/** Chuẩn hóa câu trả lời điền chỗ trống: NFC, bỏ khoảng trắng thừa, bỏ dấu câu cuối, không phân biệt hoa thường. */
export function normalizeAnswer(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[　\s]+/g, ' ')
    .trim()
    .replace(/[。．.!！?？,，、;；:：]+$/u, '')
    .trim()
    .toLowerCase()
    // giữa hai chữ Hán thì khoảng trắng không có nghĩa
    .replace(/(\p{Script=Han})\s+(?=\p{Script=Han})/gu, '$1');
}

export function gradeChoose(ex, picked) {
  return picked === ex.answer;
}

export function gradeFill(ex, typed) {
  const answers = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
  const t = normalizeAnswer(typed);
  return t !== '' && answers.some((a) => normalizeAnswer(a) === t);
}

/** pieces: mảng mảnh theo thứ tự người dùng xếp. */
export function gradeReorder(ex, pieces) {
  const want = Array.isArray(ex.answer) ? ex.answer.join('') : ex.answer;
  return normalizeAnswer(pieces.join('')) === normalizeAnswer(want);
}

/** matches: Map/obj left → right người dùng ghép. */
export function gradeMatch(ex, matches) {
  const get = (k) => (matches instanceof Map ? matches.get(k) : matches[k]);
  return ex.pairs.every((p) => get(p.left) === p.right);
}

export function grade(ex, response) {
  switch (ex.type) {
    case 'choose': return gradeChoose(ex, response);
    case 'fill': return gradeFill(ex, response);
    case 'reorder': return gradeReorder(ex, response);
    case 'match': return gradeMatch(ex, response);
    default: throw new Error(`Dạng bài tập không hỗ trợ: ${ex.type}`);
  }
}

/** Câu trả lời đúng dạng chữ để hiển thị khi sai. */
export function answerText(ex) {
  if (ex.type === 'match') return ex.pairs.map((p) => `${p.left} = ${p.right}`).join(' · ');
  if (Array.isArray(ex.answer)) return ex.type === 'reorder' ? ex.answer.join('') : ex.answer.join(' / ');
  return ex.answer;
}

// ---------------------------------------------------------------------------
// Ngẫu nhiên có hạt giống để test lặp lại được.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lấy n phần tử khác `exclude` theo khóa. */
function distractors(pool, correct, key, n, rand) {
  const seen = new Set([correct[key]]);
  const out = [];
  for (const c of shuffle(pool, rand)) {
    if (out.length >= n) break;
    if (!seen.has(c[key])) { seen.add(c[key]); out.push(c[key]); }
  }
  return out;
}

/**
 * Tạo bài tập trắc nghiệm từ từ vựng: chữ Hán → nghĩa, nghĩa → chữ Hán, bính âm → chữ Hán.
 * lessonCards: từ của bài; pool: kho từ để lấy phương án nhiễu (nên rộng hơn bài).
 */
export function autoExercises(lessonCards, pool, { rand = Math.random, lessonId = null } = {}) {
  const out = [];
  const kinds = ['hanzi-meaning', 'meaning-hanzi', 'pinyin-hanzi'];
  lessonCards.forEach((card, i) => {
    const kind = kinds[i % kinds.length];
    let prompt, answer, key;
    if (kind === 'hanzi-meaning') { prompt = `“${card.hanzi}” nghĩa là gì?`; answer = card.meaning; key = 'meaning'; }
    else if (kind === 'meaning-hanzi') { prompt = `Chữ nào nghĩa là “${card.meaning}”?`; answer = card.hanzi; key = 'hanzi'; }
    else { prompt = `Chữ nào đọc là “${card.pinyin}”?`; answer = card.hanzi; key = 'hanzi'; }
    const others = distractors(pool.filter((c) => c.id !== card.id), card, key, 3, rand);
    if (others.length < 1) return;
    out.push({
      id: `auto-${card.id}-${kind}`,
      lesson_id: lessonId ?? card.lesson_id,
      type: 'choose',
      prompt,
      options: shuffle([answer, ...others], rand),
      answer,
      explanation: `${card.hanzi} (${card.pinyin}): ${card.meaning}`,
      card_ids: [card.id],
      auto: true,
    });
  });
  return out;
}

/** Thẻ liên quan đến bài tập: card_ids nếu có, nếu không thì các từ của bài xuất hiện trong đáp án/đề. */
export function relatedCardIds(ex, lessonCards) {
  if (ex.card_ids?.length) return ex.card_ids;
  const text = `${ex.prompt} ${answerText(ex)}`;
  return lessonCards
    .filter((c) => c.hanzi && text.includes(c.hanzi))
    .sort((a, b) => b.hanzi.length - a.hanzi.length)
    .slice(0, 3)
    .map((c) => c.id);
}
