import { test, expect } from '@playwright/test';

test.describe('Audio Editor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio');
  });

  test('upload zone renders correctly', async ({ page }) => {
    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeVisible();
    await expect(uploadZone).toContainText('Drop Audio File Here');
  });

  test('can click upload zone to open file picker', async ({ page }) => {
    const uploadZone = page.locator('[data-testid="upload-zone"]');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeHidden();
    await uploadZone.click();
    await expect(fileInput).toBeAttached();
  });

  test('VU meter renders on mastering page', async ({ page }) => {
    const vuMeter = page.locator('[data-testid="vu-meter"]');
    await expect(vuMeter).toBeVisible();
  });
});