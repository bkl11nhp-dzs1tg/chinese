// Cấu tạo chữ Hán: đọc mã IDS (⿰亻尔…), tên bộ thủ Hán Việt, tạo bài ghép thành phần. Hàm thuần.
// Dữ liệu: data/decomp.json (từ Make Me a Hanzi, LGPL): { 字: { d, r, t, s, p, h, m, py } }.

/** Tên Hán Việt + nghĩa của các bộ thủ / thành phần hay gặp. */
export const RADICALS = {
  '亻': 'Nhân đứng – người', '人': 'Nhân – người', '入': 'Nhập – vào', '儿': 'Nhân đi – người', '口': 'Khẩu – miệng', '囗': 'Vi – vây quanh',
  '女': 'Nữ – phụ nữ', '子': 'Tử – con', '宀': 'Miên – mái nhà', '冖': 'Mịch – trùm', '心': 'Tâm – tim, lòng', '忄': 'Tâm đứng – lòng',
  '手': 'Thủ – tay', '扌': 'Thủ đứng – tay', '水': 'Thủy – nước', '氵': 'Ba chấm thủy – nước', '火': 'Hỏa – lửa', '灬': 'Bốn chấm hỏa – lửa',
  '木': 'Mộc – cây', '日': 'Nhật – mặt trời', '月': 'Nguyệt – trăng, thịt', '土': 'Thổ – đất', '金': 'Kim – kim loại', '钅': 'Kim – kim loại',
  '言': 'Ngôn – lời nói', '讠': 'Ngôn – lời nói', '辶': 'Sước – đi', '走': 'Tẩu – chạy', '足': 'Túc – chân', '⻊': 'Túc – chân',
  '目': 'Mục – mắt', '耳': 'Nhĩ – tai', '页': 'Hiệt – đầu', '食': 'Thực – ăn', '饣': 'Thực – ăn', '纟': 'Mịch – tơ', '糸': 'Mịch – tơ',
  '艹': 'Thảo – cỏ', '竹': 'Trúc – tre', '⺮': 'Trúc – tre', '米': 'Mễ – gạo', '田': 'Điền – ruộng', '力': 'Lực – sức', '刀': 'Đao – dao',
  '刂': 'Đao đứng – dao', '又': 'Hựu – tay, lại', '寸': 'Thốn – tấc', '工': 'Công – thợ', '大': 'Đại – to', '小': 'Tiểu – nhỏ', '⺌': 'Tiểu – nhỏ',
  '⺍': 'Tiểu – nhỏ', '山': 'Sơn – núi', '石': 'Thạch – đá', '王': 'Vương – vua, ngọc', '玉': 'Ngọc', '马': 'Mã – ngựa', '鸟': 'Điểu – chim',
  '鱼': 'Ngư – cá', '贝': 'Bối – tiền, vỏ sò', '车': 'Xa – xe', '门': 'Môn – cửa', '雨': 'Vũ – mưa', '衣': 'Y – áo', '衤': 'Y – áo',
  '示': 'Thị – thần', '礻': 'Thị – thần', '禾': 'Hòa – lúa', '白': 'Bạch – trắng', '立': 'Lập – đứng', '疒': 'Nạch – bệnh', '广': 'Nghiễm – mái hiên',
  '厂': 'Hán – sườn núi', '尸': 'Thi – thân người', '彳': 'Xích – bước', '攵': 'Phộc – đánh', '欠': 'Khiếm – thiếu', '火': 'Hỏa – lửa',
  '阝': 'Phụ / Ấp – gò, thành', '卩': 'Tiết – đốt', '冫': 'Băng – băng giá', '八': 'Bát – tám', '十': 'Thập – mười', '一': 'Nhất – một',
  '丨': 'Cổn – nét sổ', '丿': 'Phiệt – nét phẩy', '丶': 'Chủ – nét chấm', '乙': 'Ất', '二': 'Nhị – hai', '亠': 'Đầu – nắp', '几': 'Kỷ – ghế',
  '匕': 'Chủy – thìa', '勹': 'Bao – bọc', '冂': 'Quynh – vùng biên', '凵': 'Khảm – há miệng', '卜': 'Bốc – bói', '厶': 'Khư – riêng',
  '夕': 'Tịch – chiều tối', '夂': 'Tri – theo sau', '弓': 'Cung – cái cung', '戈': 'Qua – giáo', '户': 'Hộ – cửa', '方': 'Phương – vuông',
  '文': 'Văn – chữ', '斤': 'Cân – rìu', '止': 'Chỉ – dừng', '毛': 'Mao – lông', '气': 'Khí – hơi', '牛': 'Ngưu – trâu bò', '犭': 'Khuyển – chó',
  '犬': 'Khuyển – chó', '皿': 'Mãnh – bát đĩa', '矢': 'Thỉ – mũi tên', '穴': 'Huyệt – hang', '羊': 'Dương – dê', '老': 'Lão – già',
  '耂': 'Lão – già', '肉': 'Nhục – thịt', '自': 'Tự – tự mình', '舌': 'Thiệt – lưỡi', '见': 'Kiến – thấy', '角': 'Giác – sừng',
  '身': 'Thân – thân mình', '酉': 'Dậu – rượu', '里': 'Lý – làng', '青': 'Thanh – xanh', '非': 'Phi – không', '面': 'Diện – mặt',
  '风': 'Phong – gió', '高': 'Cao', '黑': 'Hắc – đen', '巾': 'Cân – khăn', '幺': 'Yêu – nhỏ', '廴': 'Dẫn – bước dài', '弋': 'Dặc – bắn',
  '彡': 'Sam – lông tóc', '爫': 'Trảo – móng vuốt', '父': 'Phụ – cha', '片': 'Phiến – mảnh', '生': 'Sinh – sống', '用': 'Dụng – dùng',
  '疋': 'Thất – chân', '癶': 'Bát – gạt ra', '皮': 'Bì – da', '罒': 'Võng – lưới', '而': 'Nhi', '至': 'Chí – đến', '色': 'Sắc – màu',
  '虫': 'Trùng – sâu bọ', '血': 'Huyết – máu', '西': 'Tây', '谷': 'Cốc – thung lũng', '豆': 'Đậu', '赤': 'Xích – đỏ', '辛': 'Tân – cay',
  '长': 'Trường – dài', '隹': 'Chuy – chim đuôi ngắn', '音': 'Âm – âm thanh', '首': 'Thủ – đầu', '香': 'Hương – thơm',
};

