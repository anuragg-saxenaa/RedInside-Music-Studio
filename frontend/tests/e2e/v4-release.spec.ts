import { test, expect, type Page } from '@playwright/test';

async function seedAndOpenRelease(page: Page) {
  const { project, music } = await page.request.post('http://localhost:3000/api/test/seed-project', {
    data: { name: `ReleaseTest-${Date.now()}`, music: true },
  }).then(r => r.json());

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator(`[data-testid="project-item-${project.id}"]`).click();
  await page.waitForTimeout(1000);

  const musicArr = Array.isArray(music) ? music : [music];
  await page.locator(`[data-testid="track-row-${musicArr[0].id}"]`).click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="tab-release"]').click();
  await page.waitForTimeout(500);

  return { project, music: musicArr };
}

test.describe('Release Tab', () => {
  test('readiness checklist is visible', async ({ page }) => {
    const { project } = await seedAndOpenRelease(page);
    await expect(page.locator('[data-testid="readiness-checklist"]')).toBeVisible({ timeout: 8000 });
    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('social export panel shows preset buttons', async ({ page }) => {
    const { project } = await seedAndOpenRelease(page);
    await expect(page.locator('[data-testid="social-export-panel"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="export-tiktok"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-reels"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-full"]')).toBeVisible();
    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('social export full preset downloads MP3', async ({ page }) => {
    const { project } = await seedAndOpenRelease(page);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('[data-testid="export-full"]').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.mp3$/);

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });
});
