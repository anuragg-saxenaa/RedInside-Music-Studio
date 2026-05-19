import { test, expect, type Page } from '@playwright/test';

async function seedAndOpenWrite(page: Page) {
  const name = `WriteTest-${Date.now()}`;
  const { project } = await page.request
    .post('http://localhost:3000/api/test/seed-project', { data: { name, music: false, lyrics: true } })
    .then(r => r.json());

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator(`[data-testid="project-item-${project.id}"]`).click();
  await page.waitForTimeout(800);
  await page.locator('[data-testid="tab-write"]').click();
  await page.waitForTimeout(400);

  return { project };
}

test.describe('WriteTab', () => {
  test('write tab renders with lyrics editor', async ({ page }) => {
    const { project } = await seedAndOpenWrite(page);

    await expect(page.locator('[data-testid="write-tab"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="write-tab"]')).not.toBeEmpty();

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('write tab shows prompt when no project selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="tab-write"]').click();
    await page.waitForTimeout(300);

    await expect(page.locator('[data-testid="write-tab"]')).toContainText('Select a project', { timeout: 5000 });
  });
});
