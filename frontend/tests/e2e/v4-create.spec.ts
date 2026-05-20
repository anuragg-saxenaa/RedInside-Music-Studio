import { test, expect, type Page } from '@playwright/test';

async function seedAndOpenCreate(page: Page) {
  const name = `CreateTest-${Date.now()}`;
  const { project } = await page.request
    .post('http://localhost:3000/api/test/seed-project', { data: { name, music: true, lyrics: false } })
    .then(r => r.json());

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator(`[data-testid="project-item-${project.id}"]`).click();
  await page.waitForTimeout(800);
  await page.locator('[data-testid="tab-album"]').click();
  await page.waitForTimeout(400);

  return { project };
}

test.describe('CreateTab', () => {
  test('album tab is visible', async ({ page }) => {
    const { project } = await seedAndOpenCreate(page);

    await expect(page.locator('[data-testid="album-tab"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="section-artwork"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="section-video"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="section-voice"]')).toBeVisible({ timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('sections are collapsible', async ({ page }) => {
    const { project } = await seedAndOpenCreate(page);

    await page.locator('[data-testid="section-artwork"] button').first().click();
    await page.waitForTimeout(300);

    const artworkButtons = await page.locator('[data-testid="section-artwork"] button').count();
    expect(artworkButtons).toBe(1);

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('shows prompt when no project selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="tab-album"]').click();
    await page.waitForTimeout(300);

    await expect(page.locator('[data-testid="album-tab"]')).toContainText('Select a project', { timeout: 5000 });
  });
});
