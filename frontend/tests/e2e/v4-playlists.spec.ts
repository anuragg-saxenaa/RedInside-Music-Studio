import { test, expect, type Page } from '@playwright/test';

async function openPlaylistAccordion(page: Page) {
  await page.locator('[data-testid="left-sidebar"] button', { hasText: 'Playlists' }).click();
  await page.waitForTimeout(300);
}

async function seedProject(page: Page, name: string) {
  return page.request
    .post('http://localhost:3000/api/test/seed-project', { data: { name, music: true, lyrics: false } })
    .then(r => r.json());
}

test.describe('Playlists', () => {
  test('can create a playlist via sidebar accordion', async ({ page }) => {
    const projectName = `PlaylistTest-${Date.now()}`;
    const playlistName = `PL-${Date.now()}`;
    const { project } = await seedProject(page, projectName);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="project-item-${project.id}"]`).click();
    await page.waitForTimeout(600);

    await openPlaylistAccordion(page);

    await page.locator('[data-testid="new-playlist-input"]').fill(playlistName);
    await page.locator('[data-testid="create-playlist-btn"]').click();
    await page.waitForTimeout(800);

    await expect(page.locator(`text=${playlistName}`).first()).toBeVisible({ timeout: 5000 });

    // Cleanup
    const playlists: { id: string; name: string }[] = await page.request
      .get('http://localhost:3000/api/playlists')
      .then(r => r.json());
    const pl = playlists.find(p => p.name === playlistName);
    if (pl) await page.request.delete(`http://localhost:3000/api/playlists/${pl.id}`).catch(() => {});
    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('smart playlists are visible when accordion open', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openPlaylistAccordion(page);

    await expect(page.locator('[data-testid="smart-playlist-__all_mastered"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="smart-playlist-__instrumentals"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="smart-playlist-__unmastered"]')).toBeVisible({ timeout: 5000 });
  });

  test('can delete a playlist', async ({ page }) => {
    const playlistName = `DeleteMe-${Date.now()}`;

    const pl = await page.request
      .post('http://localhost:3000/api/playlists', { data: { name: playlistName } })
      .then(r => r.json());

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openPlaylistAccordion(page);

    await expect(page.locator(`[data-testid="playlist-item-${pl.id}"]`)).toBeVisible({ timeout: 5000 });

    await page.locator(`[data-testid="playlist-item-${pl.id}"] button`).click();
    await page.waitForTimeout(600);

    await expect(page.locator(`[data-testid="playlist-item-${pl.id}"]`)).not.toBeVisible({ timeout: 5000 });
  });

  test('add track to playlist from RightPanel', async ({ page }) => {
    const projectName = `PlaylistTrack-${Date.now()}`;
    const playlistName = `TrackPL-${Date.now()}`;
    const { project, music } = await seedProject(page, projectName);

    const pl = await page.request
      .post('http://localhost:3000/api/playlists', { data: { name: playlistName } })
      .then(r => r.json());

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="project-item-${project.id}"]`).click();
    await page.waitForTimeout(1000);

    await page.locator(`[data-testid="track-row-${music[0].id}"]`).click();
    await page.waitForTimeout(600);

    await expect(page.locator('[data-testid="right-panel-track"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="add-to-playlist-btn"]').click();
    await page.waitForTimeout(300);
    await page.locator(`[data-testid="add-to-playlist-option-${pl.id}"]`).click();
    await page.waitForTimeout(800);

    await expect(page.locator(`[data-testid="track-in-playlist-${pl.id}"]`)).toBeVisible({ timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/playlists/${pl.id}`).catch(() => {});
    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });
});
