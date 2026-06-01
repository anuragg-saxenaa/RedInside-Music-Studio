import { test, expect, type Page } from '@playwright/test';

// Validates the offline-download engine + UI end-to-end on the dev server.
// (Cache API + IndexedDB work in a localhost secure context without the SW;
// SW-served offline *playback* is verified manually against the prod build.)

async function seedWithMusic(page: Page) {
  const res = await page.request.post('http://localhost:3000/api/test/seed-project', {
    data: { name: `PWA-${Date.now()}`, music: true, lyrics: false },
  });
  return res.json();
}

test.describe('PWA downloads', () => {
  test('download a track, see it in Downloads view, remove it', async ({ page }) => {
    const { project, music } = await seedWithMusic(page);
    const trackId = music[0].id;

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="project-item-${project.id}"]`).click();
    await page.waitForTimeout(600);
    await page.locator('[data-testid="tab-sounds"]').click();
    await page.waitForTimeout(300);

    // Download the track
    await page.locator(`[data-testid="download-btn-${trackId}"]`).click();
    await expect(page.locator(`[data-testid="downloaded-${trackId}"]`)).toBeVisible({ timeout: 15000 });

    // It appears in the Downloads view
    await page.locator('[data-testid="nav-downloads"]').click();
    await expect(page.locator('[data-testid="downloads-view"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="remove-download-${trackId}"]`)).toBeVisible({ timeout: 5000 });

    // Remove it
    await page.locator(`[data-testid="remove-download-${trackId}"]`).click();
    await expect(page.locator(`[data-testid="remove-download-${trackId}"]`)).toHaveCount(0, { timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });
});
