import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:3000';

async function seedProjectWithMusic(request: Page['request']): Promise<{ id: string; name: string }> {
  const res = await request.post(`${API}/api/test/seed-project`, {
    data: { name: `VRTest-${Date.now()}`, lyrics: true, music: true }
  });
  expect(res.ok(), `seed-project failed: ${res.status()}`).toBeTruthy();
  const { project } = await res.json();
  return project;
}

async function navigateToMusicStep(page: Page, projectName: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const card = page.locator('[role="button"]').filter({ hasText: projectName });
  await expect(card).toBeVisible({ timeout: 8000 });
  await card.click();
  await page.waitForTimeout(1200);
  const musicStep = page.locator('[data-testid="step-music"]').first();
  await expect(musicStep).toBeVisible({ timeout: 5000 });
  await musicStep.click();
  await page.waitForTimeout(800);
}

// ── YouTube Downloader ──────────────────────────────────────────────────────

test.describe('YouTube Downloader UI', () => {
  test('downloader panel visible on Music step with URL input + Download button', async ({ page, request }) => {
    const project = await seedProjectWithMusic(request);
    await navigateToMusicStep(page, project.name);

    // Panel heading
    const heading = page.locator('text=IMPORT FROM YOUTUBE').or(page.locator('text=YouTube')).first();
    await expect(heading).toBeVisible({ timeout: 8000 });

    // URL input
    const urlInput = page.locator('input[type="url"], input[placeholder*="youtube"]').first();
    await expect(urlInput).toBeVisible({ timeout: 3000 });

    // Download / Capture button
    const downloadBtn = page.locator('button').filter({ hasText: /CAPTURE|download/i }).first();
    await expect(downloadBtn).toBeVisible({ timeout: 3000 });

    await request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });

  test('Download button disabled / validation rejects non-YouTube URL', async ({ page, request }) => {
    const project = await seedProjectWithMusic(request);
    await navigateToMusicStep(page, project.name);

    const urlInput = page.locator('input[type="url"], input[placeholder*="youtube"]').first();
    await expect(urlInput).toBeVisible({ timeout: 5000 });

    // Type a non-YouTube URL
    await urlInput.fill('https://soundcloud.com/some-track');

    const downloadBtn = page.locator('button').filter({ hasText: /download/i }).first();

    // Either the button is disabled or clicking it shows an error — either is valid validation
    const isDisabled = await downloadBtn.isDisabled();
    if (!isDisabled) {
      await downloadBtn.click();
      // Should show an error message, not start a job
      const errorEl = page.locator('text=/invalid|not.*youtube|valid.*url/i');
      await expect(errorEl).toBeVisible({ timeout: 3000 });
    } else {
      expect(isDisabled).toBe(true);
    }

    await request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });

  test('POST /api/downloader/youtube → 400 for missing URL', async ({ request }) => {
    const project = await seedProjectWithMusic(request);

    const res = await request.post(`${API}/api/downloader/youtube`, {
      data: { projectId: project.id }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();

    await request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });

  test('POST /api/downloader/youtube → 400 for non-YouTube URL', async ({ request }) => {
    const project = await seedProjectWithMusic(request);

    const res = await request.post(`${API}/api/downloader/youtube`, {
      data: { projectId: project.id, url: 'https://soundcloud.com/track' }
    });
    expect([400, 422]).toContain(res.status());
    const body = await res.json();
    expect(body.error).toBeTruthy();

    await request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });
});

// ── Vocal Removal ───────────────────────────────────────────────────────────

test.describe('Vocal Removal UI', () => {
  test('VocalRemovalCard visible after opening audio editor for a track', async ({ page, request }) => {
    const project = await seedProjectWithMusic(request);
    await navigateToMusicStep(page, project.name);

    // Track row must be present
    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });

    // Open audio editor via Edit button (title="Edit") on the first track
    const editBtn = trackRow.locator('button[title="Edit"]').first();
    await expect(editBtn).toBeVisible({ timeout: 3000 });
    await editBtn.click();
    await page.waitForTimeout(1000);

    // AudioEditorPanel must open
    await expect(page.locator('text=AUDIO EDITOR')).toBeVisible({ timeout: 5000 });

    // VocalRemovalCard heading
    await expect(page.locator('text=VOCAL REMOVAL')).toBeVisible({ timeout: 3000 });

    // "Remove Vocals" button
    const removeBtn = page.locator('button').filter({ hasText: /remove vocals/i }).first();
    await expect(removeBtn).toBeVisible({ timeout: 3000 });

    await request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });

  test('clicking Remove Vocals starts job and shows progress bar', async ({ page, request }) => {
    const project = await seedProjectWithMusic(request);
    await navigateToMusicStep(page, project.name);

    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });

    await trackRow.locator('button[title="Edit"]').first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=AUDIO EDITOR')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=VOCAL REMOVAL')).toBeVisible({ timeout: 3000 });

    const removeBtn = page.locator('button').filter({ hasText: /remove vocals/i }).first();
    await removeBtn.click();

    // Must show progress (% text or status message)
    const progressIndicator = page.locator('text=/queuing|running/i').or(page.locator('text=/%/')).first();
    await expect(progressIndicator).toBeVisible({ timeout: 5000 });

    await request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });
});
