/**
 * Generation Flow E2E Tests — using MiniMax mock server
 *
 * Tests verify the FULL generation flows with HARD assertions.
 * Tests MUST FAIL when a feature breaks — no early returns, no catch+return.
 *
 * Mock server at port 8999 returns instant responses so tests
 * run fast without burning real API credits.
 *
 * IMPORTANT: Backend must run in mock mode: cd backend && npm run dev:mock
 */
import { test, expect, Page } from '@playwright/test';

const UI = 'http://localhost:5173';
const API = 'http://localhost:3000';

async function openProject(page: Page, projectName: string) {
  await page.goto(UI);
  await page.waitForLoadState('networkidle');
  const card = page.locator('[role="button"]').filter({ hasText: projectName });
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.click();
  await page.waitForTimeout(1500);
}

/** Poll job status until completed or failed (max 20s) */
async function waitForJob(request: ReturnType<Page['request']['constructor']['prototype']> extends never ? never : Page['request'], jobId: string): Promise<'completed' | 'failed'> {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const res = await request.get(`${API}/api/jobs/${jobId}`);
    if (!res.ok()) continue;
    const job = await res.json();
    if (job.status === 'completed') return 'completed';
    if (job.status === 'failed') return 'failed';
  }
  throw new Error(`Job ${jobId} did not complete within 20s`);
}

// ─── LYRICS GENERATION ────────────────────────────────────────────────────────

test.describe('Lyrics Generation Flow (Mock MiniMax)', () => {
  let projectName = '';
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Lyrics Gen Test ${Date.now()}`;
    const res = await request.post(`${API}/api/projects`, { data: { name: projectName } });
    const project = await res.json();
    projectId = project.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('Generate Lyrics button works → lyrics text appears in UI', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
    page.on('pageerror', e => jsErrors.push(e.message));

    await openProject(page, projectName);

    await expect(page.locator('[data-testid="style-select"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="lyrics-prompt"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="lyrics-prompt"]').fill('Test song about Mumbai streets');

    const generateBtn = page.locator('[data-testid="generate-lyrics-btn"]');
    await expect(generateBtn).toBeVisible({ timeout: 5000 });
    await generateBtn.click();

    // lyrics-output div appears only when lyricsHistory.length > 0
    const lyricsOutput = page.locator('[data-testid="lyrics-output"]');
    await expect(lyricsOutput).toBeAttached({ timeout: 15000 });

    const lyricsText = await lyricsOutput.textContent();
    expect(lyricsText && lyricsText.length > 10, 'Lyrics output must contain text').toBeTruthy();

    // No JS errors (allow AudioContext and AbortError which are benign playback side effects)
    const criticalErrors = jsErrors.filter(e =>
      !e.includes('favicon') && !e.includes('AudioContext') && !e.includes('AbortError')
    );
    expect(criticalErrors, `JS errors: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });

  test('Generate Lyrics → lyrics-history-item clickable → lyrics detail opens with Edit button', async ({ page }) => {
    // Seed a project that already has lyrics so we can immediately test edit flow
    const res = await page.request.post(`${API}/api/test/seed-project`, {
      data: { name: `Edit Lyrics Test ${Date.now()}`, lyrics: true }
    });
    const { project } = await res.json();

    await openProject(page, project.name);

    // Lyrics history must show (seeded project has lyrics)
    const lyricsHistoryItem = page.locator('[data-testid="lyrics-history-item"]').first();
    await expect(lyricsHistoryItem).toBeVisible({ timeout: 10000 });

    // Click to open lyrics detail
    await lyricsHistoryItem.click();
    await page.waitForTimeout(500);

    // Edit button must appear in the modal/detail view
    const editBtn = page.locator('button:has-text("Edit")').first();
    await expect(editBtn, 'Edit button must appear after clicking a lyrics history item').toBeVisible({ timeout: 5000 });

    // Cleanup
    await page.request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });
});

// ─── MUSIC GENERATION ─────────────────────────────────────────────────────────

