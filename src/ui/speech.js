// Phát âm bằng speechSynthesis (mục 9.6). Nếu máy không có giọng zh-CN thì báo, không lỗi.

/** Các tốc độ đọc cho người học chọn (0.5× – 2×). */
export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

let voicesReady;
function loadVoices() {
  if (!('speechSynthesis' in globalThis)) return Promise.resolve([]);
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const v = speechSynthesis.getVoices();
      if (v.length) return resolve(v);
      const done = () => resolve(speechSynthesis.getVoices());
      speechSynthesis.addEventListener?.('voiceschanged', done, { once: true });
      setTimeout(done, 1500);
    });
  }
  return voicesReady;
}

export async function chineseVoice() {
  const voices = await loadVoices();
  const zh = voices.filter((v) => /^zh[-_](CN|Hans)/i.test(v.lang) || /^cmn/i.test(v.lang));
  return zh.find((v) => /Xiaoxiao|Yunxi|Google/i.test(v.name)) || zh[0] || voices.find((v) => /^zh/i.test(v.lang)) || null;
}

export function ttsSupported() {
  return 'speechSynthesis' in globalThis && 'SpeechSynthesisUtterance' in globalThis;
}

export async function speak(text, rate = 1) {
  if (!ttsSupported() || !text) return false;
  const voice = await chineseVoice();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
  return !!voice;
}
