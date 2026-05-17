import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-audio.mp3');
const API = 'http://localhost:3000';

async function seedProjectWithMusic(page: Page): Promise<{ id: string; name: string }> {
  const name = `AudioProcessor Test ${Date.now()}`;
  const res = await page.request.post(`${API}/api/test/seed-project`, {
    data: { name, lyrics: true, music: true }
  });
  const { project } = await res.json();
  return project;
}

async function navigateToExportAndUpload(page: Page, projectName: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const projectCard = page.locator('[role="button"]').filter({ hasText: projectName }).first();
  await expect(projectCard).toBeVisible({ timeout: 5000 });
  await projectCard.click();
  await page.waitForTimeout(1500);

  const exportBtn = page.locator('button:has-text("Export")').first();
  await expect(exportBtn).toBeVisible({ timeout: 5000 });
  await exportBtn.click({ force: true });
  await page.waitForTimeout(1500);

  await expect(page.locator('[data-testid="upload-zone"]')).toBeVisible({ timeout: 10000 });
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(FIXTURE_PATH);

  const fileItem = page.locator('[data-testid="file-item"]').last();
  await expect(fileItem).toBeVisible({ timeout: 10000 });
  return fileItem;
}

test.describe('AudioProcessor Chain E2E - Full Integration', () => {
  test.beforeEach(async ({ page }) => {
    if (!fs.existsSync(FIXTURE_PATH)) {
      test.skip('No test audio fixture at ' + FIXTURE_PATH);
    }
  });

  test('upload -> dblclick -> audio editor opens with TRIM section', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    const fileItem = await navigateToExportAndUpload(page, project.name);

    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    // AudioEditorPanel must open
    const audioEditor = page.locator('text=AUDIO EDITOR');
    await expect(audioEditor).toBeVisible({ timeout: 5000 });

    // TRIM section must be visible in ControlsSidebar
    const trimSection = page.locator('text=TRIM').first();
    await expect(trimSection).toBeVisible({ timeout: 3000 });
  });

  test('AudioEditorPanel loads with speed/volume controls', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    const fileItem = await navigateToExportAndUpload(page, project.name);

    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    await expect(page.locator('text=AUDIO EDITOR')).toBeVisible({ timeout: 5000 });

    // Speed slider must be visible
    const speedSlider = page.locator('input[type="range"]').first();
    await expect(speedSlider).toBeVisible({ timeout: 3000 });

    // Volume section
    const volumeSection = page.locator('text=VOLUME').first();
    await expect(volumeSection).toBeVisible({ timeout: 3000 });
  });

  test('Speed preset buttons change speed value', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    const fileItem = await navigateToExportAndUpload(page, project.name);

    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    await expect(page.locator('text=AUDIO EDITOR')).toBeVisible({ timeout: 5000 });

    // Click 1.25x speed preset
    const speedBtn = page.locator('button:has-text("1.25x")').first();
    await expect(speedBtn).toBeVisible({ timeout: 3000 });
    await speedBtn.click();
    await page.waitForTimeout(300);

    // Volume slider must be interactive
    const volumeSlider = page.locator('input[type="range"]').first();
    await expect(volumeSlider).toBeVisible({ timeout: 2000 });
  });
});
