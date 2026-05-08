import { test, expect } from '@playwright/test';

test('complete audio editing workflow', async ({ page }) => {
  await page.goto('/studio');

  // Upload real audio
  const upload = page.locator('[data-testid="audio-upload"]');
  await upload.setInputFiles('./tests/fixtures/test-audio.mp3');

  // Wait for waveform
  await page.waitForSelector('[data-testid="waveform"]');

  // Set trim markers
  await page.locator('[data-testid="trim-start"]').fill('10');
  await page.locator('[data-testid="trim-end"]').fill('30');

  // Adjust speed
  await page.locator('[data-testid="speed-slider"]').fill('1.25');

  // Export
  await page.locator('[data-testid="export-btn"]').click();

  // Verify download
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toMatch(/\.mp3$/);
});