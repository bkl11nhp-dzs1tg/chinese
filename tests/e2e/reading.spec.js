// Bài đọc (mục 9.11 i): bấm từ hiện bảng tra; lưu từ tạo thẻ mới; mở lại về đúng câu; bài khóa của sách.
// Dùng bài đọc tự viết R02 (我的一天) trong data/readings.
import { test, expect } from '@playwright/test';

test('đọc bài: tra từ, lưu từ mới, nhớ vị trí, bài khóa', async ({ page }) => {
  await page.goto('/#/today');
  await expect(page.getByRole('heading', { name: 'Hôm nay' })).toBeVisible({ timeout: 20000 });

  await page.goto('/#/readings');
  await expect(page.getByText('Bài khóa trong sách')).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/10-readings.png' });
  await page.getByRole('link', { name: /我的一天/ }).click();

  // Từ có trong từ vựng sách: hiện nghĩa
  await page.locator('.tok', { hasText: '公司' }).first().click();
  await expect(page.locator('.word-sheet.open')).toContainText('công ty');
  await page.screenshot({ path: 'test-results/screens/11-word.png' });
  await page.locator('.scrim').click({ position: { x: 20, y: 20 } });

  // Từ chưa có trong từ vựng: không đoán nghĩa, tự điền rồi lưu
  await page.locator('.tok', { hasText: '同' }).first().click();
  await expect(page.locator('.word-sheet.open')).toContainText('không tự đoán nghĩa');
  await page.getByLabel('Nghĩa của từ').fill('cùng');
  await page.getByRole('button', { name: 'Lưu từ mới' }).click();
  await expect(page.locator('.tok.saved').first()).toBeVisible();

  // Bấm ▶ câu thứ 2 → mở lại vẫn ở câu 2
  await page.locator('.sent[data-i="1"] .say').click();
  await page.waitForTimeout(1300);
  await page.goto('/#/readings');
  await page.goto('/#/read/R02');
  await expect(page.locator('.sent.active')).toHaveAttribute('data-i', '1');
  await page.getByRole('tab', { name: 'Từng câu' }).click();
  await expect(page.locator('.pl-pos')).toHaveText(/Câu 2\//);
  await page.getByRole('tab', { name: 'Đọc' }).click();

  // Bài khóa của bài 28 (kèm người nói)
  await page.goto('/#/read/lesson%3AL28');
  await expect(page.locator('.speaker').first()).toContainText('小张');
  await page.screenshot({ path: 'test-results/screens/12-lesson-text.png' });
});
