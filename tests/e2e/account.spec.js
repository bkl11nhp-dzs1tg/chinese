// Tài khoản: học trên "điện thoại" (thiết bị A) → đăng nhập trên "máy tính" (thiết bị B) thấy cùng tiến độ.
import { test, expect } from '@playwright/test';

const SYNC = 'http://localhost:8788';

async function login(page, { register }) {
  await page.goto('/#/account');
  if (register) await page.getByRole('button', { name: /Chưa có tài khoản/ }).click();
  await page.getByLabel('Tên đăng nhập').fill('hocvien1');
  await page.getByLabel('Mật khẩu').fill('matkhau123');
  const url = page.getByLabel('Địa chỉ');
  if (!(await url.isVisible())) await page.getByText('Máy chủ đồng bộ').click();
  await url.fill(SYNC);
  await page.getByRole('button', { name: register ? /Tạo tài khoản và đồng bộ/ : /Đăng nhập và đồng bộ/ }).click();
  await expect(page.getByRole('button', { name: /Đồng bộ ngay/ })).toBeVisible({ timeout: 15000 });
}

test('đồng bộ tiến độ giữa 2 thiết bị', async ({ browser }) => {
  const A = await (await browser.newContext()).newPage();
  await A.goto('/');
  await expect(A.getByRole('heading', { name: 'Hôm nay' })).toBeVisible({ timeout: 20000 });
  await login(A, { register: true });
  await A.screenshot({ path: 'test-results/screens/20-account.png' });

  // Học 3 thẻ trên A
  await A.goto('/#/session?lesson=L01');
  for (let i = 0; i < 3; i++) {
    await A.getByRole('button', { name: /Lật thẻ/ }).click();
    await A.getByRole('button', { name: /Đã thuộc/ }).click();
  }
  await A.getByRole('button', { name: 'Kết thúc buổi học' }).click();
  await A.goto('/#/account');
  await A.getByRole('button', { name: /Đồng bộ ngay/ }).click();
  await expect(A.getByText(/Đã đồng bộ lúc/)).toBeVisible();

  // Thiết bị B: trình duyệt mới, dữ liệu trống
  const B = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await B.goto('/');
  await expect(B.getByRole('heading', { name: 'Hôm nay' })).toBeVisible({ timeout: 20000 });
  await login(B, { register: false });
  await B.goto('/#/cards');
  await expect(B.locator('.status-tile.mastered .st-num')).toHaveText('3');
  await B.goto('/#/lesson/L01');
  await expect(B.getByText(/3\/12 từ đã học/)).toBeVisible();
  await B.screenshot({ path: 'test-results/screens/21-device-b.png' });

  // Sai mật khẩu báo lỗi
  const C = await (await browser.newContext()).newPage();
  await C.goto('/#/account');
  await C.getByLabel('Tên đăng nhập').fill('hocvien1');
  await C.getByLabel('Mật khẩu').fill('saimatkhau');
  if (!(await C.getByLabel('Địa chỉ').isVisible())) await C.getByText('Máy chủ đồng bộ').click();
  await C.getByLabel('Địa chỉ').fill(SYNC);
  await C.getByRole('button', { name: /Đăng nhập và đồng bộ/ }).click();
  await expect(C.getByRole('alert')).toContainText('Sai tên đăng nhập hoặc mật khẩu');
});
