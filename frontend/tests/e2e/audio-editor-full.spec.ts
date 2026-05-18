import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-audio.mp3');

async function seedProjectWithMusic(page: Page): Promise<{ id: string; name: string }> {
  const name = `AudioEditor Test ${Date.now()}`;
  const res = await page.request.post('http://localhost:3000/api/test/seed-project', {
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

  await page.locator('input[type="file"]').setInputFiles(FIXTURE_PATH);

  const fileItem = page.locator('[data-testid="file-item"]').last();
  await expect(fileItem, 'Uploaded file must appear in file list').toBeVisible({ timeout: 10000 });
  return fileItem;
}

test.describe('Audio Editor Full Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    if (!fs.existsSync(FIXTURE_PATH)) {
      test.skip('No test audio fixture at ' + FIXTURE_PATH);
    }
  });

  test('upload -> dblclick -> audio editor opens -> export dropdown appears', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    const fileItem = await navigateToExportAndUpload(page, project.name);

    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    // Audio editor MUST open — if not, this feature is broken
    await expect(page.locator('text=AUDIO EDITOR'), 'Audio editor must open after dblclick').toBeVisible({ timeout: 5000 });

    // Export button must be present (inline buttons, no dropdown needed)
    const exportDropdown = page.locator('[data-testid="export-dropdown-btn"]');
    await expect(exportDropdown, 'MP3 320kbps export option must appear').toBeVisible({ timeout: 3000 });
  });

  test('AudioEditorPanel renders TRIM, SPEED, VOLUME, FADE IN, REVERSE controls', async ({ page }) => {
    const project = await seedProjectWithMusic(page);
    const fileItem = await navigateToExportAndUpload(page, project.name);

    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    // Audio editor MUST open
    await expect(page.locator('text=AUDIO EDITOR'), 'Audio editor must open after dblclick').toBeVisible({ timeout: 5000 });

    // TRIM section
    await expect(page.locator('text=TRIM').first()).toBeVisible({ timeout: 3000 });

    // Speed/Volume sliders
    await expect(page.locator('input[type="range"]').first()).toBeVisible({ timeout: 3000 });

    // FADE IN toggle
    await expect(
      page.locator('text=FADE IN').or(page.locator('text=Fade In')).first()
    ).toBeVisible({ timeout: 3000 });

    // REVERSE toggle
    await expect(
      page.locator('text=REVERSE').or(page.locator('text=Reverse')).first()
    ).toBeVisible({ timeout: 3000 });
  });
});
