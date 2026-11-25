// Học qua bài hát / thoại phim: đọc lời dán vào (có thể kèm mốc thời gian kiểu LRC), lấy id video YouTube. Hàm thuần.

const TIME_RX = /^\s*\[?(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]?\s*/;

/** "[01:02.50] 歌词" | "1:02 歌词" | "歌词" → { text, t: giây | null }. Dòng có nhiều mốc (LRC lặp điệp khúc) lấy mốc đầu. */
export function parseLine(raw) {
  let s = String(raw ?? '');
  let t = null;
  let m;
  while ((m = s.match(TIME_RX))) {
    const sec = Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0);
    if (t == null) t = sec;
    s = s.slice(m[0].length);
  }
  return { text: s.trim(), t };
}

const META_RX = /^\s*\[(ti|ar|al|by|offset|length|re|ve):/i;

/**
 * Lời dán vào (mỗi dòng một câu, dòng trống tách đoạn) + bản dịch (không bắt buộc, cùng thứ tự dòng)
 * → paragraphs cho bài đọc: [{ id, sentences: [{ id, hanzi, meaning, t }] }]. Bỏ dòng thẻ LRC ([ti:], [ar:]…).
 */
export function lyricsToParagraphs(zhText, viText = '') {
  const vi = String(viText || '').split(/\r?\n/).map((l) => parseLine(l).text).filter((l) => l !== '');
  const paras = [];
  let cur = [];
  let k = 0;
  for (const raw of String(zhText || '').split(/\r?\n/)) {
    if (META_RX.test(raw)) continue;
    const { text, t } = parseLine(raw);
    if (!text) { if (cur.length) { paras.push(cur); cur = []; } continue; }
    // Thoại: "A：你好" / "小王: 你好" → người nói riêng (để hiện avatar và đổi giọng).
    const sp = text.match(/^([A-Za-z㐀-鿿]{1,6})\s*[：:]\s*(.+)$/);
    const vt = (vi[k] || '').replace(/^([A-Za-zÀ-ỹ㐀-鿿 ]{1,12})\s*[：:]\s*/, sp ? '' : '$&');
    cur.push(sp ? { hanzi: sp[2], speaker: sp[1], meaning: vt, t } : { hanzi: text, meaning: vi[k] || '', t });
    k++;
  }
  if (cur.length) paras.push(cur);
  return paras.map((ss, pi) => ({ id: `p${pi + 1}`, sentences: ss.map((st, si) => ({ id: `s${pi + 1}-${si + 1}`, ...st })) }));
}

/** Id video YouTube từ link (watch?v=, youtu.be/, shorts/, embed/) hoặc null. */
export function youtubeId(url) {
  const s = String(url || '').trim();
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(s) ? s : null);
}

/** Giây → "m:ss". */
export const fmtTime = (t) => (t == null ? '' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
