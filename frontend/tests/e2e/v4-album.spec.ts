import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3000';

async function seedAndOpen(page: Page, tab: 'album' | 'sounds' = 'album') {
  const { project, music } = await page.request.post(`${API}/api/test/seed-project`, {
    data: { name: `AlbumE2E-${Date.now()}`, music: true },
  }).then(r => r.json());

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator(`[data-testid="project-item-${project.id}"]`).click();
  await page.waitForTimeout(1200);
  await page.locator(`[data-testid="tab-${tab}"]`).click();

  return { project, music: Array.isArray(music) ? music : [music] };
}

test.describe('Album tab', () => {
  test('album tab is visible and shows no albums initially', async ({ page }) => {
    const { project } = await seedAndOpen(page, 'album');
    await expect(page.locator('[data-testid="album-tab"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="album-tab"]')).toContainText('No albums yet');
    await page.request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });

  test('can create a new album', async ({ page }) => {
    const { project } = await seedAndOpen(page, 'album');
    await expect(page.locator('[data-testid="album-tab"]')).toBeVisible({ timeout: 8000 });

    await page.locator('[data-testid="create-album-btn"]').click();
    await expect(page.locator('[data-testid="save-album-btn"]')).toBeVisible({ timeout: 5000 });

    await page.request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });

  test('can save album with title and artist', async ({ page }) => {
    const { project } = await seedAndOpen(page, 'album');
    await expect(page.locator('[data-testid="album-tab"]')).toBeVisible({ timeout: 8000 });

    await page.locator('[data-testid="create-album-btn"]').click();
    await page.locator('[data-testid="save-album-btn"]').waitFor({ timeout: 5000 });

    await page.locator('input[placeholder="Album title"]').fill('Dil Se EP');
    await page.locator('input[placeholder="Artist"]').fill('RedInside');
    await page.locator('[data-testid="save-album-btn"]').click();

    await expect(page.locator('[data-testid="album-tab"]')).toContainText('Dil Se EP', { timeout: 5000 });

    await page.request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });
});

test.describe('Track inline edit panel', () => {
  test('edit button opens inline panel', async ({ page }) => {
    const { project } = await seedAndOpen(page, 'sounds');
    await expect(page.locator('[data-testid="sounds-tab"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="track-list"]')).toBeVisible();

    const editBtn = page.locator('[data-testid="track-list"] button[title="Edit track metadata"]').first();
    await editBtn.click();
    await expect(page.locator('input[placeholder="Artist name"]')).toBeVisible({ timeout: 5000 });

    await page.request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });

  test('can save artist and genre metadata', async ({ page }) => {
    const { project } = await seedAndOpen(page, 'sounds');
    await expect(page.locator('[data-testid="sounds-tab"]')).toBeVisible({ timeout: 8000 });

    const editBtn = page.locator('[data-testid="track-list"] button[title="Edit track metadata"]').first();
    await editBtn.click();

    await page.locator('input[placeholder="Artist name"]').fill('RedInside');
    await page.locator('input[placeholder="Genre"]').fill('Desi Hip-Hop');
    await page.locator('button:has-text("Save")').last().click();

    await expect(page.locator('input[placeholder="Artist name"]')).not.toBeVisible({ timeout: 5000 });

    await page.request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });

  test('cancel closes edit panel without saving', async ({ page }) => {
    const { project } = await seedAndOpen(page, 'sounds');
    await expect(page.locator('[data-testid="sounds-tab"]')).toBeVisible({ timeout: 8000 });

    const editBtn = page.locator('[data-testid="track-list"] button[title="Edit track metadata"]').first();
    await editBtn.click();
    await expect(page.locator('input[placeholder="Artist name"]')).toBeVisible({ timeout: 5000 });

    await page.locator('button:has-text("Cancel")').last().click();
    await expect(page.locator('input[placeholder="Artist name"]')).not.toBeVisible({ timeout: 3000 });

    await page.request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });
});
