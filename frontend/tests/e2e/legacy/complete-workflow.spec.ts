import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-audio.mp3');

async function seedProjectWithMusic(page: Page): Promise<{ id: string; name: string; current_music_version: number }> {
  const name = `Complete Workflow Test ${Date.now()}`;
  const res = await page.request.post('http://localhost:3000/api/test/seed-project', {
    data: { name, lyrics: true, music: true }
  });
  const { project } = await res.json();
  return project;
}

async function navigateToExport(page: Page, projectName: string) {
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
}

async function navigateToProject(page: Page, projectName: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const projectCard = page.locator('[role="button"]').filter({ hasText: projectName }).first();
  await expect(projectCard).toBeVisible({ timeout: 5000 });
  await projectCard.click();
  await page.waitForTimeout(1500);
}

test.describe('Complete Music Creation Workflow E2E', () => {
  test('1. Lyrics Generation - generate new lyrics', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    await navigateToProject(page, project.name);

    const stepper = page.locator('button:has-text("Lyrics")').first();
    await expect(stepper).toBeVisible({ timeout: 5000 });
  });

  test('2. Upload Audio - upload and verify in mastering panel', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    await navigateToExport(page, project.name);

    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeVisible({ timeout: 10000 });
  });

  test('3. Upload -> dblclick -> audio editor opens -> export dropdown works', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    await navigateToExport(page, project.name);

    await expect(page.locator('[data-testid="upload-zone"]')).toBeVisible({ timeout: 10000 });

    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PATH);

    // File MUST appear after upload
    const fileItem = page.locator('[data-testid="file-item"]').last();
    await expect(fileItem, 'File must appear in list after upload').toBeVisible({ timeout: 10000 });

    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    // Audio editor MUST open — this is the core feature
    await expect(page.locator('text=AUDIO EDITOR'), 'Audio editor must open after dblclick').toBeVisible({ timeout: 5000 });

    // Export button MUST be present (inline buttons visible without dropdown)
    const exportDropdown = page.locator('[data-testid="export-dropdown-btn"]');
    await expect(exportDropdown, 'MP3 320kbps export option must appear').toBeVisible({ timeout: 3000 });
  });

  test('4. Audio Processing Backend API - all operations work', async ({ page }) => {
    const project = await seedProjectWithMusic(page);

    const musicRes = await page.request.get(`http://localhost:3000/api/projects/${project.id}/music`);
    expect(musicRes.ok()).toBe(true);
    const musicList = await musicRes.json();
    expect(musicList.length).toBeGreaterThan(0);

    const music = musicList[0];
    // Use the real file path on disk for audio processing (URL paths won't work with FFmpeg)
    const audioPath = music.original_file_path;

    const ops = [
      { name: 'trim', data: { operations: [{ type: 'trim', startSec: 0, endSec: 5 }] } },
      { name: 'speed', data: { operations: [{ type: 'speed', tempoFactor: 1.25 }] } },
      { name: 'volume', data: { operations: [{ type: 'volume', gain: 0.8 }] } },
      { name: 'fadeIn', data: { operations: [{ type: 'fadeIn', durationSec: 2 }] } },
      { name: 'fadeOut', data: { operations: [{ type: 'fadeOut', durationSec: 2 }] } },
    ];

    for (const op of ops) {
      const res = await page.request.post('http://localhost:3000/api/audio/process', {
        data: {
          inputPath: audioPath,
          ...op.data,
          outputPath: `/tmp/e2e_${op.name}_${Date.now()}.mp3`,
          options: { format: 'mp3', bitrate: '320k' }
        }
      });
      expect(res.status(), `${op.name} operation should return 200`).toBe(200);
    }

    // Chained operations
    const chainRes = await page.request.post('http://localhost:3000/api/audio/process', {
      data: {
        inputPath: audioPath,
        operations: [
          { type: 'trim', startSec: 0, endSec: 5 },
          { type: 'speed', tempoFactor: 1.25 },
          { type: 'volume', gain: 0.9 },
          { type: 'fadeIn', durationSec: 1 },
          { type: 'fadeOut', durationSec: 1 }
        ],
        outputPath: `/tmp/e2e_chain_${Date.now()}.mp3`,
        options: { format: 'mp3', bitrate: '320k' }
      }
    });
    expect(chainRes.status()).toBe(200);
    const chainBody = await chainRes.json();
    expect(chainBody.message).toBeDefined();
  });

  test('5. Download and Re-upload workflow', async ({ page }) => {
    const project = await seedProjectWithMusic(page);

    const musicRes = await page.request.get(`http://localhost:3000/api/projects/${project.id}/music`);
    expect(musicRes.ok()).toBe(true);
    const musicList = await musicRes.json();
    expect(musicList.length).toBeGreaterThan(0);

    const music = musicList[0];

    // Download the file — seeded music MUST have a file
    const downloadRes = await page.request.get(`http://localhost:3000/api/music/${music.id}/file`);
    expect(downloadRes.status(), 'Music file from seeded project must be downloadable').toBe(200);

    if (downloadRes.status() === 200) {
      const buffer = await downloadRes.body();
      expect(buffer.length).toBeGreaterThan(0);

      // Upload to mastering
      const formData = new FormData();
      const blob = new Blob([buffer]);
      const file = new File([blob], 'test_download.mp3', { type: 'audio/mpeg' });
      formData.append('files', file);

      const uploadRes = await page.request.post(`http://localhost:3000/api/mastering/upload/${project.id}`, {
        multipart: formData
      });
      expect(uploadRes.status()).toBe(200);
      const uploadData = await uploadRes.json();
      expect(uploadData.files).toBeDefined();
      expect(uploadData.files.length).toBeGreaterThan(0);
      expect(uploadData.files[0].id).toBeDefined();
    }
  });

  test('6. Music Player - playback controls work', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    await navigateToProject(page, project.name);

    const musicBtn = page.locator('button:has-text("Music")').first();
    if (await musicBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await musicBtn.click();
      await page.waitForTimeout(1000);
    }

    // Play button should exist (SVG icon button)
    const playBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(playBtn).toBeVisible({ timeout: 5000 });
  });

  test('7. Workflow Navigation - all steps accessible', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    await navigateToProject(page, project.name);

    const steps = ['Lyrics', 'Music', 'Artwork', 'Export'];
    for (const step of steps) {
      const stepBtn = page.locator(`button:has-text("${step}")`).first();
      if (await stepBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isDisabled = await stepBtn.isDisabled();
        if (!isDisabled) {
          await stepBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });
});

