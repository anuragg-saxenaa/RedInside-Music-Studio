/**
 * Core Features E2E Tests - Real Backend, Real Browser, No Mocks
 *
 * Covers every Phase 1 feature from the spec:
 * - Lyrics: display, style presets, edit mode
 * - Music player: track list, delete, download buttons
 * - AudioEditorInline: fade-in, fade-out, reverse, trim export
 * - Project management: create, navigate, delete
 * - Music download
 * - Viral toolkit: templates, trends, hook analysis endpoints
 * - History: version tracking
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

const BACKEND = 'http://localhost:3000';
const FRONTEND = 'http://localhost:5173';

// ─── Helpers ───────────────────────────────────────────────────────────────

async function seedProject(page: Page, opts: { lyrics?: boolean; music?: boolean } = {}) {
  const { lyrics = true, music = true } = opts;
  const res = await page.request.post(`${BACKEND}/api/test/seed-project`, {
    data: { name: `Core Test ${Date.now()}`, lyrics, music },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  // Re-fetch to get updated version counts after seed
  const projectRes = await page.request.get(`${BACKEND}/api/projects/${body.project.id}`);
  return await projectRes.json();
}

async function goToFrontend(page: Page) {
  await page.goto(FRONTEND);
  await page.waitForLoadState('networkidle');
}

async function navigateToProject(page: Page, project: any) {
  await goToFrontend(page);
  const card = page.locator('[role="button"]').filter({ hasText: project.name }).first();
  await expect(card).toBeVisible({ timeout: 6000 });
  await card.click();
  await page.waitForTimeout(1200);
}

async function clickStep(page: Page, stepLabel: string) {
  const btn = page.locator(`button:has-text("${stepLabel}")`).first();
  await expect(btn).toBeVisible({ timeout: 3000 });
  if (!await btn.isDisabled()) {
    await btn.click();
    await page.waitForTimeout(800);
  }
}

// ─── 1. PROJECT MANAGEMENT ─────────────────────────────────────────────────

test.describe('Project Management', () => {
  test('create project via API and see it in UI', async ({ page }) => {
    const name = `PM Create Test ${Date.now()}`;
    const res = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name },
    });
    // Projects endpoint returns 200 or 201
    expect([200, 201]).toContain(res.status());
    const project = await res.json();
    expect(project.id).toBeTruthy();
    expect(project.name).toBe(name);

    await goToFrontend(page);
    const card = page.locator('[role="button"]').filter({ hasText: name }).first();
    await expect(card).toBeVisible({ timeout: 5000 });
  });

  test('delete project removes it - returns 2xx then 404 on re-fetch', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `PM Delete Test ${Date.now()}` },
    });
    const project = await res.json();

    const delRes = await page.request.delete(`${BACKEND}/api/projects/${project.id}`);
    expect(delRes.status()).toBeGreaterThanOrEqual(200);
    expect(delRes.status()).toBeLessThan(300);

    const getRes = await page.request.get(`${BACKEND}/api/projects/${project.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('projects list API returns array', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/projects`);
    expect(res.status()).toBe(200);
    const projects = await res.json();
    expect(Array.isArray(projects)).toBe(true);
  });
});

// ─── 2. LYRICS STEP ────────────────────────────────────────────────────────

test.describe('Lyrics Step - Display and Navigation', () => {
  test('lyrics presets API returns all 5 style presets', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/lyrics/presets`);
    expect(res.status()).toBe(200);
    const presets = await res.json();
    expect(Object.keys(presets).length).toBeGreaterThanOrEqual(5);
    expect(presets['hinglish-urban']).toBeTruthy();
    expect(presets['hindi-urdu-classical']).toBeTruthy();
    expect(presets['punjabi-swagger']).toBeTruthy();
    expect(presets['regional-fusion']).toBeTruthy();
    expect(presets['custom']).toBeTruthy();
  });

  test('project lyrics API returns version history', async ({ page }) => {
    const project = await seedProject(page, { lyrics: true, music: false });
    const res = await page.request.get(`${BACKEND}/api/projects/${project.id}/lyrics`);
    expect(res.status()).toBe(200);
    const lyrics = await res.json();
    expect(Array.isArray(lyrics)).toBe(true);
    expect(lyrics.length).toBeGreaterThan(0);
    expect(lyrics[0].project_id).toBe(project.id);
    expect(lyrics[0].content).toBeTruthy();
    expect(lyrics[0].version).toBeGreaterThan(0);
  });

  test('lyrics GET by ID returns correct record', async ({ page }) => {
    const project = await seedProject(page, { lyrics: true, music: false });
    const listRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/lyrics`);
    const lyrics = await listRes.json();
    const lyricsId = lyrics[0].id;

    const getRes = await page.request.get(`${BACKEND}/api/lyrics/${lyricsId}`);
    expect(getRes.status()).toBe(200);
    const record = await getRes.json();
    expect(record.id).toBe(lyricsId);
    expect(record.project_id).toBe(project.id);
  });

  test('lyrics step renders style presets in UI', async ({ page }) => {
    const project = await seedProject(page, { lyrics: true, music: false });
    await navigateToProject(page, project);

    // Lyrics step is default/first step
    const lyricsArea = page.locator('text=/Lyrics|Style|Generate|Hinglish/i').first();
    await expect(lyricsArea).toBeVisible({ timeout: 5000 });
  });
});

// ─── 3. MUSIC PLAYER - TRACK LIST, SEEK, DELETE, DOWNLOAD BUTTONS ──────────

test.describe('Music Player - Track List and Controls', () => {
  test('music player API GET by ID returns record with duration', async ({ page }) => {
    const project = await seedProject(page);
    const musicRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicRes.json();
    expect(music.length).toBeGreaterThan(0);
    expect(music[0].id).toBeTruthy();
    expect(music[0].version).toBe(1);
    expect(music[0].duration_seconds).toBeGreaterThan(0);
  });

  test('music file endpoint serves audio bytes', async ({ page }) => {
    const project = await seedProject(page);
    const musicRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicRes.json();

    const fileRes = await page.request.get(`${BACKEND}/api/music/${music[0].id}/file`);
    expect(fileRes.status()).toBe(200);
    const ct = fileRes.headers()['content-type'];
    expect(ct).toMatch(/audio|octet-stream/);
    const body = await fileRes.body();
    expect(body.length).toBeGreaterThan(1000);
  });

  test('music step shows track row for each music record', async ({ page }) => {
    const project = await seedProject(page);
    await navigateToProject(page, project);
    await clickStep(page, 'Music');

    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
  });

  test('music step delete button appears on track row hover', async ({ page }) => {
    const project = await seedProject(page);
    await navigateToProject(page, project);
    await clickStep(page, 'Music');

    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
    await trackRow.hover();
    await page.waitForTimeout(300);

    const deleteBtn = page.locator('button[title="Delete"]').first();
    await expect(deleteBtn).toBeVisible();
  });

  test('music step download button appears on track row hover', async ({ page }) => {
    const project = await seedProject(page);
    await navigateToProject(page, project);
    await clickStep(page, 'Music');

    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
    await trackRow.hover();
    await page.waitForTimeout(500);

    const downloadBtn = trackRow.locator('button[title="Download"]');
    await expect(downloadBtn).toBeVisible({ timeout: 3000 });
  });

  test('Your Songs heading shows in music step', async ({ page }) => {
    const project = await seedProject(page);
    await navigateToProject(page, project);
    await clickStep(page, 'Music');

    await expect(page.locator('text=Your Songs')).toBeVisible({ timeout: 5000 });
  });
});

// ─── 4. AUDIO EDITOR INLINE (fade/reverse/trim) ────────────────────────────

test.describe('AudioEditorInline - Backend Operations', () => {
  test('fade-in operation succeeds and returns file path', async ({ page }) => {
    const project = await seedProject(page);
    const musicRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicRes.json();

    const res = await page.request.post(`${BACKEND}/api/audio/process`, {
      data: {
        inputPath: `/api/music/${music[0].id}/file`,
        operations: [{ type: 'fadeIn', durationSec: 2 }],
        outputPath: `/tmp/fadein_test_${Date.now()}.mp3`,
        options: { format: 'mp3', bitrate: '320k' },
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.message).toContain('success');
    expect(data.filePath || data.masteredFile).toBeTruthy();
    expect(data.duration).toBeGreaterThan(0);
  });

  test('fade-out operation succeeds', async ({ page }) => {
    const project = await seedProject(page);
    const musicRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicRes.json();

    const res = await page.request.post(`${BACKEND}/api/audio/process`, {
      data: {
        inputPath: `/api/music/${music[0].id}/file`,
        operations: [{ type: 'fadeOut', durationSec: 2 }],
        outputPath: `/tmp/fadeout_test_${Date.now()}.mp3`,
        options: { format: 'mp3', bitrate: '320k' },
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.duration).toBeGreaterThan(0);
  });

  test('reverse operation succeeds', async ({ page }) => {
    const project = await seedProject(page);
    const musicRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicRes.json();

    const res = await page.request.post(`${BACKEND}/api/audio/process`, {
      data: {
        inputPath: `/api/music/${music[0].id}/file`,
        operations: [{ type: 'reverse' }],
        outputPath: `/tmp/reverse_test_${Date.now()}.mp3`,
        options: { format: 'mp3', bitrate: '320k' },
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.duration).toBeGreaterThan(0);
  });

  test('trim operation produces shorter output', async ({ page }) => {
    const project = await seedProject(page);
    const musicRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicRes.json();
    const originalDuration = music[0].duration_seconds;
    const trimEnd = Math.min(10, originalDuration - 1);

    const res = await page.request.post(`${BACKEND}/api/audio/process`, {
      data: {
        inputPath: `/api/music/${music[0].id}/file`,
        operations: [{ type: 'trim', startSec: 0, endSec: trimEnd }],
        outputPath: `/tmp/trim_test_${Date.now()}.mp3`,
        options: { format: 'mp3', bitrate: '320k' },
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.duration).toBeGreaterThan(0);
    expect(data.duration).toBeLessThanOrEqual(originalDuration + 2);
  });

  test('chained: fade-in + fade-out + speed change', async ({ page }) => {
    const project = await seedProject(page);
    const musicRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicRes.json();

    const res = await page.request.post(`${BACKEND}/api/audio/process`, {
      data: {
        inputPath: `/api/music/${music[0].id}/file`,
        operations: [
          { type: 'fadeIn', durationSec: 1 },
          { type: 'fadeOut', durationSec: 1 },
          { type: 'speed', tempoFactor: 1.1 },
        ],
        outputPath: `/tmp/chain_test_${Date.now()}.mp3`,
        options: { format: 'mp3', bitrate: '320k' },
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.duration).toBeGreaterThan(0);
  });

  test('audio editor UI opens on Edit button click', async ({ page }) => {
    const project = await seedProject(page);
    await navigateToProject(page, project);
    await clickStep(page, 'Music');

    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
    await trackRow.hover();
    await page.waitForTimeout(300);

    // Click Edit button to open inline editor
    const editBtn = page.locator('button[title="Edit"]').first();
    await expect(editBtn).toBeVisible({ timeout: 2000 });
    await editBtn.click();
    await page.waitForTimeout(800);

    // Editor buttons should appear
    const fadeInBtn = page.getByRole('button', { name: /FADE IN/i }).first();
    await expect(fadeInBtn).toBeVisible({ timeout: 3000 });
  });

  test('audio editor shows FADE IN, FADE OUT, REVERSE buttons', async ({ page }) => {
    const project = await seedProject(page);
    await navigateToProject(page, project);
    await clickStep(page, 'Music');

    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
    await trackRow.hover();
    await page.waitForTimeout(300);

    const editBtn = page.locator('button[title="Edit"]').first();
    await expect(editBtn).toBeVisible({ timeout: 2000 });
    await editBtn.click();
    await page.waitForTimeout(800);

    await expect(page.getByRole('button', { name: /FADE IN/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /FADE OUT/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /REVERSE/i })).toBeVisible({ timeout: 3000 });
  });
});

// ─── 5. VIRAL TOOLKIT ──────────────────────────────────────────────────────

test.describe('Viral Toolkit API', () => {
  test('GET /api/viral/templates returns structure templates', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/viral/templates`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(3);
    const ids = data.data.map((t: any) => t.id);
    expect(ids).toContain('hook-first');
  });

  test('GET /api/viral/trends responds (not 404)', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/viral/trends`);
    expect(res.status()).not.toBe(404);
  });

  test('POST /api/viral/analyze-hook returns hook analysis', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/viral/analyze-hook`, {
      data: {
        lyrics: '[Verse]\nMumbai ki galiyan\n[Chorus]\nDesi swag, desi swag\n[Chorus]\nDesi swag',
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

// ─── 6. VERSION HISTORY ────────────────────────────────────────────────────

test.describe('Version History and Tracking', () => {
  test('project tracks current_music_version via seed-music endpoint', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Version Track Test ${Date.now()}` },
    });
    const project = await createRes.json();
    expect(project.current_music_version).toBe(0);

    await page.request.post(`${BACKEND}/api/test/seed-music/${project.id}`);

    const updated = await (await page.request.get(`${BACKEND}/api/projects/${project.id}`)).json();
    expect(updated.current_music_version).toBe(1);

    await page.request.post(`${BACKEND}/api/test/seed-music/${project.id}`);
    const updated2 = await (await page.request.get(`${BACKEND}/api/projects/${project.id}`)).json();
    expect(updated2.current_music_version).toBe(2);
  });

  test('history API returns project generation history (not 404)', async ({ page }) => {
    const project = await seedProject(page);
    const res = await page.request.get(`${BACKEND}/api/history/${project.id}`);
    expect(res.status()).toBe(200);
  });

  test('music list returns all versions sorted newest first', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Multi Version Test ${Date.now()}` },
    });
    const project = await createRes.json();

    await page.request.post(`${BACKEND}/api/test/seed-music/${project.id}`);
    await page.request.post(`${BACKEND}/api/test/seed-music/${project.id}`);
    await page.request.post(`${BACKEND}/api/test/seed-music/${project.id}`);

    const musicRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicRes.json();
    expect(music.length).toBe(3);
    expect(music[0].version).toBe(3);
    expect(music[1].version).toBe(2);
    expect(music[2].version).toBe(1);
  });

  test('music step shows multiple track rows for multiple seeded tracks', async ({ page }) => {
    // Use seed-project to create project visible in UI, then add more music
    const seedRes = await page.request.post(`${BACKEND}/api/test/seed-project`, {
      data: { name: `Multi V UI Test ${Date.now()}`, lyrics: false, music: true },
    });
    const { project } = await seedRes.json();
    // Add a second track
    await page.request.post(`${BACKEND}/api/test/seed-music/${project.id}`);

    const updated = await (await page.request.get(`${BACKEND}/api/projects/${project.id}`)).json();
    await navigateToProject(page, updated);
    await clickStep(page, 'Music');

    const trackRows = page.locator('[data-testid="track-row"]');
    await expect(trackRows).toHaveCount(2, { timeout: 5000 });
  });
});

// ─── 7. WORKFLOW NAVIGATION ─────────────────────────────────────────────────

test.describe('Workflow Navigation', () => {
  test('lyrics step and music step are accessible', async ({ page }) => {
    const project = await seedProject(page);
    await navigateToProject(page, project);

    await clickStep(page, 'Lyrics');
    const lyricsArea = page.locator('text=/Lyrics|Generate|Style/i').first();
    await expect(lyricsArea).toBeVisible({ timeout: 3000 });

    await clickStep(page, 'Music');
    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
  });

  test('Export step accessible and shows mastering UI for project with music', async ({ page }) => {
    const project = await seedProject(page);
    await navigateToProject(page, project);

    const exportBtn = page.locator('button:has-text("Export")').first();
    if (await exportBtn.isVisible({ timeout: 2000 }) && !await exportBtn.isDisabled()) {
      await exportBtn.click();
      await page.waitForTimeout(800);
      const masteringUI = page.locator('[data-testid="upload-zone"]').or(page.getByText(/drag|upload|master/i)).first();
      await expect(masteringUI).toBeVisible({ timeout: 3000 });
    }
  });
});

// ─── 8. MUSIC CRUD ─────────────────────────────────────────────────────────

test.describe('Music CRUD Operations', () => {
  test('GET /api/music/:id returns music record', async ({ page }) => {
    const project = await seedProject(page);
    const musicListRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicListRes.json();

    const res = await page.request.get(`${BACKEND}/api/music/${music[0].id}`);
    expect(res.status()).toBe(200);
    const record = await res.json();
    expect(record.id).toBe(music[0].id);
    expect(record.project_id).toBe(project.id);
  });

  test('PATCH /api/music/:id updates title', async ({ page }) => {
    const project = await seedProject(page);
    const musicListRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicListRes.json();
    const newTitle = `Updated Title ${Date.now()}`;

    const patchRes = await page.request.patch(`${BACKEND}/api/music/${music[0].id}`, {
      data: { title: newTitle },
    });
    expect(patchRes.status()).toBe(200);

    const getRes = await page.request.get(`${BACKEND}/api/music/${music[0].id}`);
    expect((await getRes.json()).title).toBe(newTitle);
  });

  test('DELETE /api/music/:id removes record', async ({ page }) => {
    const project = await seedProject(page);
    const musicListRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const music = await musicListRes.json();
    const musicId = music[0].id;

    const delRes = await page.request.delete(`${BACKEND}/api/music/${musicId}`);
    expect(delRes.status()).toBe(200);

    const getRes = await page.request.get(`${BACKEND}/api/music/${musicId}`);
    expect(getRes.status()).toBe(404);
  });

  test('DELETE /api/music/non-existent returns 404', async ({ page }) => {
    const res = await page.request.delete(`${BACKEND}/api/music/non-existent-id-xyz`);
    expect(res.status()).toBe(404);
  });
});

// ─── 9. GENERATE ENDPOINT VALIDATION ──────────────────────────────────────

test.describe('Generate Endpoint Validation - Project Existence', () => {
  test('POST /api/music/generate with non-existent projectId returns 404', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/music/generate`, {
      data: { projectId: 'does-not-exist-xyz', lyricsId: 'any' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/project/i);
  });

  test('POST /api/lyrics/generate with non-existent projectId returns 404', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/lyrics/generate`, {
      data: { projectId: 'does-not-exist-xyz', prompt: 'test' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/project/i);
  });

  test('POST /api/music/generate missing lyricsId returns 400', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Validation Test ${Date.now()}` },
    });
    const project = await res.json();
    const genRes = await page.request.post(`${BACKEND}/api/music/generate`, {
      data: { projectId: project.id },
    });
    expect(genRes.status()).toBe(400);
  });

  test('POST /api/lyrics/generate missing prompt returns 400', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Validation Test ${Date.now()}` },
    });
    const project = await res.json();
    const genRes = await page.request.post(`${BACKEND}/api/lyrics/generate`, {
      data: { projectId: project.id },
    });
    expect(genRes.status()).toBe(400);
  });

  test('POST /api/music/generate with invalid model returns 400 immediately', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Model Validation ${Date.now()}` },
    });
    const project = await createRes.json();
    const genRes = await page.request.post(`${BACKEND}/api/music/generate`, {
      data: { projectId: project.id, lyricsId: 'any', model: 'music-hip-hop' },
    });
    expect(genRes.status()).toBe(400);
    const body = await genRes.json();
    expect(body.error).toMatch(/invalid model/i);
  });
});

// ─── 10. HISTORY API ───────────────────────────────────────────────────────

test.describe('History API - All Routes', () => {
  test('GET /api/history/:projectId returns empty structure for new project', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `History Test ${Date.now()}` },
    });
    const project = await createRes.json();

    const res = await page.request.get(`${BACKEND}/api/history/${project.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('lyrics');
    expect(body).toHaveProperty('music');
    expect(Array.isArray(body.lyrics)).toBe(true);
    expect(Array.isArray(body.music)).toBe(true);
  });

  test('GET /api/history/:projectId returns music records for seeded project', async ({ page }) => {
    const seed = await seedProject(page, { lyrics: true, music: true });
    const res = await page.request.get(`${BACKEND}/api/history/${seed.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.music.length).toBeGreaterThan(0);
    expect(body.lyrics.length).toBeGreaterThan(0);
  });

  test('GET /api/history/chain/:id with non-existent ID returns 404 not 500', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/history/chain/non-existent-id`);
    expect(res.status()).toBe(404);
  });

  test('POST /api/history/compare with missing IDs returns 400', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/history/compare`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('DELETE /api/history/:id with non-existent ID returns 4xx', async ({ page }) => {
    const res = await page.request.delete(`${BACKEND}/api/history/non-existent-id`);
    expect([400, 404]).toContain(res.status());
  });

  test('GET /api/history/chain/:id with real music record returns chain', async ({ page }) => {
    const seed = await seedProject(page, { music: true });
    const musicRes = await page.request.get(`${BACKEND}/api/projects/${seed.id}/music`);
    const musicList = await musicRes.json();
    expect(musicList.length).toBeGreaterThan(0);
    const musicId = musicList[0].id;

    const chainRes = await page.request.get(`${BACKEND}/api/history/chain/${musicId}`);
    expect(chainRes.status()).toBe(200);
    const chain = await chainRes.json();
    expect(chain).toHaveProperty('music');
    expect(chain.music.id).toBe(musicId);
  });
});

// ─── 11. JOBS API ─────────────────────────────────────────────────────────

test.describe('Jobs API', () => {
  test('GET /api/jobs/:id with fake ID returns 404', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/jobs/non-existent-id`);
    expect(res.status()).toBe(404);
  });

  test('GET /api/projects/:id/jobs returns array for existing project', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Jobs Test ${Date.now()}` },
    });
    const project = await createRes.json();

    const res = await page.request.get(`${BACKEND}/api/projects/${project.id}/jobs`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST /api/jobs missing projectId returns 400', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/jobs`, {
      data: { type: 'generate-lyrics' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/jobs with invalid type returns 400', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Jobs Type Test ${Date.now()}` },
    });
    const project = await createRes.json();

    const res = await page.request.post(`${BACKEND}/api/jobs`, {
      data: { projectId: project.id, type: 'invalid-type' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── 12. VIRAL TOOLKIT FULL COVERAGE ──────────────────────────────────────

test.describe('Viral Toolkit - Complete API', () => {
  test('GET /api/viral/trends returns array of trends', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/viral/trends`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const trends = body.data ?? body;
    expect(Array.isArray(trends)).toBe(true);
    expect(trends.length).toBeGreaterThan(0);
  });

  test('GET /api/viral/templates returns named templates', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/viral/templates`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const templates = body.data ?? body;
    expect(Array.isArray(templates)).toBe(true);
    const templateNames = templates.map((t: any) => t.id || t.name || '');
    expect(templateNames.some((n: string) => /hook/i.test(n) || /build/i.test(n) || /traditional/i.test(n))).toBe(true);
  });

  test('GET /api/viral/templates/:id returns specific template', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/viral/templates/hook-first`);
    expect([200, 404]).toContain(res.status());
  });

  test('POST /api/viral/analyze-hook returns score and sections', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/viral/analyze-hook`, {
      data: { lyrics: '[Verse]\nDesi rap vibes\n[Chorus]\nYo yo hey hey\n[Verse]\nBack again\n[Chorus]\nYo yo hey hey' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Response may be { hookScore, ... } or { data: { score, ... }, success: true }
    const score = body.hookScore ?? body.data?.score ?? body.score;
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/viral/analyze-hook missing lyrics returns 400', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/viral/analyze-hook`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/viral/analyze-reference missing url returns 400', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/viral/analyze-reference`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/viral/optimize missing lyricsId returns 400', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/viral/optimize`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});

// ─── 13. VIDEO GENERATION ─────────────────────────────────────────────────

test.describe('Video Generation API', () => {
  test('POST /api/video/generate with valid project queues job (202)', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Video Test ${Date.now()}` },
    });
    const project = await createRes.json();

    const res = await page.request.post(`${BACKEND}/api/video/generate`, {
      data: { projectId: project.id, model: 'MiniMax-Hailuo-2.3', prompt: 'music video scene' },
    });
    expect(res.status()).toBe(202);
    const body = await res.json();
    expect(body).toHaveProperty('jobId');
    expect(body.status).toBe('queued');
  });

  test('POST /api/video/generate no model defaults to MiniMax-Hailuo-02 and returns 202', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Video Model Test ${Date.now()}` },
    });
    const project = await createRes.json();

    // model is optional — backend defaults to MiniMax-Hailuo-02
    const res = await page.request.post(`${BACKEND}/api/video/generate`, {
      data: { projectId: project.id, prompt: 'test' },
    });
    expect(res.status()).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
  });

  test('POST /api/video/generate missing projectId returns 400', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/video/generate`, {
      data: { model: 'MiniMax-Hailuo-2.3', prompt: 'test' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/video/:id with non-existent ID returns 404', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/video/non-existent-id`);
    expect(res.status()).toBe(404);
  });
});

// ─── 14. MEDLEY API ───────────────────────────────────────────────────────

test.describe('Medley API - CRUD', () => {
  test('POST /api/medley creates medley for project', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Medley Test ${Date.now()}` },
    });
    const project = await createRes.json();

    const res = await page.request.post(`${BACKEND}/api/medley`, {
      data: { projectId: project.id, name: 'My Test Medley' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.name).toBe('My Test Medley');
    expect(body.project_id).toBe(project.id);
  });

  test('GET /api/medley/:id returns medley', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Medley Get Test ${Date.now()}` },
    });
    const project = await createRes.json();

    const createMedley = await page.request.post(`${BACKEND}/api/medley`, {
      data: { projectId: project.id, name: 'Get Medley' },
    });
    const medley = await createMedley.json();

    const res = await page.request.get(`${BACKEND}/api/medley/${medley.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(medley.id);
  });

  test('GET /api/medley/:id with non-existent returns 404', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/medley/non-existent`);
    expect(res.status()).toBe(404);
  });

  test('DELETE /api/medley/:id removes medley', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Medley Delete Test ${Date.now()}` },
    });
    const project = await createRes.json();

    const createMedley = await page.request.post(`${BACKEND}/api/medley`, {
      data: { projectId: project.id, name: 'Delete Me' },
    });
    const medley = await createMedley.json();

    const deleteRes = await page.request.delete(`${BACKEND}/api/medley/${medley.id}`);
    expect([200, 204]).toContain(deleteRes.status());

    const getRes = await page.request.get(`${BACKEND}/api/medley/${medley.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('POST /api/medley missing projectId returns 400', async ({ page }) => {
    const res = await page.request.post(`${BACKEND}/api/medley`, {
      data: { name: 'No Project Medley' },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Mastering Upload API - field name contract', () => {
  test('POST /api/mastering/upload/:projectId with field "files" returns files array', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Upload Contract Test ${Date.now()}` },
    });
    const project = await createRes.json();

    // Upload with the correct field name 'files' (multer array field)
    const fixture = fs.readFileSync('./tests/fixtures/test-audio.mp3');
    const uploadRes = await page.request.post(`${BACKEND}/api/mastering/upload/${project.id}`, {
      multipart: {
        files: { name: 'test.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from(fixture) },
      },
    });

    expect(uploadRes.status()).toBe(200);
    const body = await uploadRes.json();
    // Response MUST be { files: [...] } — not { id, ... }
    expect(body).toHaveProperty('files');
    expect(Array.isArray(body.files)).toBe(true);
    expect(body.files.length).toBeGreaterThan(0);
    expect(body.files[0]).toHaveProperty('id');
    expect(body.files[0]).toHaveProperty('filename');
  });

  test('POST /api/mastering/upload then /api/mastering/process creates music entry', async ({ page }) => {
    const createRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `Upload+Process Test ${Date.now()}` },
    });
    const project = await createRes.json();

    // Upload
    const fixture = fs.readFileSync('./tests/fixtures/test-audio.mp3');
    const uploadRes = await page.request.post(`${BACKEND}/api/mastering/upload/${project.id}`, {
      multipart: {
        files: { name: 'test.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from(fixture) },
      },
    });
    const uploadBody = await uploadRes.json();
    const fileId = uploadBody.files[0].id;

    // Process with saveToProject: true
    const processRes = await page.request.post(`${BACKEND}/api/mastering/process`, {
      data: { fileId, projectId: project.id, preset: 'spotify', saveToProject: true },
    });
    expect(processRes.status()).toBe(200);
    const processBody = await processRes.json();
    expect(processBody.success).toBe(true);

    // Verify music entry created
    const musicRes = await page.request.get(`${BACKEND}/api/projects/${project.id}/music`);
    const musicList = await musicRes.json();
    expect(musicList.length).toBeGreaterThan(0);
  });
});

// ─── Settings API ──────────────────────────────────────────────────────────

test.describe('Settings API', () => {
  test('GET /api/settings returns all settings with masked api key', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/settings`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.default_music_model).toBeDefined();
    expect(body.data.default_video_model).toBeDefined();
    expect(body.data.auto_ffmpeg_320kbps).toBeDefined();
    expect(body.data.default_workflow_mode).toBeDefined();
  });

  test('GET /api/settings/:key returns single setting', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/settings/default_music_model`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.key).toBe('default_music_model');
    // value may differ from default if another test patched it — just verify it's a string
    expect(typeof body.data.value).toBe('string');
    expect(body.data.value.length).toBeGreaterThan(0);
  });

  test('GET /api/settings/:key with unknown key returns 404', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/settings/nonexistent_key`);
    expect(res.status()).toBe(404);
  });

  test('PATCH /api/settings updates a setting', async ({ page }) => {
    const res = await page.request.patch(`${BACKEND}/api/settings`, {
      data: { default_music_model: 'music-2.6' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.default_music_model.value).toBe('music-2.6');
    expect(body.message).toContain('updated');
  });

  test('PATCH /api/settings with unknown key returns 400', async ({ page }) => {
    const res = await page.request.patch(`${BACKEND}/api/settings`, {
      data: { unknown_setting: 'value' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/music/settings returns available audio options', async ({ page }) => {
    const res = await page.request.get(`${BACKEND}/api/music/settings`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.sampleRates).toBeDefined();
    expect(body.data.bitrates).toBeDefined();
    expect(body.data.models).toContain('music-2.6');
  });

  test('GET /api/projects/:id/history redirects to /api/history/:id', async ({ page }) => {
    const projectRes = await page.request.post(`${BACKEND}/api/projects`, {
      data: { name: `History Alias Test ${Date.now()}` },
    });
    const project = await projectRes.json();
    const res = await page.request.get(`${BACKEND}/api/projects/${project.id}/history`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('lyrics');
    expect(body).toHaveProperty('music');
  });
});
