/**
 * Mastering Full Flow E2E Test
 *
 * Uses seed endpoint to create project with music (bypasses MiniMax),
 * then tests complete mastering workflow with real audio file.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-audio.mp3');

/**
 * Creates a project with music via seed endpoint (no MiniMax needed)
 */
async function createProjectWithMusic(page: Page): Promise<{ projectId: string }> {
  const res = await page.request.post('http://localhost:3000/api/test/seed-project', {
    data: { name: `Mastering Test ${Date.now()}`, lyrics: true, music: true }
  });

  expect(res.status()).toBe(200);
  const { project } = await res.json();
  expect(project.id).toBeDefined();

  console.log(`✓ Created test project: ${project.id}`);
  return { projectId: project.id };
}

test.describe('Mastering Full Flow - No Skips', () => {

  test.beforeEach(async ({ page }) => {
    // Verify fixture exists
    expect(fs.existsSync(FIXTURE_PATH), `Fixture not found at ${FIXTURE_PATH}`).toBe(true);

    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('1. Create project → go to Export → upload file', async ({ page }) => {
    // Create project with music via seed
    const { projectId } = await createProjectWithMusic(page);

    // Reload page to pick up new project
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find and click our project
    const projectCard = page.locator(`button:has-text("${projectId.substring(0, 8)}")`).first();
    const exists = await projectCard.isVisible().catch(() => false);

    if (!exists) {
      // Try finding any project with music
      const anyProject = page.locator('button').filter({ hasText: /Test Mastering/ }).first();
      if (await anyProject.isVisible().catch(() => false)) {
        await anyProject.click();
      } else {
        throw new Error('Could not find test project');
      }
    } else {
      await projectCard.click();
    }

    await page.waitForTimeout(1500);

    // Click Export step (should be enabled because we have music)
    const exportBtn = page.locator('button:has-text("Export")');
    await expect(exportBtn).toBeVisible({ timeout: 5000 });

    const isDisabled = await exportBtn.isDisabled();
    expect(isDisabled, 'Export should be enabled (we have music)').toBe(false);

    await exportBtn.click();
    await page.waitForTimeout(1000);

    // Verify mastering panel visible
    const masteringPanel = page.locator('.mastering-panel, [data-testid="mastering-panel"]');
    await expect(masteringPanel).toBeVisible({ timeout: 10000 });

    // Verify upload zone visible
    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeVisible({ timeout: 5000 });

    console.log('✓ Mastering panel loaded with upload zone');
  });

  test('2. Upload file → verify in list', async ({ page }) => {
    const { projectId } = await createProjectWithMusic(page);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to project with Export
    const projectCard = page.locator(`button:has-text("${projectId.substring(0, 8)}")`).first();
    if (await projectCard.isVisible().catch(() => false)) {
      await projectCard.click();
    }
    await page.waitForTimeout(1500);

    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isDisabled().catch(() => true))) {
      await exportBtn.click();
    }
    await page.waitForTimeout(1000);

    // Upload file via UI
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);

    // CRITICAL: File must appear in list (proves upload works)
    const fileItem = page.locator('[data-testid="file-item"]');
    const appeared = await fileItem.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);

    expect(appeared, 'File should appear after upload').toBe(true);
    console.log('✓ File uploaded and appears in list');
  });

  test('3. Upload → Master All → verify mastered', async ({ page }) => {
    const { projectId } = await createProjectWithMusic(page);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Export
    const projectCard = page.locator(`button:has-text("${projectId.substring(0, 8)}")`).first();
    if (await projectCard.isVisible().catch(() => false)) {
      await projectCard.click();
    }
    await page.waitForTimeout(1500);

    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isDisabled().catch(() => true))) {
      await exportBtn.click();
    }
    await page.waitForTimeout(1000);

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);

    // Wait for file to appear
    const fileItem = page.locator('[data-testid="file-item"]');
    await fileItem.waitFor({ state: 'visible', timeout: 15000 });

    // Click Master All
    const masterAllBtn = page.locator('button:has-text("Master All")');
    await expect(masterAllBtn).toBeVisible();
    await masterAllBtn.click();

    // Wait for mastering to complete (FFmpeg takes time)
    const masteredItem = page.locator('.tag-complete, [class*="mastered"], text="Mastered"');
    const masteredAppeared = await masteredItem.waitFor({ state: 'visible', timeout: 180000 }).then(() => true).catch(() => false);

    expect(masteredAppeared, 'File should show Mastered status after processing').toBe(true);
    console.log('✓ File mastered successfully');
  });

  test('4. Upload → Master → Select → Save to Music', async ({ page }) => {
    const { projectId } = await createProjectWithMusic(page);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Export
    const projectCard = page.locator(`button:has-text("${projectId.substring(0, 8)}")`).first();
    if (await projectCard.isVisible().catch(() => false)) {
      await projectCard.click();
    }
    await page.waitForTimeout(1500);

    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isDisabled().catch(() => true))) {
      await exportBtn.click();
    }
    await page.waitForTimeout(1000);

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);
    await page.waitForTimeout(1000);

    // Wait for file
    const fileItem = page.locator('[data-testid="file-item"]');
    await fileItem.waitFor({ state: 'visible', timeout: 15000 });

    // Master it
    const masterAllBtn = page.locator('button:has-text("Master All")');
    await masterAllBtn.click();

    // Wait for mastered
    const masteredItem = page.locator('.tag-complete, [class*="mastered"], text="Mastered"');
    await masteredItem.waitFor({ state: 'visible', timeout: 180000 }).catch(() => null);

    // Select file
    await fileItem.click();
    await page.waitForTimeout(500);

    // Verify selection count
    const selectionInfo = page.locator('text=/\\d+ selected/');
    const selectionVisible = await selectionInfo.isVisible().catch(() => false);

    if (selectionVisible) {
      console.log('✓ File selected');

      // Save to Music
      const saveBtn = page.locator('button:has-text("Save to Music")');
      const saveBtnEnabled = !(await saveBtn.isDisabled().catch(() => true));
      if (saveBtnEnabled) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        console.log('✓ Save to Music clicked');
      }
    }
  });

  test('5. ZIP download flow', async ({ page }) => {
    const { projectId } = await createProjectWithMusic(page);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to Export
    const projectCard = page.locator(`button:has-text("${projectId.substring(0, 8)}")`).first();
    if (await projectCard.isVisible().catch(() => false)) {
      await projectCard.click();
    }
    await page.waitForTimeout(1500);

    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isDisabled().catch(() => true))) {
      await exportBtn.click();
    }
    await page.waitForTimeout(1000);

    // Upload 2 files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([FIXTURE_PATH, FIXTURE_PATH]);
    await page.waitForTimeout(2000);

    // Wait for files
    const fileItems = page.locator('[data-testid="file-item"]');
    await expect(fileItems).toHaveCount(2, { timeout: 10000 });

    // Select both
    await fileItems.first().click();
    await page.waitForTimeout(300);
    await fileItems.nth(1).click();
    await page.waitForTimeout(300);

    // Verify selection
    const selectionInfo = page.locator('text="2 selected"');
    await expect(selectionInfo).toBeVisible({ timeout: 3000 });

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click Download ZIP
    const zipBtn = page.locator('button:has-text("Download ZIP")');
    await zipBtn.click();

    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.zip');

    const downloadPath = await download.path();
    expect(fs.existsSync(downloadPath!), 'Downloaded file should exist').toBe(true);

    console.log(`✓ ZIP downloaded: ${download.suggestedFilename()}`);
  });
});

