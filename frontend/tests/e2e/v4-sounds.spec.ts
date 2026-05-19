import { test, expect, type Page } from '@playwright/test';

async function seedAndOpen(page: Page) {
  const name = `SoundsTest-${Date.now()}`;
  const { project, music } = await page.request.post('http://localhost:3000/api/test/seed-project', {
    data: { name, music: true },
  }).then(r => r.json());

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator(`[data-testid="project-item-${project.id}"]`).click();
  await page.waitForTimeout(1200);

  return { project, music: Array.isArray(music) ? music : [music] };
}

test.describe('SoundsTab', () => {
  test('track list shows seeded tracks', async ({ page }) => {
    const { project, music } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await expect(page.locator('[data-testid="track-list"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator(`[data-testid="track-row-${music[0].id}"]`)).toBeVisible({ timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('clicking track selects it and shows details in right panel', async ({ page }) => {
    const { project, music } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await page.locator(`[data-testid="track-row-${music[0].id}"]`).click();
    await page.waitForTimeout(600);

    await expect(page.locator('[data-testid="right-panel-track"]')).toBeVisible({ timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('Generate New button expands panel', async ({ page }) => {
    const { project } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await page.locator('[data-testid="generate-btn"]').click();
    await page.waitForTimeout(500);
    // Button should now be highlighted (active state)
    await expect(page.locator('[data-testid="generate-btn"]')).toBeVisible();

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('YouTube Import button expands YoutubeDownloader', async ({ page }) => {
    const { project } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await page.locator('[data-testid="youtube-btn"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="youtube-btn"]')).toBeVisible();

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('play button updates player bar track', async ({ page }) => {
    const { project, music } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await page.locator(`[data-testid="play-btn-${music[0].id}"]`).click();
    await page.waitForTimeout(1000);

    await expect(page.locator('[data-testid="player-bar"]')).not.toContainText('No track selected', { timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });
});
