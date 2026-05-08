import { test, expect } from '@playwright/test';

test.describe('Mastering E2E', () => {
  test('studio page loads', async ({ page }) => {
    await page.goto('/studio');
    // Just verify page loaded and has expected title
    await expect(page).toHaveTitle(/RedInside/);
  });

  test('upload zone exists in DOM (may be hidden)', async ({ page }) => {
    await page.goto('/studio');
    // Check the element exists in DOM (not necessarily visible)
    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeAttached();
  });

  test('VU meter exists in DOM (may be hidden)', async ({ page }) => {
    await page.goto('/studio');
    const vuMeter = page.locator('[data-testid="vu-meter"]');
    await expect(vuMeter).toBeAttached();
  });
});