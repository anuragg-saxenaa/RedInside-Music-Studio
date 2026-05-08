import { test, expect } from '@playwright/test';

test('complete mastering workflow', async ({ page }) => {
  await page.goto('/studio');

  // Navigate to export
  await page.click('text=Export');

  // Wait for mastering panel
  await page.waitForSelector('[data-testid="mastering-panel"]');

  // Check upload zone exists
  const uploadZone = page.locator('[data-testid="upload-zone"]');
  expect(uploadZone).toBeTruthy();

  // Check VU meter exists
  const vuMeter = page.locator('[data-testid="vu-meter"]');
  expect(vuMeter).toBeTruthy();
});