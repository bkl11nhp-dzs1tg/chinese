# Tự học tiếng Trung

App tự học tiếng Trung chạy trên trình duyệt (PWA, ưu tiên điện thoại), dùng nội dung do bạn tự nạp. Đặc tả: [../CHINESE_STUDY_FEATURE.md](../CHINESE_STUDY_FEATURE.md). Quyết định kỹ thuật: [DECISIONS.md](./DECISIONS.md).

## Chạy

```bash
npm install
npm run audio      # (tùy chọn, chỉ trên máy) chép MP3 từ ../MP3 Q1, ../MP3 Q2 vào data/audio/
npm run dev        # http://localhost:5173 (điện thoại cùng Wi-Fi: http://<IP máy>:5173)
npm test           # test đơn vị (Vitest)
npm run test:e2e   # luồng chính trên khung iPhone (Playwright + Chrome đã cài)
npm run build      # kiểm tra + đóng gói nội dung + build ra dist/
```

## Nội dung (lấy thẳng từ data/, không cần nạp trong app)

- `data/vocab/*.csv` (từ vựng), `data/lessons/*.json` (bài học: bài khóa, ngữ pháp, bài tập), `data/readings/*.json` (bài đọc).
- `npm run dev`/`npm run build` tự chạy kiểm tra và đóng gói thành `content/pack.json`. Khi app mở, nếu nội dung có phiên bản mới thì tự cập nhật, **tiến độ học giữ nguyên**.
- File nghe: `data/audio/LXX.mp3` (không commit). Có file thì trang bài học và trang đọc phát MP3; không có thì dùng giọng máy.
- Tranh minh họa: `public/lessons/LXX.webp`, cắt từ `art/illustrations/*.png` bằng `npm run cut-art`.

## Một bài học gồm

1. **Học từ mới**: flashcard có SRS. Sau khi lật: **Chưa nhớ** (ôn lại ngay), **Đã nhớ** (ôn theo lịch), **Đã thuộc** (ôn sau ≥ 21 ngày); **Quay lại** (hoàn tác thẻ trước), **Bỏ qua**. Phím: Space lật, 1–3 chọn, ←/→.
2. **Bài khóa**: chép từ sách, bấm từ để tra, nghe từng câu, 4 chế độ đọc.
3. **Ngữ pháp**: theo mục lục sách, giải thích tiếng Việt + ví dụ trong bài.
4. **Luyện tập**: trắc nghiệm, ghép cặp, điền từ, sắp xếp câu.
5. **Kiểm tra cuối bài**: từ vựng + câu trong bài khóa, đạt ≥ 70% là hoàn thành.

## Tài khoản & đồng bộ nhiều thiết bị

Không đăng nhập vẫn dùng đầy đủ (dữ liệu chỉ ở máy đó). Đăng nhập thì tiến độ thẻ, lịch ôn, điểm kiểm tra, thời gian học, từ đã lưu được đồng bộ; vẫn học offline, có mạng thì tự đồng bộ (khi mở app, khi ẩn tab, mỗi 5 phút, nút "Đồng bộ ngay").

- **Chạy thử trên máy:** `npm run sync-server` → server ở `http://localhost:8787` (điện thoại cùng Wi-Fi: `http://<IP máy>:8787`). Trong app: biểu tượng người ở đầu trang → Máy chủ đồng bộ → nhập địa chỉ.
- **Triển khai thật (Cloudflare Workers + D1, miễn phí ở mức cá nhân):**
  1. `cd worker && npx wrangler login`
  2. `npx wrangler d1 create chinese-study` → chép `database_id` vào `worker/wrangler.toml`
  3. Sửa `ALLOWED_ORIGINS` trong `wrangler.toml` thành địa chỉ trang GitHub Pages của bạn
  4. `cd .. && npm run worker:deploy` → nhận địa chỉ `https://chinese-study-sync.<tên>.workers.dev`
  5. Trên GitHub: Settings → Secrets and variables → Actions → **Variables** → thêm `SYNC_URL` = địa chỉ trên. Lần build sau, app tự điền sẵn địa chỉ máy chủ.
- Bảo mật: mật khẩu băm PBKDF2-SHA256 (100.000 vòng, có salt), phiên đăng nhập là token ngẫu nhiên (lưu dạng băm, hết hạn sau 180 ngày), khóa tạm sau 10 lần sai/15 phút, mọi truy vấn lọc theo tài khoản. Có nút xóa tài khoản kèm toàn bộ dữ liệu trên máy chủ.

## Deploy GitHub Pages

Workflow `.github/workflows/pages.yml`: mỗi lần push lên `main` sẽ chạy test, build rồi deploy `dist/`. Trong repo: Settings → Pages → Source: **GitHub Actions**. Lưu ý: trang Pages công khai, nội dung chữ trong `data/` sẽ xem được; MP3 không được đưa lên.

## Cấu trúc

- `src/core/`: logic thuần có test (srs, planner, timer, stats, importer, lessons, lessontest, exercises, xp).
- `src/db/`: IndexedDB (schema, migrations, repo).
- `src/features/`: từng màn hình. `src/ui/`: helper DOM, icon, khung học toàn màn hình, âm báo, biểu đồ.
- `scripts/`: validate, pack, tạo icon. `tests/`: unit + `tests/e2e/`.

## Trạng thái

- [x] Giai đoạn 0: khung dự án
- [x] Giai đoạn 1: SRS, IndexedDB, nạp nội dung, flashcard, planner, timer, thống kê, bài học, bài tập, cài đặt, PWA (chưa deploy Vercel)
- [x] Một phần giai đoạn 2: 4 dạng bài tập, 4 trò chơi, nghe TTS, kiểm tra cuối bài
- [x] Bài khóa + ngữ pháp 30 bài, bài đọc (mục 9.11)
- [ ] Giai đoạn 2 còn lại: nói (SpeechRecognition), luyện viết chữ theo nét
- [x] Giai đoạn 3: tài khoản + đồng bộ Workers + D1 (cần triển khai Worker)
- [x] Luyện theo kỹ năng: nghe, nói, đọc hiểu, từ vựng, thanh điệu, gõ bính âm, ghép câu
- [ ] Giai đoạn 4: tích hợp Personal Secretary
