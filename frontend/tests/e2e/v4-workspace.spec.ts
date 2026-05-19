import { test, expect } from '@playwright/test';

test.describe('StudioV4 Workspace', () => {
  test('DAW layout renders — sidebar, centre, right panel, player bar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="left-sidebar"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="centre-panel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="right-panel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="player-bar"]')).toBeVisible({ timeout: 5000 });
  });

  test('all 5 tabs are visible and clickable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible({ timeout: 8000 });

    for (const tab of ['sounds', 'write', 'create', 'craft', 'release']) {
      await expect(page.locator(`[data-testid="tab-${tab}"]`)).toBeVisible({ timeout: 5000 });
      await page.locator(`[data-testid="tab-${tab}"]`).click();
      await page.waitForTimeout(200);
    }
  });

  test('creating a project shows it in the sidebar', async ({ page }) => {
    const name = `WorkspaceTest-${Date.now()}`;
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="new-project-input"]').fill(name);
    await page.locator('[data-testid="create-project-btn"]').click();
    await page.waitForTimeout(1200);

    await expect(page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });

    // Cleanup
    const projects: { id: string; name: string }[] = await page.request
      .get('http://localhost:3000/api/projects')
      .then(r => r.json());
    const p = projects.find(x => x.name === name);
    if (p) await page.request.delete(`http://localhost:3000/api/projects/${p.id}`).catch(() => {});
  });

  test('player bar shows no track when nothing selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="player-bar"]')).toContainText('No track selected', { timeout: 8000 });
  });
});
