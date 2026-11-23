import { defineConfig, devices } from '@playwright/test';

// Dùng Chrome đã cài trên máy (không cần tải trình duyệt riêng).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5174', channel: 'chrome', ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' },
  projects: [{ name: 'mobile', use: { ...devices['iPhone 13'], channel: 'chrome', browserName: 'chromium' } }],
  webServer: { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true, timeout: 60_000 },
});
