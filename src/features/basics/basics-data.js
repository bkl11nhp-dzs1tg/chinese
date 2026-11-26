// Kiến thức nền: thanh mẫu, vận mẫu, thanh điệu, 214 bộ thủ Khang Hy, nét cơ bản, quy tắc bút thuận.

/** Thanh mẫu theo nhóm. key: âm tiết mẫu để phát âm; vi: âm gần giống trong tiếng Việt. */
export const INITIAL_GROUPS = [
  { name: 'Âm môi', items: [['b', 'bo', 'p'], ['p', 'po', 'p bật hơi'], ['m', 'mo', 'm'], ['f', 'fo', 'ph']] },
  { name: 'Đầu lưỡi giữa', items: [['d', 'de', 't'], ['t', 'te', 'th'], ['n', 'ne', 'n'], ['l', 'le', 'l']] },
  { name: 'Cuống lưỡi', items: [['g', 'ge', 'c / k'], ['k', 'ke', 'kh bật hơi'], ['h', 'he', 'h khàn']] },
  { name: 'Mặt lưỡi', items: [['j', 'ji', 'ch mềm'], ['q', 'qi', 'ch bật hơi'], ['x', 'xi', 'x mềm']] },
  { name: 'Uốn lưỡi', items: [['zh', 'zhi', 'tr'], ['ch', 'chi', 'tr bật hơi'], ['sh', 'shi', 's'], ['r', 'ri', 'r nhẹ']] },
  { name: 'Đầu lưỡi trước', items: [['z', 'zi', 'ch đầu lưỡi'], ['c', 'ci', 'x bật hơi'], ['s', 'si', 'x']] },
  { name: 'Bán nguyên âm', items: [['y', 'yi', 'd / i'], ['w', 'wu', 'u / o']] },
];
export const INITIALS = INITIAL_GROUPS.filter((g) => g.name !== 'Bán nguyên âm').flatMap((g) => g.items.map((x) => x[0]));

/** Vận mẫu theo nhóm: [vận mẫu, âm tiết mẫu, gần giống tiếng Việt]. */
export const FINAL_GROUPS = [
  { name: 'Đơn', items: [['a', 'a', 'a'], ['o', 'o', 'ô'], ['e', 'e', 'ưa / ơ'], ['i', 'yi', 'i'], ['u', 'wu', 'u'], ['ü', 'yu', 'uy'], ['-i', 'zi', 'ư'], ['er', 'er', 'ơ uốn lưỡi']] },
  { name: 'Kép', items: [['ai', 'ai', 'ai'], ['ei', 'ei', 'ây'], ['ao', 'ao', 'ao'], ['ou', 'ou', 'âu'], ['ia', 'ya', 'ia'], ['ie', 'ye', 'iê'], ['ua', 'wa', 'oa'], ['uo', 'wo', 'uô'], ['üe', 'yue', 'uyê'], ['iao', 'yao', 'iao'], ['iou', 'you', 'iâu'], ['uai', 'wai', 'oai'], ['uei', 'wei', 'uây']] },
  { name: 'Âm mũi', items: [['an', 'an', 'an'], ['en', 'en', 'ân'], ['in', 'yin', 'in'], ['ün', 'yun', 'uyn'], ['ian', 'yan', 'iên'], ['uan', 'wan', 'oan'], ['üan', 'yuan', 'oen'], ['uen', 'wen', 'uân'], ['ang', 'ang', 'ang'], ['eng', 'deng', 'âng'], ['ing', 'ying', 'inh'], ['ong', 'tong', 'ung'], ['iang', 'yang', 'iang'], ['uang', 'wang', 'oang'], ['ueng', 'weng', 'uâng'], ['iong', 'yong', 'iung']] },
];
/** Hàng của bảng ghép (bỏ -i, er: đã nằm trong hàng i / ô riêng). */
export const TABLE_FINALS = FINAL_GROUPS.flatMap((g) => g.items.map((x) => x[0])).filter((f) => f !== '-i');

