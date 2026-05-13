import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test('batch mastering - liquid glass file list UI', async ({ page }) => {
  // Use a project that already has music generated
  await page.goto('/#/');
  await page.waitForLoadState('networkidle');

  // Wait for app to load
  await page.waitForSelector('input[placeholder="Name your new track..."]', { timeout: 10000 });

  // Find and click on a project with music (zfuil-a3BAutZSJxolmEM has music version 17)
  const projectWithMusic = page.locator('button').filter({ hasText: 'Music v17' });
  const projectWithMusicCount = await projectWithMusic.count();

  if (projectWithMusicCount === 0) {
    // Try another approach - find project that shows "Music" indicator
    const projectCard = page.locator('button').filter({ hasText: /^Music v\d+$/ }).first();
    const count = await projectCard.count();

    if (count === 0) {
      test.skip('No project with music found');
      return;
    }
    await projectCard.click();
  } else {
    await projectWithMusic.click();
  }

  // Wait for studio to load
  await page.waitForTimeout(2000);

  // Check workflow stepper has Export button
  const exportBtn = page.locator('button:has-text("Export")');
  await expect(exportBtn).toBeVisible({ timeout: 5000 });

  // Check if Export is disabled (needs music)
  const isExportDisabled = await exportBtn.isDisabled();

  if (isExportDisabled) {
    test.skip('Export step is disabled - needs music generated first');
    return;
  }

  await exportBtn.click();
  await page.waitForTimeout(2000);

  // Verify mastering panel is visible
  const masteringPanel = page.locator('.mastering-panel');
  await expect(masteringPanel).toBeVisible({ timeout: 10000 });

  // Verify action bar buttons
  await expect(page.locator('button:has-text("Master All")')).toBeVisible();
  await expect(page.locator('button:has-text("Save to Music")')).toBeVisible();
  await expect(page.locator('button:has-text("Download ZIP")')).toBeVisible();

  // Verify toolbar title shows Track Library
  const toolbarTitle = page.locator('.toolbar-title');
  await expect(toolbarTitle).toContainText('Track Library');
});

test('upload zone accepts multiple files', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for app to load
  await page.waitForSelector('input[placeholder="Name your new track..."]', { timeout: 10000 });

  // Find and click on a project with music
  const projectWithMusic = page.locator('button').filter({ hasText: /^Music v\d+$/ }).first();
  const projectWithMusicCount = await projectWithMusic.count();

  if (projectWithMusicCount === 0) {
    test.skip('No project with music found');
    return;
  }
  await projectWithMusic.click();
  await page.waitForTimeout(2000);

  // Click Export button
  const exportBtn = page.locator('button:has-text("Export")');
  if (await exportBtn.isDisabled()) {
    test.skip('Export step is disabled - needs music generated first');
    return;
  }
  await exportBtn.click();
  await page.waitForTimeout(2000);

  const uploadZone = page.locator('[data-testid="upload-zone"]');
  await expect(uploadZone).toBeVisible({ timeout: 10000 });

  // Upload 3 files
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles([
    './tests/fixtures/test-audio.mp3',
    './tests/fixtures/test-audio.mp3',
    './tests/fixtures/test-audio.mp3',
  ]);

  // Should see 3 file items appear
  await page.waitForTimeout(3000);
  const fileItems = page.locator('[data-testid="file-item"]');
  await expect(fileItems).toHaveCount(3, { timeout: 10000 });
});

test('download ZIP of selected files', async ({ page }) => {
  // Navigate to a project with music and open mastering panel
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for app to load
  await page.waitForSelector('input[placeholder="Name your new track..."]', { timeout: 10000 });

  // Find and click on a project with music
  const projectWithMusic = page.locator('button').filter({ hasText: /^Music v\d+$/ }).first();
  const projectWithMusicCount = await projectWithMusic.count();

  if (projectWithMusicCount === 0) {
    test.skip('No project with music found');
    return;
  }
  await projectWithMusic.click();
  await page.waitForTimeout(2000);

  // Click Export button to open mastering panel
  const exportBtn = page.locator('button:has-text("Export")');
  if (await exportBtn.isDisabled()) {
    test.skip('Export step is disabled - needs music generated first');
    return;
  }
  await exportBtn.click();
  await page.waitForTimeout(2000);

  // Wait for mastering panel to load
  const masteringPanel = page.locator('.mastering-panel');
  await expect(masteringPanel).toBeVisible({ timeout: 10000 });

  // Wait for file items to appear (if any from previous uploads)
  await page.waitForTimeout(2000);

  // Set up download listener before clicking
  const downloadPromise = page.waitForEvent('download');

  // Select first two files if available
  const fileItems = page.locator('[data-testid="file-item"]');
  const fileCount = await fileItems.count();

  if (fileCount < 1) {
    test.skip('No files available in track library for ZIP download test');
    return;
  }

  // Click to select first file
  await fileItems.first().click();
  await page.waitForTimeout(300);

  // If there's a second file, select it too
  if (fileCount > 1) {
    await fileItems.nth(1).click();
    await page.waitForTimeout(300);
  }

  // Click Download ZIP button
  const zipBtn = page.locator('button:has-text("Download ZIP")');
  await expect(zipBtn).toBeVisible({ timeout: 5000 });
  await zipBtn.click();

  // Wait for download to start
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.zip');

  // Save and verify file exists
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
});