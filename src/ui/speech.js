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

// Giọng nữ/nam: dùng giọng riêng nếu máy có (Edge/Windows: Xiaoxiao, Yunxi…; iOS: Tingting…),
// không có thì dùng cùng một giọng nhưng đổi cao độ để vẫn phân biệt được hai người nói.
const FEMALE = /Xiaoxiao|Xiaoyi|Xiaohan|Xiaomo|Xiaoxuan|Xiaorui|Huihui|Yaoyao|Tingting|Meijia|Sinji|Lili|female|女/i;
const MALE = /Yunxi|Yunyang|Yunjian|Yunfeng|Yunhao|Yunze|Kangkang|Liang|male|男/i;
export async function genderVoice(gender) {
  const voices = await loadVoices();
  const zh = voices.filter((v) => /^zh[-_](CN|Hans)/i.test(v.lang) || /^cmn/i.test(v.lang));
  const isFemale = (v) => FEMALE.test(v.name);
  const isMale = (v) => MALE.test(v.name) && !/female/i.test(v.name);
  return zh.find(gender === 'male' ? isMale : isFemale) || null;
}

/** speak(text, rate, { gender: 'female'|'male' }) */
export async function speak(text, rate = 1, { gender = null } = {}) {
  if (!ttsSupported() || !text) return false;
  let voice = gender ? await genderVoice(gender) : null;
  let exact = !!voice;
  if (!voice && gender) {
    // Không có giọng nam/nữ rõ ràng: nếu máy có ≥2 giọng tiếng Trung thì mỗi người một giọng.
    const zh = (await loadVoices()).filter((v) => /^zh[-_](CN|Hans)/i.test(v.lang) || /^cmn/i.test(v.lang));
    if (zh.length >= 2) { voice = gender === 'male' ? zh[1] : zh[0]; exact = false; }
  }
  if (!voice) voice = await chineseVoice();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  if (voice) u.voice = voice;
  u.rate = rate;
  if (gender && !exact) { u.pitch = gender === 'male' ? 0.5 : 1.45; if (gender === 'male') u.rate = rate * 0.95; }
  speechSynthesis.speak(u);
  return !!voice;
}