/** Ghép thanh mẫu + vận mẫu theo quy tắc chính tả pinyin. ini '' = không có thanh mẫu. */
export function spell(ini, fin) {
  if (!ini) {
    const Z = { i: 'yi', in: 'yin', ing: 'ying', u: 'wu', ü: 'yu', üe: 'yue', üan: 'yuan', ün: 'yun', iou: 'you', uei: 'wei', uen: 'wen' };
    if (Z[fin]) return Z[fin];
    if (fin[0] === 'i') return `y${fin.slice(1)}`;
    if (fin[0] === 'u') return `w${fin.slice(1)}`;
    return fin;
  }
  if (fin === 'er') return null;
  let f = fin === 'iou' ? 'iu' : fin === 'uei' ? 'ui' : fin === 'uen' ? 'un' : fin;
  if ('jqx'.includes(ini) && f[0] === 'ü') f = `u${f.slice(1)}`;
  return ini + f;
}

/** Thanh điệu: số, dấu, mô tả, đường nét (thang 5 bậc) và chữ ví dụ. */
export const TONES = [
  { n: 1, mark: 'ā', name: 'Thanh 1', vi: 'Cao, đều, kéo dài', like: 'như thanh ngang nhưng cao hơn', pts: [[0, 5], [1, 5]], ex: ['妈', 'mā', 'mẹ'] },
  { n: 2, mark: 'á', name: 'Thanh 2', vi: 'Từ giữa lên cao', like: 'gần thanh sắc', pts: [[0, 3], [1, 5]], ex: ['麻', 'má', 'cây gai'] },
  { n: 3, mark: 'ǎ', name: 'Thanh 3', vi: 'Xuống thấp rồi lên', like: 'gần thanh hỏi, kéo dài', pts: [[0, 2], [0.45, 1], [1, 4]], ex: ['马', 'mǎ', 'ngựa'] },
  { n: 4, mark: 'à', name: 'Thanh 4', vi: 'Từ cao xuống thấp, dứt khoát', like: 'giữa thanh huyền và thanh nặng', pts: [[0, 5], [1, 1]], ex: ['骂', 'mà', 'mắng'] },
  { n: 0, mark: 'a', name: 'Thanh nhẹ', vi: 'Ngắn, nhẹ, không dấu', like: 'đọc lướt', pts: [[0.4, 3], [0.6, 3]], ex: ['吗', 'ma', 'trợ từ hỏi'] },
];

/** Biến điệu hay gặp. */
export const SANDHI = [
  { title: 'Hai thanh 3 liền nhau', rule: '3 + 3 → 2 + 3', ex: [['你好', 'nǐ hǎo', 'ní hǎo'], ['很好', 'hěn hǎo', 'hén hǎo'], ['可以', 'kěyǐ', 'kéyǐ']] },
  { title: '不 bù trước thanh 4', rule: 'bù → bú', ex: [['不是', 'bù shì', 'bú shì'], ['不对', 'bù duì', 'bú duì'], ['不客气', 'bù kèqi', 'bú kèqi']] },
  { title: '一 yī trước thanh 4', rule: 'yī → yí', ex: [['一样', 'yī yàng', 'yíyàng'], ['一下', 'yī xià', 'yíxià'], ['一个', 'yī gè', 'yí ge']] },
  { title: '一 yī trước thanh 1, 2, 3', rule: 'yī → yì', ex: [['一天', 'yī tiān', 'yìtiān'], ['一年', 'yī nián', 'yìnián'], ['一起', 'yī qǐ', 'yìqǐ']] },
  { title: 'Thanh 3 trước thanh khác', rule: 'chỉ đọc nửa đầu (xuống thấp)', ex: [['老师', 'lǎoshī', 'lǎo↓ shī'], ['好吃', 'hǎochī', 'hǎo↓ chī'], ['我们', 'wǒmen', 'wǒ↓ men']] },
];