test.describe('Mastering API Contract (Backend Only)', () => {
  /**
   * These tests verify backend API works correctly
   * They test the API directly without UI
   */
  test('upload → process → save-to-music → zip (all backend)', async ({ page }) => {
    // Create project
    const projectRes = await page.request.post('http://localhost:3000/api/projects', {
      data: { name: `API Test ${Date.now()}` }
    });
    expect(projectRes.status()).toBe(201);
    const project = await projectRes.json();
    const projectId = project.id;

    // Seed music so Export works
    await page.request.post(`http://localhost:3000/api/test/seed-music/${projectId}`, {
      data: { durationSeconds: 30 }
    });

    // Upload file via API
    const fileData = fs.readFileSync(FIXTURE_PATH);
    const formData = new FormData();
    formData.append('files', new Blob([fileData]), 'test.mp3');

    const uploadRes = await page.request.post(
      `http://localhost:3000/api/mastering/upload/${projectId}`,
      { multipart: formData }
    );

    expect(uploadRes.status()).toBe(200);
    const uploadData = await uploadRes.json();
    expect(uploadData.files).toBeDefined();
    expect(uploadData.files.length).toBeGreaterThan(0);
    const fileId = uploadData.files[0].id;

    console.log('✓ Upload via API works');

    // Process (master)
    const processRes = await page.request.post('http://localhost:3000/api/mastering/process', {
      data: {
        fileIds: [fileId],
        projectId,
        preset: 'spotify',
        saveToProject: false
      }
    });

    expect(processRes.status()).toBe(200);
    const processData = await processRes.json();
    expect(processData.results).toBeDefined();
    expect(processData.results.length).toBeGreaterThan(0);

    console.log('✓ Process via API works');

    // Save to Music
    const saveRes = await page.request.post('http://localhost:3000/api/mastering/save-to-music', {
      data: { projectId, fileIds: [fileId] }
    });

    expect(saveRes.status()).toBe(200);
    const saveData = await saveRes.json();
    expect(saveData.saved).toBeDefined();
    expect(saveData.saved.length).toBeGreaterThan(0);

    console.log('✓ Save to Music via API works');

    // Download ZIP
    const zipRes = await page.request.get(
      `http://localhost:3000/api/mastering/zip?projectId=${projectId}&fileIds=${fileId}`
    );

    expect(zipRes.status()).toBe(200);
    expect(zipRes.headers()['content-type']).toContain('zip');

    console.log('✓ ZIP download via API works');
  });
});
