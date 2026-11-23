// Nội dung học lấy thẳng từ data/ (đóng gói thành content/pack.json khi build).
// Khi app mở: nếu phiên bản nội dung khác lần trước → gộp vào IndexedDB (giữ nguyên tiến độ học).

import { loadContentFiles } from './core/importer.js';

export const CONTENT_URL = './content/pack.json';
export const audioUrl = (lessonId) => `./content/audio/${encodeURIComponent(lessonId)}.mp3`;

export async function syncContent(repo, settings) {
  let text;
  try {
    const res = await fetch(CONTENT_URL, { cache: 'no-cache' });
    if (!res.ok) return { status: 'missing' };
    text = await res.text();
  } catch {
    return { status: 'offline' };
  }
  let version = null;
  try { version = JSON.parse(text).content_version || null; } catch { return { status: 'invalid' }; }
  const empty = (await repo.count('cards')) === 0;
  if (!empty && version && settings.content_version === version) return { status: 'up-to-date', version };
  const r = loadContentFiles([{ name: 'pack.json', text }]);
  if (r.errors.length) {
    console.warn('[content] gói nội dung có lỗi', r.errors);
    return { status: 'invalid', errors: r.errors };
  }
  await repo.importContent(r);
  await repo.saveSettings({ content_version: version });
  return { status: empty ? 'installed' : 'updated', version, counts: r.counts };
}

/** URL file nghe của bài trong content/audio/ (null nếu không có). */
export async function lessonAudioSrc(lessonId) {
  if (!lessonId) return null;
  const url = audioUrl(lessonId);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok && /audio|octet/.test(res.headers.get('content-type') || 'audio') ? url : null;
  } catch {
    return null;
  }
}
