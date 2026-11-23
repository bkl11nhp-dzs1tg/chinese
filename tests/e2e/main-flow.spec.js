// Luồng chính trên màn hình điện thoại (mục 15.2), dùng nội dung app tự lấy từ data/ (chạy npm run pack trước).
// Ảnh chụp lưu ở test-results/screens/.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SHOTS = 'test-results/screens';

test('tự nạp nội dung → học bài 1 → tiến độ giữ sau khi tải lại → luyện tập → kiểm tra → xuất dữ liệu', async ({ page }) => {
  await page.goto('/#/today');
  await expect(page.getByRole('heading', { name: 'Hôm nay' })).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `${SHOTS}/01-today.png` });

  await page.goto('/#/lessons');
  await expect(page.locator('.lesson-card').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-lessons.png` });

  await page.goto('/#/lesson/L01');
  await expect(page.getByText('Ngữ pháp & ghi chú')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/03-lesson.png`, fullPage: true });

  // Học hết từ mới của bài 1
  await page.getByRole('button', { name: /Bắt đầu học/ }).click();
  const flip = page.getByRole('button', { name: /Lật thẻ/ });
  const doneHeading = page.getByRole('heading', { name: 'Xong buổi học!' });
  for (let i = 0; i < 40; i++) {
    await expect(flip.or(doneHeading)).toBeVisible();
    if (await doneHeading.isVisible()) break;
    await flip.click();
    if (i === 0) {
      await page.screenshot({ path: `${SHOTS}/04-flashcard.png` });
      // Chưa nhớ → Quay lại (hoàn tác) → lật lại thẻ đó; Bỏ qua thẻ kế rồi quay lại
      await page.getByRole('button', { name: /Chưa nhớ/ }).click();
      await page.getByRole('button', { name: 'Quay lại' }).click();
      await expect(page.getByText('1/12')).toBeVisible();
      await page.getByRole('button', { name: /Bỏ qua/ }).click();
      await expect(page.getByText('2/12')).toBeVisible();
      await page.getByRole('button', { name: 'Quay lại' }).click();
      await flip.click();
    }
    await page.getByRole('button', { name: /Đã nhớ/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Xong buổi học!' })).toBeVisible();

  // Tải lại: tiến độ vẫn còn, nội dung không bị nạp đè
  await page.reload();
  await page.goto('/#/lesson/L01');
  await expect(page.getByText(/12\/12 từ đã học/)).toBeVisible();

  // Luyện tập: trả lời câu đầu → khung phản hồi
  await page.goto('/#/exercise/L01');
  await answerAny(page);
  await page.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(page.locator('.sheet.open')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-feedback.png` });

  // Kiểm tra cuối bài: làm hết, có màn kết quả
  await page.goto('/#/test/L01');
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  for (let q = 0; q < 30; q++) {
    await answerAny(page);
    const btn = page.getByRole('button', { name: /^(Tiếp|Nộp bài)$/ });
    const last = (await btn.textContent()) === 'Nộp bài';
    await btn.click();
    if (last) break;
  }
  await expect(page.locator('.ring')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/06-test-result.png` });

  // Xuất dữ liệu có đủ các bảng
  await page.goto('/#/settings');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất bản sao lưu' }).click();
  const backup = JSON.parse(readFileSync(await (await dl).path(), 'utf8'));
  for (const k of ['cards', 'card_state', 'review_events', 'lessons', 'settings', 'study_sessions', 'lesson_progress', 'readings']) expect(backup[k]).toBeDefined();
  expect(backup.card_state.length).toBeGreaterThanOrEqual(12);
  expect(backup.lesson_progress.find((p) => p.lesson_id === 'L01').test_attempts).toBe(1);
});

/** Trả lời câu hiện tại, dạng nào cũng được (thứ tự câu là ngẫu nhiên). */
async function answerAny(page) {
  const type = (await page.locator('.q-type').textContent()) || '';
  if (type.includes('Ghép')) {
    const n = await page.locator('.match-grid .col').first().locator('.chip').count();
    for (let i = 0; i < n; i++) {
      await page.locator('.match-grid .col').first().locator('.chip').nth(i).click();
      await page.locator('.match-grid .col').nth(1).locator('.chip').nth(i).click();
    }
  } else if (type.includes('Sắp xếp')) {
    while (await page.locator('.bank .chip:not(.used)').count()) await page.locator('.bank .chip:not(.used)').first().click();
  } else if (type.includes('Điền')) {
    await page.locator('input.han-input').fill('好');
  } else {
    await page.locator('.options .chip').first().click();
  }
}