export const STRUCT = { '⿰': 'trái – phải', '⿱': 'trên – dưới', '⿲': 'trái – giữa – phải', '⿳': 'trên – giữa – dưới', '⿴': 'bao quanh', '⿵': 'bao trên', '⿶': 'bao dưới', '⿷': 'bao trái', '⿸': 'bao trên trái', '⿹': 'bao trên phải', '⿺': 'bao dưới trái', '⿻': 'chồng lên nhau' };
export const TYPE = { pictophonetic: 'Hình thanh', ideographic: 'Hội ý', pictographic: 'Tượng hình' };

const OPS = /[⿰-⿻]/;
/** Thành phần cấp một của mã IDS: "⿰亻尔" → { op: '⿰', parts: ['亻','尔'] }; "⿱⿱⺍冖子" → { op:'⿱', parts:['⺍冖'… ] } trả về lá. */
export function parseIds(ids) {
  const s = [...String(ids || '')];
  if (!s.length || !OPS.test(s[0])) return { op: null, parts: [] };
  const arity = (c) => (c === '⿲' || c === '⿳' ? 3 : 2);
  let i = 1;
  const read = () => { const c = s[i++]; if (c && OPS.test(c)) { const n = arity(c); let t = c; for (let k = 0; k < n; k++) t += read(); return t; } return c || ''; };
  const parts = [];
  for (let k = 0; k < arity(s[0]); k++) parts.push(read());
  return { op: s[0], parts };
}
/** Các thành phần lá (bỏ dấu cấu trúc, bỏ thành phần chưa xác định "？"). */
export const leaves = (ids) => [...String(ids || '')].filter((c) => !OPS.test(c) && c !== '？');

/** Mô tả một chữ: { ch, struct, type, parts:[{ch, name, isRadical, role}], hint, meaning, pinyin } hoặc null. */
export function describeChar(ch, data) {
  const x = data?.[ch];
  if (!x) return null;
  const { op, parts } = parseIds(x.d);
  const nameOf = (c) => RADICALS[c] || (data[c]?.m ? data[c].m.split(',')[0] : '');
  return {
    ch,
    struct: op ? STRUCT[op] : null,
    type: TYPE[x.t] || null,
    meaning: x.m || '',
    pinyin: x.py || '',
    hint: x.h || '',
    radical: x.r ? { ch: x.r, name: RADICALS[x.r] || nameOf(x.r) } : null,
    parts: parts.filter((p) => p && !/[？?]/.test(p)).map((p) => ({ ch: p, name: [...p].length > 1 ? '' : nameOf(p), isRadical: p === x.r, role: p === x.s ? 'nghĩa' : p === x.p ? 'âm' : null })),
  };
}

/**
 * Bài ghép thành phần: cho các thành phần (và nghĩa), chọn chữ đúng trong 4 chữ có thành phần giống nhau.
 * words: [{ id, hanzi, pinyin, meaning }]. Trả về câu hỏi dạng choose.
 */
export function buildComposeChars(words, data, { rand = Math.random, n = 6 } = {}) {
  const pool = Object.keys(data).filter((c) => data[c].d && leaves(data[c].d).length >= 2);
  const out = [];
  const seen = new Set();
  const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  for (const w of shuffle(words)) {
    for (const ch of [...w.hanzi]) {
      const x = data[ch];
      if (!x?.d || seen.has(ch)) continue;
      const { parts } = parseIds(x.d);
      if (parts.length < 2 || parts.some((p) => /[？?⿰-⿻]/.test(p))) continue;
      // Chữ nhiễu: ưu tiên chữ chung một thành phần (khó hơn), rồi chữ bất kỳ.
      const share = pool.filter((c) => c !== ch && leaves(data[c].d).some((l) => parts.includes(l)));
      const others = [...shuffle(share), ...shuffle(pool)].filter((c, i, a) => c !== ch && a.indexOf(c) === i).slice(0, 3);
      if (others.length < 3) continue;
      seen.add(ch);
      out.push({
        type: 'choose', activity: 'recall-compose', compose: { parts, struct: STRUCT[parseIds(x.d).op] },
        prompt: `Ghép ${parts.join(' + ')} thành chữ nào?`, hint: [...w.hanzi].length === 1 ? w.meaning : `có trong ${w.hanzi} · ${w.meaning}`,
        answer: ch, options: shuffle([ch, ...others]), card_ids: [w.id],
        explanation: [x.h, TYPE[x.t]].filter(Boolean).join(' · '),
      });
      break;
    }
    if (out.length >= n) break;
  }
  return out;
}