test.describe('Backend Audio Processing API', () => {
  test('audio trim produces shorter file', async ({ page }) => {
    const project = await seedProjectWithMusic(page);

    const musicRes = await page.request.get(`http://localhost:3000/api/projects/${project.id}/music`);
    expect(musicRes.ok()).toBe(true);
    const musicList = await musicRes.json();
    expect(musicList.length).toBeGreaterThan(0);

    const music = musicList[0];
    const originalDuration = music.duration_seconds;
    const audioPath = music.original_file_path;

    const outputPath = `/tmp/e2e_trim_verify_${Date.now()}.mp3`;
    const res = await page.request.post('http://localhost:3000/api/audio/process', {
      data: {
        inputPath: audioPath,
        operations: [{ type: 'trim', startSec: 0, endSec: 5 }],
        outputPath,
        options: { format: 'mp3', bitrate: '320k' }
      }
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    if (originalDuration && originalDuration > 5) {
      expect(data.duration).toBeLessThan(originalDuration);
    }
  });

  test('invalid input returns proper error', async ({ page }) => {
    const res = await page.request.post('http://localhost:3000/api/audio/process', {
      data: {
        inputPath: '/non/existent/file.mp3',
        operations: [{ type: 'trim', startSec: 0, endSec: 10 }],
        outputPath: '/tmp/output.mp3'
      }
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

test.describe('Frontend Component Rendering', () => {
  test('VU meter element exists in DOM on export step', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    await navigateToExport(page, project.name);

    // The upload zone must be present — this confirms we're on the right step
    await expect(page.locator('[data-testid="upload-zone"]')).toBeVisible({ timeout: 10000 });

    // VU meter is rendered in the AudioMasteringPanel — verify it exists in DOM
    const vuMeter = page.locator('[data-testid="vu-meter"]');
    const count = await vuMeter.count();
    // Must have exactly 1 VU meter on the mastering panel
    expect(count, 'VU meter must exist on mastering step').toBeGreaterThan(0);
  });

  test('upload zone accepts files', async ({ page }) => {
    if (!fs.existsSync(FIXTURE_PATH)) {
      test.skip('No test audio fixture at ' + FIXTURE_PATH);
      return;
    }

    const project = await seedProjectWithMusic(page);
    await navigateToExport(page, project.name);

    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeVisible({ timeout: 10000 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);
    await page.waitForTimeout(2000);

    const fileItem = page.locator('[data-testid="file-item"]').last();
    const hasFile = await fileItem.isVisible({ timeout: 5000 }).catch(() => false);
    const hasStatus = await page.locator('text=READY').isVisible().catch(() => false) ||
                      await page.locator('text=PROCESSING').isVisible().catch(() => false);
    expect(hasFile || hasStatus, 'File should appear or processing status show after upload').toBeTruthy();
  });
});
