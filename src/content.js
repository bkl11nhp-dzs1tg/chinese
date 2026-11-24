// Nội dung học lấy thẳng từ data/ (đóng gói thành content/pack.json khi build).
// Khi app mở: nếu phiên bản nội dung khác lần trước → gộp vào IndexedDB (giữ nguyên tiến độ học).

import { loadContentFiles } from './core/importer.js';

export const CONTENT_URL = './content/pack.json';
import { loadAccount } from './sync.js';

export const audioUrl = (lessonId) => `./content/audio/${encodeURIComponent(lessonId)}.mp3`;
/** MP3 từ kho R2 qua Worker đồng bộ (cần đăng nhập). */
export const remoteAudioUrl = (lessonId) => {
  const a = loadAccount();
  return a?.url && a?.token ? `${a.url}/api/audio/${encodeURIComponent(lessonId)}.mp3?t=${encodeURIComponent(a.token)}` : null;
};

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
  const ok = async (u) => {
    try {
      const res = await fetch(u, { method: 'HEAD' });
      return res.ok && /audio|octet/.test(res.headers.get('content-type') || 'audio');
    } catch { return false; }
  };
  const local = audioUrl(lessonId);
  if (await ok(local)) return local;
  const remote = remoteAudioUrl(lessonId);
  return remote && (await ok(remote)) ? remote : null;
}
