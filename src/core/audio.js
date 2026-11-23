// Đoán mã bài từ tên file nghe: "Quyển 1 Bài 3.mp3" → "L03", "L12.mp3" → "L12".
export function lessonIdFromAudioName(name) {
  const base = name.normalize('NFC').replace(/\.[^.]+$/, '');
  if (/^L\d+$/i.test(base)) return `L${String(Number(base.slice(1))).padStart(2, '0')}`;
  const m = base.match(/b[àa]i\s*0*(\d+)/i) || base.match(/lesson\s*0*(\d+)/i) || base.match(/(\d+)\s*$/);
  return m ? `L${String(Number(m[1])).padStart(2, '0')}` : null;
}