/** Quy tắc viết pinyin. */
export const SPELLING = [
  ['Dấu thanh đặt trên nguyên âm chính', 'a > o > e > i, u, ü', ['hǎo', 'duō', 'xiè']],
  ['iu, ui: dấu đặt trên chữ đứng sau', 'liù · guì', ['liù', 'guì', 'jiǔ']],
  ['ü sau j, q, x, y bỏ hai chấm', 'jü → ju', ['jù', 'qù', 'xué', 'yú']],
  ['Không có thanh mẫu: i → y, u → w, ü → yu', 'ia → ya · uo → wo', ['yī', 'wǔ', 'yuè']],
  ['iou, uei, uen sau thanh mẫu viết gọn', 'iu · ui · un', ['jiǔ', 'duì', 'lùn']],
];

/** 214 bộ thủ Khang Hy: số nét → "chữ|dạng khác|tên Hán Việt|nghĩa". */
const RAD = {
  1: '一||Nhất|số một;丨||Cổn|nét sổ;丶||Chủ|điểm, chấm;丿||Phiệt|nét phẩy;乙|乚|Ất|can thứ hai;亅||Quyết|nét móc',
  2: '二||Nhị|số hai;亠||Đầu|nắp, đầu;人|亻|Nhân|người;儿||Nhân (đi)|người đi;入||Nhập|vào;八|丷|Bát|số tám;冂||Quynh|vùng biên xa;冖||Mịch|trùm khăn;冫||Băng|băng giá;几||Kỷ|ghế dựa;凵||Khảm|há miệng;刀|刂|Đao|con dao;力||Lực|sức mạnh;勹||Bao|bao bọc;匕||Chủy|cái thìa;匚||Phương|tủ đựng;匸||Hệ|che đậy;十||Thập|số mười;卜||Bốc|xem bói;卩|㔾|Tiết|đốt tre;厂||Hán|sườn núi;厶||Khư|riêng tư;又||Hựu|lại, tay',
  3: '口||Khẩu|cái miệng;囗||Vi|vây quanh;土||Thổ|đất;士||Sĩ|kẻ sĩ;夂||Tri|đến sau;夊||Tuy|đi chậm;夕||Tịch|đêm tối;大||Đại|to lớn;女||Nữ|con gái;子||Tử|con;宀||Miên|mái nhà;寸||Thốn|tấc;小|⺌ ⺍|Tiểu|nhỏ;尢||Uông|yếu đuối;尸||Thi|thây, thân người;屮||Triệt|mầm non;山||Sơn|núi;巛|川|Xuyên|sông;工||Công|người thợ;己||Kỷ|bản thân;巾||Cân|cái khăn;干||Can|can, khiên;幺||Yêu|nhỏ bé;广||Nghiễm|mái hiên;廴||Dẫn|bước dài;廾||Củng|chắp tay;弋||Dặc|bắn, chiếm lấy;弓||Cung|cái cung;彐|⺕|Kệ|đầu con heo;彡||Sam|lông tóc dài;彳||Xích|bước chân trái',
  4: '心|忄 ⺗|Tâm|tim, lòng;戈||Qua|cây giáo;户|戶|Hộ|cửa một cánh;手|扌|Thủ|tay;支||Chi|cành nhánh;攴|攵|Phộc|đánh khẽ;文||Văn|văn vẻ, chữ;斗||Đẩu|cái đấu;斤||Cân|cái rìu;方||Phương|vuông;无||Vô|không;日||Nhật|mặt trời, ngày;曰||Viết|nói rằng;月||Nguyệt|mặt trăng;木||Mộc|cây, gỗ;欠||Khiếm|thiếu;止||Chỉ|dừng lại;歹|歺|Đãi|xấu, chết;殳||Thù|binh khí dài;毋|母|Vô|chớ, đừng;比||Tỷ|so sánh;毛||Mao|lông;氏||Thị|họ;气||Khí|hơi;水|氵 氺|Thủy|nước;火|灬|Hỏa|lửa;爪|爫|Trảo|móng vuốt;父||Phụ|cha;爻||Hào|hào âm dương;爿|丬|Tường|mảnh gỗ;片||Phiến|mảnh, tấm;牙||Nha|răng nanh;牛|牜|Ngưu|trâu bò;犬|犭|Khuyển|con chó',
  5: '玄||Huyền|đen huyền;玉|王|Ngọc|đá quý;瓜||Qua|dưa;瓦||Ngõa|ngói;甘||Cam|ngọt;生||Sinh|sinh sống;用||Dụng|dùng;田||Điền|ruộng;疋|⺪|Thất|đơn vị đo, chân;疒||Nạch|bệnh tật;癶||Bát|gạt ra;白||Bạch|màu trắng;皮||Bì|da;皿||Mãnh|bát đĩa;目||Mục|mắt;矛||Mâu|cây mâu;矢||Thỉ|mũi tên;石||Thạch|đá;示|礻|Thị|thần đất, cúng tế;禸||Nhựu|vết chân thú;禾||Hòa|lúa;穴||Huyệt|hang lỗ;立||Lập|đứng',
  6: '竹|⺮|Trúc|tre;米||Mễ|gạo;糸|纟 糹|Mịch|sợi tơ;缶||Phẫu|đồ sành;网|罒 ⺲|Võng|cái lưới;羊|⺶|Dương|con dê;羽||Vũ|lông vũ;老|耂|Lão|già;而||Nhi|mà, và;耒||Lỗi|cái cày;耳||Nhĩ|tai;聿||Duật|cây bút;肉|⺼|Nhục|thịt;臣||Thần|bề tôi;自||Tự|tự mình;至||Chí|đến;臼||Cữu|cái cối;舌||Thiệt|cái lưỡi;舛||Suyễn|sai lầm;舟||Chu|thuyền;艮||Cấn|bền cứng;色||Sắc|màu sắc;艸|艹|Thảo|cỏ;虍||Hô|vằn hổ;虫||Trùng|sâu bọ;血||Huyết|máu;行||Hành|đi;衣|衤|Y|áo;襾|西 覀|Á|che đậy',
  7: '见|見|Kiến|thấy;角||Giác|sừng, góc;言|讠 訁|Ngôn|lời nói;谷||Cốc|thung lũng;豆||Đậu|hạt đậu;豕||Thỉ|con heo;豸||Trãi|loài thú không chân;贝|貝|Bối|vỏ sò, tiền;赤||Xích|màu đỏ;走||Tẩu|chạy;足|⻊|Túc|chân;身||Thân|thân thể;车|車|Xa|xe;辛||Tân|cay;辰||Thần|thời gian, sao;辵|辶|Sước|chợt đi chợt dừng;邑|阝|Ấp|vùng đất (阝 bên phải);酉||Dậu|rượu;釆||Biện|phân biệt;里||Lý|dặm, làng',
  8: '金|钅 釒|Kim|kim loại, vàng;长|長|Trường|dài;门|門|Môn|cửa hai cánh;阜|阝|Phụ|gò đất (阝 bên trái);隶||Đãi|kịp, theo kịp;隹||Chuy|chim đuôi ngắn;雨||Vũ|mưa;青||Thanh|màu xanh;非||Phi|không, sai',
  9: '面||Diện|mặt;革||Cách|da thú;韦|韋|Vi|da đã thuộc;韭||Cửu|rau hẹ;音||Âm|âm thanh;页|頁|Hiệt|đầu;风|風|Phong|gió;飞|飛|Phi|bay;食|饣 飠|Thực|ăn;首||Thủ|đầu;香||Hương|mùi thơm',
  10: '马|馬|Mã|con ngựa;骨||Cốt|xương;高||Cao|cao;髟||Bưu|tóc dài;鬥||Đấu|đánh nhau;鬯||Sưởng|rượu nếp;鬲||Cách|cái đỉnh;鬼||Quỷ|ma quỷ',
  11: '鱼|魚|Ngư|con cá;鸟|鳥|Điểu|con chim;卤|鹵|Lỗ|đất mặn;鹿||Lộc|con hươu;麦|麥|Mạch|lúa mạch;麻||Ma|cây gai',
  12: '黄|黃|Hoàng|màu vàng;黍||Thử|lúa nếp;黑||Hắc|màu đen;黹||Chỉ|may vá',
  13: '黾|黽|Mãnh|con ếch;鼎||Đỉnh|cái đỉnh;鼓||Cổ|cái trống;鼠||Thử|con chuột',
  14: '鼻||Tị|cái mũi;齐|齊|Tề|ngang bằng',
  15: '齿|齒|Xỉ|răng',
  16: '龙|龍|Long|con rồng;龟|龜|Quy|con rùa',
  17: '龠||Dược|sáo ba lỗ',
};

