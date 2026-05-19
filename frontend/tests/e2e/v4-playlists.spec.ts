import { test, expect } from '@playwright/test';

test.describe('Playlists', () => {
  test('create playlist appears in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const plName = `E2EPlaylist-${Date.now()}`;
    await page.locator('[data-testid="new-playlist-input"]').fill(plName);
    await page.locator('[data-testid="create-playlist-btn"]').click();
    await page.waitForTimeout(600);

    await expect(page.locator(`text=${plName}`).first()).toBeVisible({ timeout: 5000 });

    // Cleanup
    const playlists: { id: string; name: string }[] = await page.request
      .get('http://localhost:3000/api/playlists')
      .then(r => r.json());
    const pl = playlists.find(p => p.name === plName);
    if (pl) await page.request.delete(`http://localhost:3000/api/playlists/${pl.id}`).catch(() => {});
  });

  test('smart playlists are visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="smart-playlist-__all_mastered"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="smart-playlist-__instrumentals"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="smart-playlist-__unmastered"]')).toBeVisible({ timeout: 5000 });
  });

  test('delete playlist removes it from sidebar', async ({ page }) => {
    const { id: plId } = await page.request.post('http://localhost:3000/api/playlists', {
      data: { name: `ToDelete-${Date.now()}` },
    }).then(r => r.json());

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const item = page.locator(`[data-testid="playlist-item-${plId}"]`);
    await expect(item).toBeVisible({ timeout: 8000 });

    await item.locator('button').click();
    await page.waitForTimeout(600);

    await expect(page.locator(`[data-testid="playlist-item-${plId}"]`)).not.toBeVisible();
  });
});
