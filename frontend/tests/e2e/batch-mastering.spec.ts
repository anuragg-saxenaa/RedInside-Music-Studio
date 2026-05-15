import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

// Helper to get a project that has music (so Export step is enabled)
async function getProjectWithMusic(page: Page) {
  const response = await page.request.get('http://localhost:3000/api/projects');
  const projects = await response.json();
  const projectsWithMusic = projects.filter((p: any) => p.current_music_version > 0);
  const uniqueName = projectsWithMusic.find((p: any) => {
    return projectsWithMusic.filter((o: any) => o.name === p.name).length === 1;
  });
  if (uniqueName) return uniqueName;
  return projectsWithMusic[0] || null;
}

test('batch mastering - liquid glass file list UI', async ({ page }) => {
  const project = await getProjectWithMusic(page);
  if (!project) {
    test.skip('No project with music found');
    return;
  }

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Navigate to project with music - use selector with music version to avoid duplicates
  const musicVersion = project.current_music_version;
  const projectCard = page.locator('button').filter({ hasText: new RegExp(`Music v${musicVersion}`) }).first();
  if (await projectCard.isVisible({ timeout: 3000 })) {
    await projectCard.click();
  }
  await page.waitForTimeout(1500);

  // Click Export step
  const exportBtn = page.locator('button:has-text("Export")').first();
  const isDisabled = await exportBtn.isDisabled();
  if (isDisabled) {
    const musicBtn = page.locator('button:has-text("Music")').first();
    if (await musicBtn.isVisible({ timeout: 2000 }) && !await musicBtn.isDisabled()) {
      await musicBtn.click();
      await page.waitForTimeout(1000);
    }
  }
  await exportBtn.click({ force: true });
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
  const project = await getProjectWithMusic(page);
  if (!project) {
    test.skip('No project with music found');
    return;
  }

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Navigate to project with music
  const musicVersion = project.current_music_version;
  const projectCard = page.locator('button').filter({ hasText: new RegExp(`Music v${musicVersion}`) }).first();
  if (await projectCard.isVisible({ timeout: 3000 })) {
    await projectCard.click();
  }
  await page.waitForTimeout(1500);

  // Navigate to Export step
  const exportBtn = page.locator('button:has-text("Export")').first();
  const isDisabled = await exportBtn.isDisabled();
  if (isDisabled) {
    const musicBtn = page.locator('button:has-text("Music")').first();
    if (await musicBtn.isVisible({ timeout: 2000 }) && !await musicBtn.isDisabled()) {
      await musicBtn.click();
      await page.waitForTimeout(1000);
    }
  }
  await exportBtn.click({ force: true });
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
  const project = await getProjectWithMusic(page);
  if (!project) {
    test.skip('No project with music found');
    return;
  }

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Navigate to project with music
  const musicVersion = project.current_music_version;
  const projectCard = page.locator('button').filter({ hasText: new RegExp(`Music v${musicVersion}`) }).first();
  if (await projectCard.isVisible({ timeout: 3000 })) {
    await projectCard.click();
  }
  await page.waitForTimeout(1500);

  // Navigate to Export step
  const exportBtn = page.locator('button:has-text("Export")').first();
  const isDisabled = await exportBtn.isDisabled();
  if (isDisabled) {
    const musicBtn = page.locator('button:has-text("Music")').first();
    if (await musicBtn.isVisible({ timeout: 2000 }) && !await musicBtn.isDisabled()) {
      await musicBtn.click();
      await page.waitForTimeout(1000);
    }
  }
  await exportBtn.click({ force: true });
  await page.waitForTimeout(2000);

  // Wait for mastering panel to load
  const masteringPanel = page.locator('.mastering-panel');
  await expect(masteringPanel).toBeVisible({ timeout: 10000 });

  // Wait for file items to appear (if any from previous uploads)
  await page.waitForTimeout(2000);

  // Check for files first
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

  // Wait for download
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.zip');

  const downloadPath = await download.path();
  expect(fs.existsSync(downloadPath!), 'Downloaded file should exist').toBe(true);

  console.log(`ZIP downloaded: ${download.suggestedFilename()}`);
});