test.describe('Music Generation Flow (Mock MiniMax)', () => {
  let projectName = '';
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Music Gen Test ${Date.now()}`;
    // lyrics: true so selectedLyrics is pre-loaded → Generate Music is enabled
    const res = await request.post(`${API}/api/test/seed-project`, {
      data: { name: projectName, lyrics: true, music: false }
    });
    const { project } = await res.json();
    projectId = project.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('Generate Music button enabled with lyrics → track appears after job completes', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
    page.on('pageerror', e => jsErrors.push(e.message));

    await openProject(page, projectName);

    // Navigate to Music step
    await page.locator('button').filter({ hasText: /^music$/i }).first().click();
    await page.waitForTimeout(1500);

    // Generate Music MUST be enabled — seeded project has lyrics
    const generateBtn = page.locator('button:has-text("Generate Music")');
    await expect(generateBtn).toBeVisible({ timeout: 5000 });
    await expect(generateBtn, 'Generate Music must be enabled when lyrics exist').not.toBeDisabled();

    // Count tracks before
    const tracksBefore = await page.locator('[data-testid="track-row"]').count();

    // Click Generate Music — triggers POST /api/music/generate
    const [musicResponse] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/music/generate') && r.request().method() === 'POST'),
      generateBtn.click(),
    ]);

    expect(musicResponse.status(), 'Music generate must return 202').toBe(202);
    const { jobId } = await musicResponse.json();
    expect(jobId, 'Music generate must return jobId').toBeTruthy();

    // Wait for job to complete via API polling (mock is fast, should complete in < 10s)
    const jobStatus = await waitForJob(page.request, jobId);
    expect(jobStatus, `Music job must complete, got: ${jobStatus}`).toBe('completed');

    // UI: track must appear (WebSocket or 3s poll catches it)
    // After job completion, UI may advance to artwork step (display:none on music step)
    // Verify via API that music exists
    const musicList = await page.request.get(`${API}/api/projects/${projectId}/music`);
    expect(musicList.ok()).toBe(true);
    const tracks = await musicList.json();
    expect(tracks.length, 'Music list must have at least 1 track after generation').toBeGreaterThan(tracksBefore);

    // Also verify track-row appears in UI (allow display:none by checking attached)
    await expect(page.locator('[data-testid="track-row"]').first()).toBeAttached({ timeout: 10000 });

    const criticalErrors = jsErrors.filter(e =>
      !e.includes('favicon') && !e.includes('AudioContext') && !e.includes('AbortError')
    );
    expect(criticalErrors, `JS errors: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });

  test('Music track → play button visible and clickable', async ({ page }) => {
    // Need project with actual music — seed with music: true
    const res = await page.request.post(`${API}/api/test/seed-project`, {
      data: { name: `Music Player Test ${Date.now()}`, lyrics: true, music: true }
    });
    const { project } = await res.json();

    await openProject(page, project.name);

    await page.locator('button').filter({ hasText: /^music$/i }).first().click();
    await page.waitForTimeout(1500);

    // Track row MUST appear — project has music seeded
    await expect(page.locator('[data-testid="track-row"]').first(), 'Track row must be visible with seeded music').toBeVisible({ timeout: 10000 });

    // Play button MUST be visible on track
    await expect(page.locator('[data-testid="play-button"]').first(), 'Play button must be visible').toBeVisible({ timeout: 5000 });

    // Cleanup
    await page.request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });
});

// ─── VIDEO GENERATION ─────────────────────────────────────────────────────────

