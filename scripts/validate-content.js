// Kiểm tra nội dung trong data/ (mục 8.4). Chỉ báo lỗi, không tự sửa.
// Chạy: npm run validate            (mặc định thư mục data/)
//       npm run validate -- <thư-mục>
import { readContentDir } from './read-content.js';

const root = process.argv[2] || 'data';
const { files, result: r } = readContentDir(root);
if (!files.length) {
  console.log(`Không tìm thấy file nào trong ${root}/vocab/*.csv hoặc ${root}/lessons/*.json.`);
  process.exit(1);
}
const where = (l) => (l == null ? '' : typeof l === 'number' ? ` (dòng ${l})` : ` (${l})`);
const fmt = (x) => `  - ${x.source}${where(x.line)}: ${x.message}`;
if (r.errors.length) { console.log('LỖI:'); r.errors.forEach((e) => console.log(fmt(e))); }
if (r.warnings.length) { console.log('CẢNH BÁO:'); r.warnings.forEach((w) => console.log(fmt(w))); }
console.log(`\n${files.length} file · ${r.counts.cards} thẻ · ${r.counts.lessons} bài · ${r.counts.exercises} bài tập · ${r.counts.readings} bài đọc · ${r.errors.length} lỗi · ${r.warnings.length} cảnh báo`);
process.exit(r.errors.length ? 1 : 0);
