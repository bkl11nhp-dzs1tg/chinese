// Dịch tự động Trung → Việt cho từ/câu chưa có nghĩa sẵn.
// Google Dịch (endpoint công khai, không cần khóa) → dự phòng MyMemory. Lưu kết quả vào localStorage để tra lại không cần mạng.

const CACHE_KEY = 'chinese-mt-cache';
const MAX_CACHE = 3000;
let cache = null;
const load = () => {
  if (cache) return cache;
  try { cache = JSON.parse(globalThis.localStorage?.getItem(CACHE_KEY) || '{}'); } catch { cache = {}; }
  return cache;
};
const save = () => {
  try {
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE) for (const k of keys.slice(0, keys.length - MAX_CACHE)) delete cache[k];
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* bộ nhớ đầy: bỏ qua */ }
};

/** Kết quả Google gtx: [[["bản dịch","gốc",…],…],…] → chuỗi dịch. */
export function parseGoogle(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
  return data[0].map((seg) => (Array.isArray(seg) ? seg[0] || '' : '')).join('').trim();
}

async function google(text, fetchImpl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`google ${res.status}`);
  return parseGoogle(await res.json());
}
async function mymemory(text, fetchImpl) {
  const res = await fetchImpl(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-CN|vi`);
  if (!res.ok) throw new Error(`mymemory ${res.status}`);
  const d = await res.json();
  return String(d?.responseData?.translatedText || '').trim();
}

/** Dịch text tiếng Trung sang tiếng Việt. Trả về { text, source } hoặc null nếu không dịch được (offline…). */
export async function translateZhVi(text, { fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  const q = String(text || '').trim();
  if (!q) return null;
  const c = load();
  if (c[q]) return { text: c[q], source: 'cache' };
  for (const [name, fn] of [['Google Dịch', google], ['MyMemory', mymemory]]) {
    try {
      const t = await fn(q, fetchImpl);
      if (t && t !== q) { c[q] = t; save(); return { text: t, source: name }; }
    } catch { /* thử nguồn tiếp theo */ }
  }
  return null;
}
