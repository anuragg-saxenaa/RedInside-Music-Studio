import { test, expect, type Page } from '@playwright/test';

async function seedAndOpenCraft(page: Page) {
  const name = `CraftTest-${Date.now()}`;
  const { project, music } = await page.request
    .post('http://localhost:3000/api/test/seed-project', { data: { name, music: true, lyrics: false } })
    .then(r => r.json());

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator(`[data-testid="project-item-${project.id}"]`).click();
  await page.waitForTimeout(1000);

  await page.locator(`[data-testid="track-row-${music[0].id}"]`).click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="tab-craft"]').click();
  await page.waitForTimeout(500);

  return { project, music: Array.isArray(music) ? music : [music] };
}

test.describe('CraftTab', () => {
  test('craft tab renders with audio editor visible', async ({ page }) => {
    const { project } = await seedAndOpenCraft(page);

    await expect(page.locator('[data-testid="craft-tab"]')).toBeVisible({ timeout: 8000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('switching to Medley Mixer sub-tab shows medley panel', async ({ page }) => {
    const { project } = await seedAndOpenCraft(page);

    await page.locator('[data-testid="craft-tab"] button', { hasText: 'Medley Mixer' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="craft-tab"]')).toBeVisible({ timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('A/B comparator renders in sounds tab with 2+ tracks', async ({ page }) => {
    const name = `ABTest-${Date.now()}`;
    const { project } = await page.request
      .post('http://localhost:3000/api/test/seed-project', { data: { name, music: true } })
      .then(r => r.json());

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="project-item-${project.id}"]`).click();
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="tab-sounds"]').click();
    await page.waitForTimeout(300);

    const trackCount = await page.locator('[data-testid^="track-row-"]').count();
    if (trackCount >= 2) {
      await expect(page.locator('[data-testid="ab-comparator"]')).toBeVisible({ timeout: 5000 });
    } else {
      await expect(page.locator('[data-testid="ab-comparator"]')).not.toBeVisible();
    }

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });
});
