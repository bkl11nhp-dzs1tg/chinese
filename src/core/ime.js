// Bộ gõ pinyin → chữ Hán (nhỏ, chạy offline): từ điển dựng từ từ vựng giáo trình + mọi chữ xuất hiện trong bài.
// Gõ không cần dấu: "nihao" → 你好, "ni" → 你/呢/…; gõ số thanh "ni3" để lọc thanh; v = ü. Hàm thuần.

const TONE_MAP = { ā: 'a1', á: 'a2', ǎ: 'a3', à: 'a4', ē: 'e1', é: 'e2', ě: 'e3', è: 'e4', ī: 'i1', í: 'i2', ǐ: 'i3', ì: 'i4', ō: 'o1', ó: 'o2', ǒ: 'o3', ò: 'o4', ū: 'u1', ú: 'u2', ǔ: 'u3', ù: 'u4', ǖ: 'v1', ǘ: 'v2', ǚ: 'v3', ǜ: 'v4', ü: 'v' };

/** "nǐ hǎo" → { plain: "nihao", toned: "ni3hao3" } (toned: số thanh sau mỗi âm tiết; không chắc ranh giới thì đặt sau nguyên âm có dấu). */
export function normPinyin(py) {
  let plain = '';
  let toned = '';
  for (const raw of String(py || '').toLowerCase().normalize('NFC').split(/[\s'’·\-]+/).filter(Boolean)) {
    let syl = '';
    let tone = '';
    for (const ch of raw) {
      const m = TONE_MAP[ch];
      if (m) { syl += m[0]; if (m[1]) tone = m[1]; } else if (/[a-z]/.test(ch)) syl += ch;
    }
    plain += syl;
    toned += syl + tone;
  }
  return { plain, toned };
}

/** Câu gõ của người dùng: bỏ khoảng trắng/dấu nháy, ü→v, chữ thường. */
export const normQuery = (q) => String(q || '').toLowerCase().replace(/ü/g, 'v').replace(/[\s'’]/g, '');

/**
 * entries: [{ hanzi, pinyin, weight? }] (từ vựng + chữ lẻ). Trả về { lookup(query, limit) }.
 * Thứ tự: khớp đúng toàn bộ > khớp đầu; trong mỗi nhóm: weight cao, từ ngắn trước.
 */
export function buildIme(entries) {
  const list = [];
  const seen = new Set();
  for (const e of entries) {
    const hz = String(e.hanzi || '').replace(/（.*?）|\(.*?\)/g, '').trim();
    if (!hz || !/^[㐀-鿿]+$/.test(hz)) continue;
    const { plain, toned } = normPinyin(e.pinyin);
    if (!plain) continue;
    const key = `${hz}|${plain}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ hanzi: hz, plain, toned, weight: e.weight || 0, len: [...hz].length });
  }
  return {
    size: list.length,
    lookup(query, limit = 24) {
      const q = normQuery(query);
      if (!q) return [];
      const hasTone = /\d/.test(q);
      const plainQ = q.replace(/\d/g, '');
      const scored = [];
      for (const it of list) {
        let rank = -1;
        if (hasTone) {
          if (it.toned === q) rank = 3; else if (it.toned.startsWith(q)) rank = 1;
        } else if (it.plain === plainQ) rank = 3;
        else if (it.plain.startsWith(plainQ)) rank = 1;
        if (rank < 0) continue;
        scored.push({ it, s: rank * 1000 + it.weight * 10 - it.len });
      }
      scored.sort((a, b) => b.s - a.s);
      const out = [];
      const dup = new Set();
      for (const { it } of scored) { if (dup.has(it.hanzi)) continue; dup.add(it.hanzi); out.push(it.hanzi); if (out.length >= limit) break; }
      return out;
    },
  };
}