export const RADICALS_214 = Object.entries(RAD).flatMap(([strokes, s]) => s.split(';').map((row) => {
  const [ch, alt, name, meaning] = row.split('|');
  return { ch, alt: alt ? alt.split(' ') : [], name, meaning, strokes: Number(strokes) };
})).map((r, i) => ({ ...r, no: i + 1 }));

/** Nét cơ bản và nét ghép hay gặp: [nét, tên Trung, pinyin, tên Việt, chữ ví dụ]. */
export const STROKES = [
  ['㇐', '横', 'héng', 'Ngang', '一 三'],
  ['㇑', '竖', 'shù', 'Sổ', '十 中'],
  ['㇒', '撇', 'piě', 'Phẩy', '八 人'],
  ['㇔', '点', 'diǎn', 'Chấm', '六 主'],
  ['㇏', '捺', 'nà', 'Mác', '人 大'],
  ['㇀', '提', 'tí', 'Hất', '打 我'],
  ['㇕', '横折', 'héngzhé', 'Ngang gập', '口 日'],
  ['㇚', '竖钩', 'shùgōu', 'Sổ móc', '小 水'],
  ['㇖', '横钩', 'hénggōu', 'Ngang móc', '你 买'],
  ['㇆', '横折钩', 'héngzhégōu', 'Ngang gập móc', '月 门'],
  ['㇗', '竖折', 'shùzhé', 'Sổ gập', '山 出'],
  ['㇙', '竖提', 'shùtí', 'Sổ hất', '以 长'],
  ['㇇', '横撇', 'héngpiě', 'Ngang phẩy', '又 水'],
  ['㇛', '撇点', 'piědiǎn', 'Phẩy chấm', '女 好'],
  ['㇜', '撇折', 'piězhé', 'Phẩy gập', '么 去'],
  ['㇟', '竖弯钩', 'shùwāngōu', 'Sổ cong móc', '儿 七'],
  ['㇂', '斜钩', 'xiégōu', 'Móc xiên', '我 找'],
  ['㇃', '卧钩', 'wògōu', 'Móc nằm', '心 您'],
  ['㇁', '弯钩', 'wāngōu', 'Móc cong', '子 字'],
  ['㇈', '横折弯钩', 'héngzhéwāngōu', 'Ngang gập cong móc', '九 几'],
];

/** Quy tắc bút thuận: [quy tắc, chữ ví dụ]. */
export const STROKE_RULES = [
  ['Ngang trước, sổ sau', '十 干'],
  ['Phẩy trước, mác sau', '八 人'],
  ['Trên trước, dưới sau', '三 京'],
  ['Trái trước, phải sau', '你 明'],
  ['Ngoài trước, trong sau', '月 同'],
  ['Vào nhà rồi đóng cửa', '国 回'],
  ['Giữa trước, hai bên sau', '小 水'],
  ['Chấm nhỏ viết sau cùng', '我 书'],
];
