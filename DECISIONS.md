# DECISIONS

Ghi ngắn các quyết định kỹ thuật quan trọng (mục 19 của đặc tả).

- **2026-11-21 · Không dùng thư viện UI, không dùng `idb`.** Vanilla JS + wrapper IndexedDB nhỏ trong `src/db/repo.js` (~200 dòng). Ít phụ thuộc, dễ đọc, test bằng `fake-indexeddb`.
- **2026-11-21 · Router theo hash (`#/today`).** Chạy được khi mở file tĩnh, trên Vercel và offline, không cần cấu hình rewrite.
- **2026-11-21 · Bài hoàn thành = đạt kiểm tra cuối bài (≥ ngưỡng, mặc định 70%).** Thay cho "học hết từ + bài tập ≥ 70%" của bản nháp đặc tả, theo yêu cầu "test sau mỗi bài". Luyện tập vẫn có, nhưng là bước chuẩn bị, không quyết định hoàn thành.
- **2026-11-21 · Giao diện ưu tiên điện thoại, phong cách iOS.** Giữ bảng màu kem/navy/cam của đặc tả nhưng bỏ viền pixel cứng; chỉ logo giữ chữ 中 dạng pixel. Chế độ học toàn màn hình: nút ✕ + thanh tiến độ ở trên, nút hành động dính đáy (vùng ngón cái), phản hồi trượt lên từ dưới. Tham khảo cách tương tác của các app học ngôn ngữ phổ biến, không sao chép hình ảnh/thương hiệu.
- **2026-11-21 · Chấm thẻ 4 nút: Quên = 0, Khó = 3, Tốt = 4, Dễ = 5.** Phím 1–4.
- **2026-11-21 · Trò chơi ảnh hưởng SRS một nửa** (`reviewLight`: trung điểm ease/interval cũ và mới, không đổi repetitions/lapses, không áp lên thẻ chưa học).
- **2026-11-21 · Đo giờ:** idle quá ngưỡng thì chỉ tính đến lần tương tác cuối; ghi `active_ms` mỗi 30 giây và khi ẩn tab.
- **2026-11-21 · File nghe lưu dạng Blob trong IndexedDB (store `audio`)**, khóa theo mã bài lấy từ tên file ("Quyển 1 Bài 3.mp3" → L03). Không nằm trong bản xuất JSON.
- **2026-11-21 · Nội dung Hán ngữ 1–2 lấy từ bảng từ vựng cuối sách** (PDF là bản scan, chép tay từ ảnh trang). Một số nghĩa in sai trong sách đã sửa (ví dụ 包子 "túi" → "bánh bao", 地铁 "đường sắt" → "tàu điện ngầm", 挺 "dừng" → "khá, rất", 电视 "phim" → "ti vi"). Câu luyện tập/sắp xếp là câu tự soạn từ từ vựng của bài. Toàn bộ nằm trong `data/` (không commit).
- **2026-11-23 · Nội dung lấy thẳng từ data/, bỏ giao diện nạp file.** Build đóng gói `content/pack.json` (có `content_version`); app tự gộp khi phiên bản đổi, giữ tiến độ.
- **2026-11-23 · Commit phần chữ của data/ (theo quyết định của chủ dự án), không commit MP3/PDF.** Trang GitHub Pages công khai; thay đổi so với quy tắc "data/ không commit" trong đặc tả.
- **2026-11-23 · Chấm thẻ: Chưa nhớ / Đã nhớ / Đã thuộc + Quay lại / Bỏ qua** thay cho Quên/Khó/Tốt/Dễ. Chưa nhớ = q1 (ôn lại trong buổi), Đã nhớ = q4, Đã thuộc = khoảng ôn ≥ 21 ngày (`markMastered`). Quay lại hoàn tác bằng `undoReview`.
- **2026-11-23 · Bài khóa chép từ sách (30 bài, 463 câu), ngữ pháp theo mục lục sách, giải thích tự viết.** Bính âm tự sinh bằng pinyin-pro, ưu tiên bính âm in trong bảng từ của sách.
