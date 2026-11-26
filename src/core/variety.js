// Chống lặp: nhớ lần gần nhất mỗi từ / câu xuất hiện trong luyện tập, trò chơi, luyện viết,
// rồi ưu tiên thứ lâu chưa gặp (chưa gặp bao giờ đứng đầu), vẫn trộn ngẫu nhiên để không đoán trước được.

const KEY = 'chinese-seen-v1';
const DAY = 86_400_000;
const MAX_PER_NS = 4000;

/**
 * Xếp hạng thuần: items → mảng mới, thứ lâu chưa gặp lên trước.
 * seen: { [key]: [lastSeenMs, count] }. bonus(item) cộng thêm điểm ưu tiên (vd. từ hay sai).
 */
export function rankFresh(items, seen = {}, { key = (x) => x.id, now = Date.now(), rand = Math.random, bonus = null } = {}) {
  const scored = items.map((it) => {
    const s = seen[key(it)];
    // Chưa gặp: 10 điểm. Đã gặp: số ngày kể từ lần gặp (tối đa 7), trừ nhẹ theo số lần đã gặp.
    const base = s ? Math.min((now - s[0]) / DAY, 7) - Math.min(s[1], 20) * 0.03 : 10;
    return { it, v: base + rand() * 1.2 + (bonus ? bonus(it) : 0) };
  });
  return scored.sort((a, b) => b.v - a.v).map((x) => x.it);
}

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function saveAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* bộ nhớ đầy / chặn: bỏ qua */ }
}

/** Bảng "đã gặp" của một nhóm (vd. 'w' từ vựng, 'line' câu, 'recall' luyện viết). */
export function seenMap(ns) {
  return loadAll()[ns] || {};
}

/** Ghi nhận các khóa vừa xuất hiện. */
export function markSeen(ns, keys, now = Date.now()) {
  const list = [...new Set(keys)].filter((k) => k != null && k !== '');
  if (!list.length) return;
  const all = loadAll();
  const m = all[ns] || {};
  for (const k of list) m[k] = [now, ((m[k] && m[k][1]) || 0) + 1];
  const ks = Object.keys(m);
  if (ks.length > MAX_PER_NS) {
    ks.sort((a, b) => m[a][0] - m[b][0]).slice(0, ks.length - MAX_PER_NS).forEach((k) => delete m[k]);
  }
  all[ns] = m;
  saveAll(all);
}

/** Tiện dụng: xếp hạng theo bảng đã lưu của nhóm ns. */
export function freshOrder(items, ns, opts = {}) {
  return rankFresh(items, seenMap(ns), opts);
}
