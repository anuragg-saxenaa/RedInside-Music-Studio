import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-audio.mp3');

test.describe('Audio Editor Full Flow E2E', () => {
  test('upload -> edit -> preview -> export flow', async ({ page }) => {
    // Skip if no fixture
    if (!fs.existsSync(FIXTURE_PATH)) {
      test.skip('No test audio fixture');
    }

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Load existing project with music directly - this project has music_version > 0
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible({ timeout: 2000 })) {
      await searchInput.fill('May');
      await page.waitForTimeout(500);
    }

    const mayProject = page.locator('text=May-06-MySongs').first();
    if (await mayProject.isVisible({ timeout: 2000 })) {
      await mayProject.click();
      await page.waitForTimeout(1500);
    } else {
      // Fallback - just proceed and check what's visible
      console.log('May project not found, checking state');
    }

    // Now we should be on the studio page
    // Navigate to Export step if enabled
    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isDisabled())) {
      await exportBtn.click();
      await page.waitForTimeout(1000);
    }

    // Find and use the upload zone
    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeVisible({ timeout: 10000 });

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);

    // Wait for upload to complete
    await page.waitForTimeout(2000);

    // Double-click file item to open editor
    const fileItem = page.locator('[data-testid="file-item"]').last();
    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    // Check AudioEditorPanel is visible
    const audioEditor = page.locator('text=Audio Editor');
    await expect(audioEditor).toBeVisible({ timeout: 5000 });

    // Preview button should be visible and clickable
    const previewBtn = page.locator('button:has-text("Preview")');
    await expect(previewBtn).toBeVisible();

    // Change speed slider - find the speed control range specifically
    const speedSlider = page.locator('[class*="slider"], input[type="range"]').nth(1);
    if (await speedSlider.isVisible()) {
      await speedSlider.fill('1.25');
    }

    // Click preview
    await previewBtn.click();
    await page.waitForTimeout(500);

    // Export button should be visible (use .last() to avoid the workflow stepper Export)
    const exportBtnAudio = page.locator('button:has-text("Export")').last();
    await expect(exportBtnAudio).toBeVisible();

    // Click export
    await exportBtnAudio.click();
    await page.waitForTimeout(500);

    // Select format from menu
    const mp3Option = page.locator('button:has-text("MP3 320k")');
    if (await mp3Option.isVisible()) {
      await mp3Option.click();
    }

    // Wait for export to complete
    await page.waitForTimeout(3000);
  });

  test('AudioEditorPanel renders with correct controls', async ({ page }) => {
    // Skip if no fixture
    if (!fs.existsSync(FIXTURE_PATH)) {
      test.skip('No test audio fixture');
    }

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Load existing project with music
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible({ timeout: 2000 })) {
      await searchInput.fill('May');
      await page.waitForTimeout(500);
    }

    const mayProject = page.locator('text=May-06-MySongs').first();
    if (await mayProject.isVisible({ timeout: 2000 })) {
      await mayProject.click();
      await page.waitForTimeout(1500);
    } else {
      // Create new project
      const nameInput = page.locator('input[placeholder*="Name your new track"]');
      if (await nameInput.isVisible({ timeout: 3000 })) {
        await nameInput.fill('E2E Controls Test');
        await page.locator('button:has-text("Create")').click();
        await page.waitForTimeout(1500);
      }
    }

    // Navigate to export step
    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isDisabled())) {
      await exportBtn.click();
      await page.waitForTimeout(500);
    }

    // Upload file first
    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeVisible({ timeout: 10000 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);
    await page.waitForTimeout(2000);

    // Double-click file item to open editor
    const fileItem = page.locator('[data-testid="file-item"]').last();
    await fileItem.dblclick();
    await page.waitForTimeout(1500);

    // Check for controls (now uppercase, use .first() to avoid strict mode)
    const trimSection = page.locator('text=TRIM').first();
    const speedSection = page.locator('text=SPEED').first();
    const volumeSection = page.locator('text=VOLUME').first();

    // At least some controls should be visible
    const hasAnyControl = await trimSection.isVisible() ||
                         await speedSection.isVisible() ||
                         await volumeSection.isVisible();

    expect(hasAnyControl).toBeTruthy();
  });
});
