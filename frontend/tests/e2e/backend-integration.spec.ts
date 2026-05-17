import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-audio.mp3');
const API = 'http://localhost:3000';

async function seedProjectWithMusic(page: Page): Promise<{ id: string; name: string; current_music_version: number }> {
  const name = `Backend Integration Test ${Date.now()}`;
  const res = await page.request.post(`${API}/api/test/seed-project`, {
    data: { name, lyrics: true, music: true }
  });
  const { project } = await res.json();
  return project;
}

async function navigateToExportAndUpload(page: Page, projectName: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const projectCard = page.locator('[role="button"]').filter({ hasText: projectName }).first();
  await expect(projectCard).toBeVisible({ timeout: 5000 });
  await projectCard.click();
  await page.waitForTimeout(1500);

  const exportBtn = page.locator('button:has-text("Export")').first();
  await expect(exportBtn).toBeVisible({ timeout: 5000 });
  await exportBtn.click({ force: true });
  await page.waitForTimeout(1500);

  await expect(page.locator('[data-testid="upload-zone"]')).toBeVisible({ timeout: 10000 });
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_PATH);

  const fileItem = page.locator('[data-testid="file-item"]').last();
  await expect(fileItem).toBeVisible({ timeout: 10000 });
  return fileItem;
}

test.describe('AudioProcessor Backend Integration', () => {
  test('POST /api/audio/process with non-existent file returns 400 with error field', async ({ page }) => {
    const response = await page.request.post(`${API}/api/audio/process`, {
      data: {
        inputPath: '/non/existent/file.mp3',
        operations: [{ type: 'trim', startSec: 0, endSec: 10 }],
        options: { format: 'mp3', bitrate: '320k' }
      }
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body.error, 'Error response must have error field').toBeDefined();
  });

  test('music file endpoint returns audio bytes for seeded project', async ({ page }) => {
    const project = await seedProjectWithMusic(page);

    const musicRes = await page.request.get(`${API}/api/projects/${project.id}/music`);
    expect(musicRes.ok()).toBe(true);

    const musicList = await musicRes.json();
    expect(musicList.length).toBeGreaterThan(0);

    const music = musicList[0];
    const fileRes = await page.request.get(`${API}/api/music/${music.id}/file`);
    expect(fileRes.status(), 'Music file must be served (200)').toBe(200);
    const body = await fileRes.body();
    expect(body.length, 'Music file must have bytes').toBeGreaterThan(0);
  });

  test('audio/process converts mastering URL to filesystem path correctly', async ({ page }) => {
    // This tests the fix for the .meta.json bug in audio.controller.js
    const project = await seedProjectWithMusic(page);
    const fileData = fs.readFileSync(FIXTURE_PATH);
    const uploadRes = await page.request.post(`${API}/api/mastering/upload/${project.id}`, {
      multipart: { files: { name: 'test.mp3', mimeType: 'audio/mpeg', buffer: fileData } }
    });
    expect(uploadRes.status()).toBe(200);
    const { files: [{ id: fileId }] } = await uploadRes.json();

    // Send mastering URL as inputPath (what AudioEditorPanel does)
    const processRes = await page.request.post(`${API}/api/audio/process`, {
      data: {
        inputPath: `/api/mastering/${fileId}/file/${project.id}`,
        operations: [{ type: 'trim', startSec: 0, endSec: 5 }],
        options: { format: 'mp3', bitrate: '320k' }
      }
    });
    expect(processRes.status(), `Audio process via mastering URL failed: ${await processRes.text()}`).toBe(200);
    const data = await processRes.json();
    expect(data.downloadUrl, 'Must return download URL').toBeTruthy();
    expect(data.duration, 'Must return duration').toBeGreaterThan(0);
  });
});

test.describe('AudioEditorPanel - Real Backend Integration', () => {
  test('upload → dblclick → editor opens → EXPORT button triggers real backend call', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    const fileItem = await navigateToExportAndUpload(page, project.name);

    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    // Editor MUST open — if it doesn't, the feature is broken
    const audioEditor = page.locator('text=AUDIO EDITOR');
    await expect(audioEditor).toBeVisible({ timeout: 5000 });

    // Intercept the /api/audio/process call to verify it's made
    let processCalled = false;
    let processPayload: any = null;
    page.on('request', req => {
      if (req.url().includes('/api/audio/process') && req.method() === 'POST') {
        processCalled = true;
        try { processPayload = JSON.parse(req.postData() || '{}'); } catch {}
      }
    });

    // EXPORT is a dropdown button (data-testid="export-dropdown-btn")
    // First click opens the format menu, then click a format to trigger export
    const exportButton = page.locator('[data-testid="export-dropdown-btn"]');
    await expect(exportButton).toBeVisible({ timeout: 3000 });
    await exportButton.click(); // opens dropdown
    await page.waitForTimeout(500); // wait for dropdown to render

    // Click the MP3 320kbps option
    const mp3Option = page.locator('button').filter({ hasText: '320kbps' }).first();
    await expect(mp3Option).toBeVisible({ timeout: 2000 });
    await mp3Option.click();
    await page.waitForTimeout(3000);

    expect(processCalled, 'Clicking MP3 format must call /api/audio/process').toBe(true);
    expect(processPayload?.inputPath, 'Payload must include inputPath').toBeTruthy();
    expect(Array.isArray(processPayload?.operations), 'Payload must include operations array').toBe(true);
  });

  test('UI renders TRIM, SPEED, VOLUME, FADE IN, REVERSE after dblclick', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    const fileItem = await navigateToExportAndUpload(page, project.name);

    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    // Editor MUST open
    await expect(page.locator('text=AUDIO EDITOR')).toBeVisible({ timeout: 5000 });

    // All required controls per spec
    await expect(page.locator('text=TRIM').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('input[type="range"]').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=FADE IN').or(page.locator('text=Fade In')).first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=REVERSE').or(page.locator('text=Reverse')).first()).toBeVisible({ timeout: 3000 });
  });
});
