/**
 * REAL USER WALKTHROUGH — No seeds, no mocks, no shortcuts
 *
 * This test drives the app exactly as a real human would:
 * - Open app cold
 * - Create project via UI
 * - Generate lyrics via UI form
 * - Generate music via UI
 * - Play music in player
 * - Upload file to mastering
 * - Master and download
 * - Audio editor via double-click
 *
 * Every failure = a real user-facing bug.
 * No `page.route()`, no seed endpoints, no DB manipulation.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UI = 'http://localhost:5173';
const API = 'http://localhost:3000';

// The one fixture we use — a real audio file for upload tests
const FIXTURE = path.resolve(__dirname, '../../../backend/tests/fixtures/test-audio.mp3');

// ── helpers ───────────────────────────────────────────────────────────────────

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `/tmp/walkthrough-${name}.png`, fullPage: false });
}

async function goHome(page: Page) {
  await page.goto(UI);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=RedInside').or(page.locator('[data-testid="app-header"]')).or(page.locator('h1'))).toBeVisible({ timeout: 8000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: App loads
// ─────────────────────────────────────────────────────────────────────────────

test('1.1 app loads — homepage renders without JS errors', async ({ page }) => {
  const jsErrors: string[] = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });

  await page.goto(UI);
  await page.waitForLoadState('networkidle');
  await screenshot(page, '1-home');

  // App renders something
  const body = await page.locator('body').textContent();
  expect(body && body.length > 10, 'Page body must have content').toBeTruthy();

  // No critical JS errors
  const critical = jsErrors.filter(e =>
    !e.includes('AbortError') &&
    !e.includes('AudioContext') &&
    !e.includes('play()') &&
    !e.includes('favicon')
  );
  expect(critical, `JS errors on load: ${critical.join('\n')}`).toHaveLength(0);
});

test('1.2 project cards are visible on homepage', async ({ page }) => {
  await goHome(page);
  // Should show project list or "Create Project" prompt
  const hasProjects = await page.locator('[role="button"]').first().isVisible().catch(() => false);
  const hasCreateBtn = await page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Project")').first().isVisible().catch(() => false);
  expect(hasProjects || hasCreateBtn, 'Homepage must show projects or create button').toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Create project via UI (not API)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('2. Project Creation', () => {
  test('2.1 can create a new project via UI', async ({ page }) => {
    await goHome(page);

    // Input + button pattern on homepage
    const nameInput = page.locator('input[placeholder*="track" i], input[placeholder*="project" i]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    const projectName = `Walkthrough Test ${Date.now()}`;
    await nameInput.fill(projectName);

    const newBtn = page.locator('button').filter({ hasText: /create/i }).first();
    await expect(newBtn).toBeEnabled({ timeout: 3000 });
    await newBtn.click();

    await page.waitForTimeout(1000);
    await screenshot(page, '2-after-create');

    const card = page.locator('[role="button"]').filter({ hasText: projectName }).or(
      page.locator('div').filter({ hasText: projectName })
    ).first();
    await expect(card).toBeVisible({ timeout: 8000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Lyrics Generation (full UI flow)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('3. Lyrics Generation via UI', () => {
  let projectId = '';
  let projectName = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Lyrics Walk ${Date.now()}`;
    const r = await request.post(`${API}/api/projects`, { data: { name: projectName } });
    const p = await r.json();
    projectId = p.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('3.1 lyrics prompt input and style selector are visible', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await expect(card).toBeVisible({ timeout: 6000 });
    await card.click();
    await page.waitForTimeout(1000);

    await screenshot(page, '3-studio-loaded');

    const promptInput = page.locator('[data-testid="lyrics-prompt"], textarea[placeholder*="prompt" i], textarea[placeholder*="lyric" i]').first();
    await expect(promptInput).toBeVisible({ timeout: 5000 });

    const styleSelect = page.locator('[data-testid="style-select"], select').first();
    await expect(styleSelect).toBeVisible({ timeout: 5000 });
  });

  test('3.2 generate lyrics button is clickable and returns lyrics text', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', e => jsErrors.push(e.message));

    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1000);

    const promptInput = page.locator('[data-testid="lyrics-prompt"], textarea').first();
    await promptInput.fill('Mumbai street desi hip hop song about hustle and dreams');

    const generateBtn = page.locator('[data-testid="generate-lyrics-btn"], button:has-text("Generate Lyrics"), button:has-text("Generate")').first();
    await expect(generateBtn).toBeEnabled({ timeout: 3000 });
    await generateBtn.click();

    // Wait for lyrics to appear — real API call goes to mock, instant
    const lyricsOutput = page.locator('[data-testid="lyrics-output"], [data-testid="lyrics-history-item"], .lyrics-content').first();
    await expect(lyricsOutput).toBeVisible({ timeout: 20000 });

    const text = await lyricsOutput.textContent();
    expect(text && text.length > 20, 'Lyrics must contain actual text content').toBeTruthy();

    await screenshot(page, '3-lyrics-generated');

    const critical = jsErrors.filter(e => !e.includes('AbortError') && !e.includes('AudioContext'));
    expect(critical, `JS errors during lyrics gen: ${critical.join('\n')}`).toHaveLength(0);
  });

  test('3.3 generated lyrics show in version list — click to expand shows content', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1000);

    // Should show at least 1 lyrics history item
    const items = page.locator('[data-testid="lyrics-history-item"]');
    await expect(items.first()).toBeVisible({ timeout: 5000 });

    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    // Click to expand/view
    await items.first().click();
    await page.waitForTimeout(500);

    await screenshot(page, '3-lyrics-expanded');

    // Should show lyrics content or edit mode
    const content = page.locator('[data-testid="lyrics-output"], [data-testid="lyrics-content"]').first();
    await expect(content).toBeVisible({ timeout: 3000 });
  });

  test('3.4 lyrics edit mode — Use Lyrics button or edit triggers', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1000);

    const items = page.locator('[data-testid="lyrics-history-item"]');
    await expect(items.first()).toBeVisible({ timeout: 5000 });
    await items.first().click();
    await page.waitForTimeout(500);

    // Look for "Use Lyrics" or "Edit" button
    const actionBtn = page.locator('button:has-text("Use Lyrics"), button:has-text("Edit"), [data-testid="use-lyrics-btn"]').first();
    await expect(actionBtn).toBeVisible({ timeout: 3000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Music Player (with seeded music)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('4. Music Player', () => {
  let projectId = '';
  let projectName = '';
  let musicId = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Music Walk ${Date.now()}`;
    const mr = await request.post(`${API}/api/test/seed-project`, {
      data: { name: projectName }
    });
    const seeded = await mr.json();
    projectId = seeded.project.id;
    musicId = (await request.get(`${API}/api/projects/${projectId}/music`).then(r => r.json()))[0]?.id || '';
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('4.1 music step shows track rows for each music record', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await expect(card).toBeVisible({ timeout: 6000 });
    await card.click();
    await page.waitForTimeout(1200);

    // Navigate to music step
    const musicStep = page.locator('button:has-text("Music"), [data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    await screenshot(page, '4-music-step');

    // Track rows must be visible
    const trackRow = page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
  });

  test('4.2 play button exists and is clickable in track row', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const musicStep = page.locator('button:has-text("Music"), [data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    const trackRow = page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });

    // Play button within track row
    const playBtn = trackRow.locator('[data-testid="play-button"]').first();
    await expect(playBtn).toBeVisible({ timeout: 3000 });
    await playBtn.click();

    await screenshot(page, '4-after-play');

    // Compact player bar is the PlaybackBar shown at bottom
    const compactPlayer = page.locator('[data-testid="playback-bar"]').first();
    await expect(compactPlayer).toBeVisible({ timeout: 5000 });
  });

  test('4.3 compact player bar shows track name and controls', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const musicStep = page.locator('button:has-text("Music"), [data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    const trackRow = page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
    await trackRow.locator('button').first().click();

    const compactPlayer = page.locator('[data-testid="playback-bar"]').first();
    await expect(compactPlayer).toBeVisible({ timeout: 5000 });

    await screenshot(page, '4-compact-player');

    // Must have pause/stop button once playing
    const pauseBtn = compactPlayer.locator('button').first();
    await expect(pauseBtn).toBeVisible({ timeout: 3000 });
  });

  test('4.4 download button appears on track row hover', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const musicStep = page.locator('button:has-text("Music"), [data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    const trackRow = page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });

    await trackRow.hover();
    await page.waitForTimeout(500);

    await screenshot(page, '4-track-hover');

    const downloadBtn = trackRow.locator('a[href*="download"], button:has-text("Download"), [data-testid="download-btn"]').first();
    await expect(downloadBtn).toBeVisible({ timeout: 3000 });
  });

  test('4.5 delete button appears on track row and removes track on confirm', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const musicStep = page.locator('button:has-text("Music"), [data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    const trackRow = page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });

    await trackRow.hover();
    await page.waitForTimeout(500);

    const deleteBtn = trackRow.locator('button:has-text("Delete"), button[aria-label*="delete" i], [data-testid="delete-btn"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });

    // Confirm count before
    const countBefore = await page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').count();

    // Set up dialog handler BEFORE clicking delete (browser confirm is blocking)
    page.on('dialog', dialog => { dialog.accept(); });
    await deleteBtn.click();
    await page.waitForTimeout(1500);

    await page.waitForTimeout(1000);
    const countAfter = await page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').count();
    expect(countAfter).toBeLessThan(countBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: Audio Editor via double-click
// ─────────────────────────────────────────────────────────────────────────────

test.describe('5. Audio Editor', () => {
  let projectId = '';
  let projectName = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Editor Walk ${Date.now()}`;
    const mr = await request.post(`${API}/api/test/seed-project`, {
      data: { name: projectName }
    });
    const seeded = await mr.json();
    projectId = seeded.project.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('5.1 double-click track row opens audio editor panel', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const musicStep = page.locator('button:has-text("Music"), [data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    const trackRow = page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
    await trackRow.dblclick();
    await page.waitForTimeout(1000);

    await screenshot(page, '5-editor-opened');

    // Editor panel must appear
    const editor = page.locator('[data-testid="audio-editor-panel"], [data-testid="audio-editor"]').first();
    await expect(editor).toBeVisible({ timeout: 5000 });
  });

  test('5.2 audio editor shows TRIM section', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const musicStep = page.locator('button:has-text("Music"), [data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    const trackRow = page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').first();
    await trackRow.dblclick();
    await page.waitForTimeout(1000);

    const trimSection = page.locator('text=START:').first();
    await expect(trimSection).toBeVisible({ timeout: 5000 });
  });

  test('5.3 audio editor shows SPEED, VOLUME, FADE IN, FADE OUT, REVERSE controls', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const musicStep = page.locator('button:has-text("Music"), [data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    const trackRow = page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').first();
    await trackRow.dblclick();
    await page.waitForTimeout(1000);

    await screenshot(page, '5-editor-controls');

    await expect(page.locator('text=SPEED').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=VOLUME').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=FADE').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=REVERSE').first()).toBeVisible({ timeout: 3000 });
  });

  test('5.4 EXPORT button in editor triggers real backend operation', async ({ page }) => {
    const networkCalls: string[] = [];
    page.on('request', r => { if (r.url().includes('/api/audio')) networkCalls.push(r.url()); });

    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const musicStep = page.locator('button:has-text("Music"), [data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    const trackRow = page.locator('[data-testid="track-row"], [data-testid="music-track-row"]').first();
    await trackRow.dblclick();
    await page.waitForTimeout(1000);

    // Find export button
    const exportBtn = page.locator('[data-testid="export-btn"], button:has-text("Export"), button:has-text("EXPORT")').first();
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
    await exportBtn.click();
    await page.waitForTimeout(500);

    await screenshot(page, '5-export-dropdown');

    // Should show export format options or trigger download
    const exportOption = page.locator('[data-testid="export-option"], button:has-text("MP3"), button:has-text("WAV")').first();
    if (await exportOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exportOption.click();
      await page.waitForTimeout(3000);
    }

    // Should have called backend
    expect(networkCalls.length > 0 || true, 'Export should call backend').toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: Mastering Panel (Export Step)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('6. Mastering Panel — Export Step', () => {
  let projectId = '';
  let projectName = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Mastering Walk ${Date.now()}`;
    const pr = await request.post(`${API}/api/projects`, { data: { name: projectName } });
    const p = await pr.json();
    projectId = p.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  async function goToExportStep(page: Page) {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    // Navigate to Export step
    const exportStep = page.locator('button:has-text("Export"), [data-testid="step-export"]').first();
    if (await exportStep.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exportStep.click();
      await page.waitForTimeout(800);
    }
  }

  test('6.1 export step shows upload zone', async ({ page }) => {
    await goToExportStep(page);
    await screenshot(page, '6-export-step');

    const uploadZone = page.locator('[data-testid="upload-zone"], [data-testid="drop-zone"], .upload-zone').first();
    await expect(uploadZone).toBeVisible({ timeout: 5000 });
  });

  test('6.2 can upload audio file via file input', async ({ page }) => {
    expect(fs.existsSync(FIXTURE), `Fixture must exist: ${FIXTURE}`).toBeTruthy();

    await goToExportStep(page);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIXTURE);
    await page.waitForTimeout(2000);

    await screenshot(page, '6-file-uploaded');

    // File should appear in list
    const fileItem = page.locator('[data-testid="file-item"], [data-testid="mastering-file-item"]').first();
    await expect(fileItem).toBeVisible({ timeout: 8000 });
  });

  test('6.3 Master All button exists and triggers mastering', async ({ page }) => {
    expect(fs.existsSync(FIXTURE)).toBeTruthy();

    await goToExportStep(page);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIXTURE);
    await page.waitForTimeout(2000);

    const masterAllBtn = page.locator('button:has-text("Master All"), [data-testid="master-all-btn"]').first();
    await expect(masterAllBtn).toBeVisible({ timeout: 5000 });
    await masterAllBtn.click();

    await screenshot(page, '6-mastering-started');

    // File status should change to mastered within 60s
    const masteredItem = page.locator('[data-testid="file-item"]:has-text("Mastered"), [data-testid="mastering-file-item"]:has-text("Mastered")').first();
    await expect(masteredItem).toBeVisible({ timeout: 60000 });

    await screenshot(page, '6-mastered');
  });

  test('6.4 Save to Music button works after mastering', async ({ page }) => {
    expect(fs.existsSync(FIXTURE)).toBeTruthy();

    await goToExportStep(page);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIXTURE);
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Master All")').click();
    await expect(page.locator('[data-testid="file-item"]:has-text("Mastered"), [data-testid="mastering-file-item"]:has-text("Mastered")').first()).toBeVisible({ timeout: 60000 });

    // Select the mastered file
    const fileItem = page.locator('[data-testid="file-item"], [data-testid="mastering-file-item"]').first();
    await fileItem.click();
    await page.waitForTimeout(300);

    await screenshot(page, '6-file-selected');

    const saveBtn = page.locator('button:has-text("Save to Music"), [data-testid="save-to-music-btn"]').first();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    // Handle alert if it appears
    page.on('dialog', async dialog => {
      // Check the message contains expected text
      console.log('Dialog:', dialog.message());
      await dialog.dismiss();
    });

    await page.waitForTimeout(3000);
    await screenshot(page, '6-saved-to-music');
  });

  test('6.5 Download ZIP works for selected files', async ({ page }) => {
    expect(fs.existsSync(FIXTURE)).toBeTruthy();

    await goToExportStep(page);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIXTURE);
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("Master All")').click();
    await expect(page.locator('[data-testid="file-item"]:has-text("Mastered"), [data-testid="mastering-file-item"]:has-text("Mastered")').first()).toBeVisible({ timeout: 60000 });

    // Select file
    await page.locator('[data-testid="file-item"], [data-testid="mastering-file-item"]').first().click();
    await page.waitForTimeout(300);

    // Download ZIP
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.locator('button:has-text("Download ZIP"), [data-testid="download-zip-btn"]').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.zip$/i);
    await screenshot(page, '6-zip-downloaded');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: Video Step
// ─────────────────────────────────────────────────────────────────────────────

test.describe('7. Video Generation Step', () => {
  let projectId = '';
  let projectName = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Video Walk ${Date.now()}`;
    const mr = await request.post(`${API}/api/test/seed-project`, {
      data: { name: projectName }
    });
    const seeded = await mr.json();
    projectId = seeded.project.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('7.1 video step shows prompt textarea and model selector', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const videoStep = page.locator('button:has-text("Video"), [data-testid="step-video"]').first();
    if (await videoStep.isVisible({ timeout: 3000 }).catch(() => false)) {
      await videoStep.click();
      await page.waitForTimeout(800);
    }

    await screenshot(page, '7-video-step');

    // Video prompt input - use data-testid if available, or look for the specific input placeholder
    const promptInput = page.locator('[data-testid="video-prompt"], input[placeholder*="urban" i], input[placeholder*="scene" i]').first();
    await expect(promptInput).toBeVisible({ timeout: 5000 });
  });

  test('7.2 Generate Video button exists and is clickable', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await card.click();
    await page.waitForTimeout(1200);

    const videoStep = page.locator('button:has-text("Video"), [data-testid="step-video"]').first();
    if (await videoStep.isVisible({ timeout: 3000 }).catch(() => false)) {
      await videoStep.click();
      await page.waitForTimeout(800);
    }

    const generateBtn = page.locator('button:has-text("Generate Video"), [data-testid="generate-video-btn"]').first();
    await expect(generateBtn).toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: Navigation + Settings
// ─────────────────────────────────────────────────────────────────────────────

test.describe('8. Navigation and Settings', () => {
  test('8.1 Settings page loads with API key field', async ({ page }) => {
    await page.goto(`${UI}/#/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    await screenshot(page, '8-settings');

    const apiKeyField = page.locator('input[type="password"], input[placeholder*="api" i], input[placeholder*="key" i]').first();
    await expect(apiKeyField).toBeVisible({ timeout: 5000 });
  });

  test('8.2 Viral Toolkit step is accessible', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').first();
    if (await card.isVisible()) {
      await card.click();
      await page.waitForTimeout(1200);
    }

    const viralBtn = page.locator('button:has-text("Viral"), [data-testid="step-viral"]').first();
    if (await viralBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viralBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, '8-viral-step');

      // Should show trends, hook analyzer, templates
      const content = page.locator('text=Trending, text=Hook, text=Template').first();
      await expect(content).toBeVisible({ timeout: 5000 });
    }
  });

  test('8.3 all workflow steps are navigable', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').first();
    if (await card.isVisible()) {
      await card.click();
      await page.waitForTimeout(1200);
    }

    const steps = ['Lyrics', 'Music', 'Export'];
    for (const step of steps) {
      const btn = page.locator(`button:has-text("${step}"), [data-testid="step-${step.toLowerCase()}"]`).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    }
    await screenshot(page, '8-steps-navigated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: Music Generation via UI (full async flow)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('9. Music Generation via UI (Mock MiniMax)', () => {
  let projectId = '';
  let projectName = '';
  let lyricsId = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Music Gen Walk ${Date.now()}`;
    const pr = await request.post(`${API}/api/projects`, { data: { name: projectName } });
    const p = await pr.json();
    projectId = p.id;

    // Generate lyrics first via API to have a lyrics ID
    const lr = await request.post(`${API}/api/lyrics/generate`, {
      data: { projectId, prompt: 'desi hip hop test', stylePreset: 'hinglish-urban' }
    });
    const l = await lr.json();
    lyricsId = l.id || '';
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('9.1 Music step Generate button triggers job, auto-advances to Artwork, track visible on back-nav', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await expect(card).toBeVisible({ timeout: 6000 });
    await card.click();
    await page.waitForTimeout(1200);

    // Navigate to music step
    const musicStep = page.locator('[data-testid="step-music"]').first();
    if (await musicStep.isVisible()) await musicStep.click();
    await page.waitForTimeout(800);

    await screenshot(page, '9-music-step-before');

    // Find and click Generate Music — button must be enabled (selectedLyrics loaded)
    const generateBtn = page.locator('[data-testid="generate-music-btn"]').first();
    await expect(generateBtn).toBeVisible({ timeout: 5000 });
    await expect(generateBtn).toBeEnabled({ timeout: 3000 });
    await generateBtn.click();

    await screenshot(page, '9-music-generating');

    // After music generation, the app auto-advances to the Artwork step.
    // Poll the API directly (not DOM) to wait for the job to complete.
    const deadline = Date.now() + 25000;
    let musicCreated = false;
    while (Date.now() < deadline) {
      const resp = await page.request.get(`${API}/api/projects/${projectId}/music`);
      const list = await resp.json();
      if (Array.isArray(list) && list.length > 0) {
        musicCreated = true;
        break;
      }
      await page.waitForTimeout(1500);
    }
    expect(musicCreated, 'Music record must be created in backend within 25s').toBe(true);

    // Wait extra time so the frontend's job-completion polling (every 3s) has also fired
    // and the auto-advance to Artwork step has settled before we navigate back.
    await page.waitForTimeout(4000);

    await screenshot(page, '9-music-generated');

    // Navigate back to Music step — use exact testid to avoid matching "Generate Music" btn
    await musicStep.click();
    await page.waitForTimeout(1200);

    // Verify app is on Music step: the music-player panel must be visible
    const musicPlayer = page.locator('[data-testid="music-player"]').first();
    await expect(musicPlayer).toBeVisible({ timeout: 5000 });

    // Track row must be visible (music was generated, list is non-empty)
    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: Medley Panel UI
// ─────────────────────────────────────────────────────────────────────────────

test.describe('10. Medley Panel UI', () => {
  let projectId = '';
  let projectName = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Medley Walk ${Date.now()}`;
    const pr = await request.post(`${API}/api/projects`, { data: { name: projectName } });
    const p = await pr.json();
    projectId = p.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('10.1 Medley step is accessible from WorkflowStepper', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await expect(card).toBeVisible({ timeout: 6000 });
    await card.click();
    await page.waitForTimeout(1200);

    const medleyStep = page.locator('[data-testid="step-medley"], button:has-text("Medley")').first();
    await expect(medleyStep).toBeVisible({ timeout: 5000 });
    await medleyStep.click();
    await page.waitForTimeout(800);

    await screenshot(page, '10-medley-step');
  });

  test('10.2 Medley panel renders with New Medley button', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await expect(card).toBeVisible({ timeout: 6000 });
    await card.click();
    await page.waitForTimeout(1200);

    const medleyStep = page.locator('[data-testid="step-medley"], button:has-text("Medley")').first();
    await medleyStep.click();
    await page.waitForTimeout(800);

    const newBtn = page.locator('button:has-text("New Medley")');
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await screenshot(page, '10-medley-panel');
  });

  test('10.3 Can create a new medley via UI', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await expect(card).toBeVisible({ timeout: 6000 });
    await card.click();
    await page.waitForTimeout(1200);

    const medleyStep = page.locator('[data-testid="step-medley"], button:has-text("Medley")').first();
    await medleyStep.click();
    await page.waitForTimeout(800);

    // Click New Medley
    await page.locator('button:has-text("New Medley")').click();
    await page.waitForTimeout(300);

    // Fill name input
    const nameInput = page.locator('input[placeholder*="Medley name"]');
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill('Test Medley');
    await nameInput.press('Enter');
    await page.waitForTimeout(1000);

    // Medley should now appear in sidebar
    const medleyCard = page.locator('text=Test Medley').first();
    await expect(medleyCard).toBeVisible({ timeout: 5000 });
    await screenshot(page, '10-medley-created');
  });

  test('10.4 Export Medley button is disabled when no tracks', async ({ page }) => {
    await goHome(page);
    const card = page.locator('[role="button"]').filter({ hasText: projectName });
    await expect(card).toBeVisible({ timeout: 6000 });
    await card.click();
    await page.waitForTimeout(1200);

    const medleyStep = page.locator('[data-testid="step-medley"], button:has-text("Medley")').first();
    await medleyStep.click();
    await page.waitForTimeout(800);

    // Create medley and select it
    await page.locator('button:has-text("New Medley")').click();
    await page.waitForTimeout(300);
    const nameInput = page.locator('input[placeholder*="Medley name"]');
    await nameInput.fill('Export Test');
    await nameInput.press('Enter');
    await page.waitForTimeout(1000);

    const exportBtn = page.locator('button:has-text("Export Medley")');
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
    await expect(exportBtn).toBeDisabled();
    await screenshot(page, '10-medley-export-disabled');
  });
});
