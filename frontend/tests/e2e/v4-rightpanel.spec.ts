import { test, expect, type Page } from '@playwright/test';

interface SeedResult {
  project: { id: string; name: string };
  music: Array<{ id: string; title: string }>;
}

async function seedAndSelect(page: Page): Promise<SeedResult> {
  const name = `RPTest-${Date.now()}`;
  const result: SeedResult = await page.request
    .post('http://localhost:3000/api/test/seed-project', { data: { name, music: true, lyrics: false } })
    .then(r => r.json());

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator(`[data-testid="project-item-${result.project.id}"]`).click();
  await page.waitForTimeout(1000);
  await page.locator(`[data-testid="track-row-${result.music[0].id}"]`).click();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-testid="right-panel-track"]')).toBeVisible({ timeout: 5000 });

  return result;
}

test.describe('RightPanel', () => {
  test('shows placeholder when no track selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="right-panel"]')).toContainText('Select a track', { timeout: 8000 });
  });

  test('double-click title enters edit mode and saves new title', async ({ page }) => {
    const { project, music } = await seedAndSelect(page);

    await page.locator('[data-testid="track-title-display"]').dblclick();
    await expect(page.locator('[data-testid="title-input"]')).toBeVisible({ timeout: 3000 });

    const newTitle = `Renamed-${Date.now()}`;
    await page.locator('[data-testid="title-input"]').fill(newTitle);
    await page.locator('[data-testid="title-input"]').press('Enter');
    await page.waitForTimeout(600);

    await expect(page.locator('[data-testid="track-title-display"]')).toContainText(newTitle, { timeout: 5000 });

    const track = await page.request.get(`http://localhost:3000/api/music/${music[0].id}`).then(r => r.json());
    expect(track.title).toBe(newTitle);

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('add and remove a timed note', async ({ page }) => {
    const { project } = await seedAndSelect(page);

    const noteText = `TestNote-${Date.now()}`;
    await page.locator('[data-testid="note-input"]').fill(noteText);
    await page.locator('[data-testid="add-note-btn"]').click();
    await page.waitForTimeout(600);

    const noteLocator = page.locator(`text=${noteText}`);
    await expect(noteLocator).toBeVisible({ timeout: 5000 });

    await noteLocator.locator('..').locator('button').click();
    await page.waitForTimeout(400);
    await expect(noteLocator).not.toBeVisible({ timeout: 3000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('quick actions navigate to correct tabs', async ({ page }) => {
    const { project } = await seedAndSelect(page);

    await page.locator('[data-testid="action-edit"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="tab-craft"]')).toHaveCSS('color', 'rgb(230, 57, 70)');

    await page.locator('[data-testid="action-master"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="tab-release"]')).toHaveCSS('color', 'rgb(230, 57, 70)');

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('generate share link and display URL', async ({ page }) => {
    const { project } = await seedAndSelect(page);

    await page.locator('[data-testid="action-share"]').click();
    await page.waitForTimeout(1200);

    await expect(page.locator('[data-testid="share-url"]')).toBeVisible({ timeout: 5000 });
    const shareText = await page.locator('[data-testid="share-url"]').textContent();
    expect(shareText).toContain('/share/');

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });
});
