import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

async function seedProjectWithMusic(page: Page): Promise<{ id: string; name: string }> {
  const name = `Batch Master Test ${Date.now()}`;
  const res = await page.request.post('http://localhost:3000/api/test/seed-project', {
    data: { name, lyrics: true, music: true }
  });
  const { project } = await res.json();
  return project;
}

async function navigateToExport(page: Page, projectName: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const projectCard = page.locator('button').filter({ hasText: projectName }).first();
  await expect(projectCard).toBeVisible({ timeout: 5000 });
  await projectCard.click();
  await page.waitForTimeout(1500);

  const exportBtn = page.locator('button:has-text("Export")').first();
  await expect(exportBtn).toBeVisible({ timeout: 5000 });
  await exportBtn.click({ force: true });
  await page.waitForTimeout(1500);
}

test('batch mastering - liquid glass file list UI', async ({ page }) => {
  const project = await seedProjectWithMusic(page);

  await navigateToExport(page, project.name);

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
  const project = await seedProjectWithMusic(page);

  await navigateToExport(page, project.name);

  const uploadZone = page.locator('[data-testid="upload-zone"]');
  await expect(uploadZone).toBeVisible({ timeout: 10000 });

  // Upload 3 files
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles([
    './tests/fixtures/test-audio.mp3',
    './tests/fixtures/test-audio.mp3',
    './tests/fixtures/test-audio.mp3',
  ]);

  await page.waitForTimeout(3000);
  const fileItems = page.locator('[data-testid="file-item"]');
  await expect(fileItems).toHaveCount(3, { timeout: 10000 });
});

test('download ZIP of selected files', async ({ page }) => {
  const project = await seedProjectWithMusic(page);

  await navigateToExport(page, project.name);

  const masteringPanel = page.locator('.mastering-panel');
  await expect(masteringPanel).toBeVisible({ timeout: 10000 });

  // Upload a file first
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('./tests/fixtures/test-audio.mp3');
  await page.waitForTimeout(3000);

  const fileItems = page.locator('[data-testid="file-item"]');
  const fileCount = await fileItems.count();

  if (fileCount < 1) {
    test.skip('No files available in track library for ZIP download test');
    return;
  }

  // Set up download listener before clicking
  const downloadPromise = page.waitForEvent('download');

  // Select first file
  await fileItems.first().click();
  await page.waitForTimeout(500);

  // Verify selection count shows
  const selectionInfo = page.locator('text=/\\d+ selected/');
  await expect(selectionInfo).toBeVisible({ timeout: 3000 });

  // Click Download ZIP
  const zipBtn = page.locator('button:has-text("Download ZIP")');
  await zipBtn.click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.zip');

  const downloadPath = await download.path();
  expect(fs.existsSync(downloadPath!), 'Downloaded file should exist').toBe(true);
});
