// Câu ví dụ cho thẻ từ: dữ liệu từ vựng không có sẵn ví dụ, nên lấy câu có chứa từ trong bài khóa
// và ví dụ ngữ pháp của sách. Ưu tiên câu của chính bài, rồi bài trước; câu ngắn, không chỉ có mỗi từ đó. Hàm thuần.

const clean = (s) => String(s || '').replace(/（.*?）|\(.*?\)/g, '').trim();
const bare = (s) => String(s || '').replace(/[\s，。？！、；：,.?!;:“”"'‘’（）()…—-]/g, '');

/** Danh sách câu nguồn: [{ zh, vi, pinyin?, lessonIdx }]. */
export function exampleSources(lessons) {
  const out = [];
  lessons.forEach((l, lessonIdx) => {
    for (const t of l.texts || []) for (const ln of t.lines || []) {
      if (ln.zh && ln.vi) out.push({ zh: ln.zh, vi: String(ln.vi).replace(/^\([^)]*\)\s*/, ''), lessonIdx });
    }
    for (const g of l.grammar_points || []) for (const e of g.examples || []) {
      if (e.zh && e.vi) out.push({ zh: e.zh, vi: e.vi, pinyin: e.pinyin || null, lessonIdx });
    }
  });
  return out;
}

/**
 * Câu ví dụ tốt nhất cho card (null nếu không có). lessonIdx: vị trí bài của từ trong danh sách bài.
 * words(zh) (tùy chọn): tách câu thành từ; câu mà từ chỉ nằm trong một từ dài hơn (多 trong 多少) bị xếp sau.
 */
export function pickExample(card, sources, lessonIdx = -1, words = null) {
  const word = clean(card.hanzi);
  if (!word) return null;
  let best = null;
  let bestScore = Infinity;
  for (const s of sources) {
    if (!s.zh.includes(word)) continue;
    const len = [...bare(s.zh)].length;
    let score = 0;
    // Bài: cùng bài tốt nhất, bài trước kém dần, bài sau (chưa học) kém nhất.
    if (lessonIdx >= 0) score += s.lessonIdx === lessonIdx ? 0 : s.lessonIdx < lessonIdx ? 2 + (lessonIdx - s.lessonIdx) * 0.15 : 6 + (s.lessonIdx - lessonIdx) * 0.1;
    // Độ dài: đẹp nhất 5–14 chữ; câu chỉ có mỗi từ đó thì xếp sau cùng.
    if (bare(s.zh) === word) score += 8;
    else if (len < 4) score += 2;
    else if (len > 18) score += (len - 18) * 0.3;
    if (s.pinyin) score -= 0.3;
    if (words && !words(s).includes(word)) score += 10;
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best ? { zh: best.zh, vi: best.vi, pinyin: best.pinyin || null } : null;
}

const cache = new WeakMap();
/** Tiện dụng: ví dụ cho card theo dữ liệu loadAll (nguồn câu được lưu tạm theo danh sách bài). */
export function exampleForCard(card, lessons, segment = null) {
  if (card.example) return { zh: card.example, vi: card.example_meaning || '', pinyin: card.example_pinyin || null };
  let src = cache.get(lessons);
  if (!src) { src = exampleSources(lessons); cache.set(lessons, src); }
  // Tách từ mỗi câu một lần (lưu trên chính câu nguồn).
  const words = segment ? (s) => (s.words ||= segment(s.zh)) : null;
  return pickExample(card, src, lessons.findIndex((l) => l.id === card.lesson_id), words);
}