test.describe('Video Generation Flow (Mock MiniMax)', () => {
  let projectName = '';
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Video Gen Test ${Date.now()}`;
    // music: true so Generate Video is enabled
    const res = await request.post(`${API}/api/test/seed-project`, {
      data: { name: projectName, lyrics: true, music: true }
    });
    const { project } = await res.json();
    projectId = project.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('Video step → Generate Video enabled with music → job queued → 202', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
    page.on('pageerror', e => jsErrors.push(e.message));

    await openProject(page, projectName);

    // Navigate to Video step (music: true means it's accessible)
    const videoBtn = page.locator('button').filter({ hasText: /^video$/i });
    await expect(videoBtn.first()).toBeVisible({ timeout: 5000 });
    await videoBtn.first().click();
    await page.waitForTimeout(1500);

    // Generate Video MUST be enabled with music seeded
    const genVideoBtn = page.locator('button:has-text("Generate Video")').first();
    await expect(genVideoBtn).toBeVisible({ timeout: 5000 });
    await expect(genVideoBtn, 'Generate Video must be enabled when music exists').not.toBeDisabled();

    // Click and verify 202 queued response
    const [videoResponse] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/video/generate') && r.request().method() === 'POST'),
      genVideoBtn.click(),
    ]);

    expect(videoResponse.status(), 'Video generate must return 202').toBe(202);
    const body = await videoResponse.json();
    expect(body.jobId, 'Video generate must return jobId').toBeTruthy();

    const criticalErrors = jsErrors.filter(e => !e.includes('favicon') && !e.includes('AudioContext'));
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─── END-TO-END FLOW ──────────────────────────────────────────────────────────

test.describe('End-to-End Lyrics → Music → Video (Mock MiniMax)', () => {
  let projectName = '';
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    projectName = `Full Flow Test ${Date.now()}`;
    const res = await request.post(`${API}/api/projects`, { data: { name: projectName } });
    const project = await res.json();
    projectId = project.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('Complete flow: create project → generate lyrics → generate music → video step enabled', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
    page.on('pageerror', e => jsErrors.push(e.message));

    await openProject(page, projectName);

    // 1. LYRICS STEP — generate lyrics
    await expect(page.locator('[data-testid="lyrics-prompt"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="lyrics-prompt"]').fill('Mock song about Mumbai');
    await page.locator('[data-testid="generate-lyrics-btn"]').click();

    // lyrics-output must appear (lyricsHistory.length > 0 condition in LyricsEditor)
    await expect(page.locator('[data-testid="lyrics-output"]')).toBeAttached({ timeout: 15000 });
    console.log('✓ Lyrics generated');

    // After lyrics generation, Studio auto-advances to music step
    // selectedLyrics is set in Studio state via handleLyricsGenerated callback
    await page.waitForTimeout(500);

    // 2. MUSIC STEP — Generate Music must be ENABLED (lyrics were just generated)
    // Studio should have auto-advanced here; clicking stepper navigates explicitly
    await page.locator('button').filter({ hasText: /^music$/i }).first().click();
    await page.waitForTimeout(1000);

    const genMusicBtn = page.locator('button:has-text("Generate Music")');
    await expect(genMusicBtn).toBeVisible({ timeout: 5000 });
    await expect(genMusicBtn, 'Generate Music must be enabled after lyrics generation').not.toBeDisabled();

    // Click Generate Music and verify 202
    const [musicRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/music/generate') && r.request().method() === 'POST'),
      genMusicBtn.click(),
    ]);
    expect(musicRes.status(), 'POST /api/music/generate must return 202').toBe(202);
    const { jobId } = await musicRes.json();
    expect(jobId, 'Music generate must return jobId').toBeTruthy();

    // Wait for job completion via API (mock processes in < 5s)
    const jobStatus = await waitForJob(page.request, jobId);
    expect(jobStatus, 'Music job must complete successfully').toBe('completed');

    // Verify music exists in DB
    const musicList = await page.request.get(`${API}/api/projects/${projectId}/music`);
    const tracks = await musicList.json();
    expect(tracks.length, 'Music list must have 1 track after generation').toBeGreaterThan(0);
    console.log('✓ Music generated — track in DB');

    // After job completion, UI may auto-advance to artwork step (display:none on music step)
    // Track row should be attached in DOM even if hidden
    await expect(page.locator('[data-testid="track-row"]').first()).toBeAttached({ timeout: 10000 });
    console.log('✓ Track row in DOM');

    // 3. VIDEO STEP — must be accessible now that music exists
    const videoBtn = page.locator('button').filter({ hasText: /^video$/i });
    await expect(videoBtn.first()).toBeVisible({ timeout: 5000 });
    await videoBtn.first().click();
    await page.waitForTimeout(1500);

    const genVideoBtn = page.locator('button:has-text("Generate Video")').first();
    await expect(genVideoBtn).toBeVisible({ timeout: 5000 });
    await expect(genVideoBtn, 'Generate Video must be enabled after music is created').not.toBeDisabled();
    console.log('✓ Video step accessible and Generate Video enabled');

    const criticalErrors = jsErrors.filter(e =>
      !e.includes('favicon') && !e.includes('AudioContext') && !e.includes('AbortError')
    );
    expect(criticalErrors, `Critical JS errors: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });
});
