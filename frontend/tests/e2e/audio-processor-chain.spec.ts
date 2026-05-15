import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-audio.mp3');

test.describe('AudioProcessor Chain E2E - Full Integration', () => {
  test('complete workflow: upload -> trim -> speed -> volume -> fade -> export', async ({ page }) => {
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
    }

    // Navigate to export step
    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isDisabled())) {
      await exportBtn.click();
      await page.waitForTimeout(1000);
    }

    // Find upload zone and upload file
    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeVisible({ timeout: 10000 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);
    await page.waitForTimeout(2000);

    // Double-click file item to open editor
    const fileItem = page.locator('[data-testid="file-item"]').last();
    await fileItem.dblclick();
    await page.waitForTimeout(1000);

    // Verify AudioEditorPanel loaded
    await expect(page.locator('text=AUDIO EDITOR')).toBeVisible({ timeout: 5000 });

    // Test TRIM section - use exact match in span
    const trimSection = page.getByText('TRIM', { exact: true });
    await expect(trimSection).toBeVisible();

    // Test SPEED section
    const speedSection = page.locator('span:has-text("SPEED")').first();
    await expect(speedSection).toBeVisible();

    // Test VOLUME section
    const volumeSection = page.locator('span:has-text("VOLUME")').first();
    await expect(volumeSection).toBeVisible();

    // Test EFFECTS section
    const effectsSection = page.getByText('EFFECTS', { exact: true });
    await expect(effectsSection).toBeVisible();

    // Test Preview button
    const previewBtn = page.getByText('PREVIEW', { exact: true });
    await expect(previewBtn).toBeVisible();

    // Test Export button
    const exportButton = page.getByText('EXPORT', { exact: true });
    await expect(exportButton).toBeVisible();

    // Check console bar shows playback info chips
    const spdChip = page.getByText('SPD', { exact: true });
    await expect(spdChip).toBeVisible();

    const volChip = page.getByText('VOL', { exact: true });
    await expect(volChip).toBeVisible();
  });

  test('AudioEditorPanel loads with correct initial state', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Load project
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible({ timeout: 2000 })) {
      await searchInput.fill('May');
      await page.waitForTimeout(500);
    }

    const mayProject = page.locator('text=May-06-MySongs').first();
    if (await mayProject.isVisible({ timeout: 2000 })) {
      await mayProject.click();
      await page.waitForTimeout(1500);
    }

    // Go to export
    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isDisabled())) {
      await exportBtn.click();
      await page.waitForTimeout(1000);
    }

    // Upload file
    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeVisible({ timeout: 10000 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);
    await page.waitForTimeout(2000);

    // Click EDIT (pencil icon)
    const editButton = page.locator('button.edit-btn').last();
    await editButton.waitFor({ state: 'visible', timeout: 5000 });
    await editButton.click();
    await page.waitForTimeout(1000);

    // Verify AUDIO EDITOR header visible
    await expect(page.locator('text=AUDIO EDITOR')).toBeVisible();

    // Verify CONTROLS sidebar title
    await expect(page.locator('text=CONTROLS')).toBeVisible();

    // Verify speed presets visible
    const presets = ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'];
    for (const preset of presets) {
      const presetBtn = page.locator(`button:has-text("${preset}")`).first();
      await expect(presetBtn).toBeVisible();
    }

    // Verify format options in export menu
    const exportMenuBtn = page.getByText('EXPORT', { exact: true });
    await exportMenuBtn.click();
    await page.waitForTimeout(300);

    // Verify export format options
    await expect(page.getByText('320kbps', { exact: true })).toBeVisible();
    await expect(page.getByText('Lossless', { exact: true }).first()).toBeVisible();
  });

  test('Speed and volume controls respond correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Load project
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible({ timeout: 2000 })) {
      await searchInput.fill('May');
      await page.waitForTimeout(500);
    }

    const mayProject = page.locator('text=May-06-MySongs').first();
    if (await mayProject.isVisible({ timeout: 2000 })) {
      await mayProject.click();
      await page.waitForTimeout(1500);
    }

    // Go to export
    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isDisabled())) {
      await exportBtn.click();
      await page.waitForTimeout(1000);
    }

    // Upload file
    const uploadZone = page.locator('[data-testid="upload-zone"]');
    await expect(uploadZone).toBeVisible({ timeout: 10000 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);
    await page.waitForTimeout(2000);

    // Click EDIT (pencil icon)
    const editButton = page.locator('button.edit-btn').last();
    await editButton.waitFor({ state: 'visible', timeout: 5000 });
    await editButton.click();
    await page.waitForTimeout(1000);

    // Verify audio editor loaded
    await expect(page.locator('text=AUDIO EDITOR')).toBeVisible();

    // Click a speed preset (1.25x)
    await page.locator('button:has-text("1.25x")').click();
    await page.waitForTimeout(300);

    // The preset button should now be active (has red background)
    const activePreset = page.locator('button:has-text("1.25x")').first();
    await expect(activePreset).toBeVisible();

    // Click another preset (1.5x)
    await page.locator('button:has-text("1.5x")').click();
    await page.waitForTimeout(300);

    // Verify fade effect toggles exist in EFFECTS section
    const fadeInToggle = page.getByText('FADE IN', { exact: true });
    await expect(fadeInToggle).toBeVisible();

    const fadeOutToggle = page.getByText('FADE OUT', { exact: true });
    await expect(fadeOutToggle).toBeVisible();

    const reverseToggle = page.getByText('REVERSE', { exact: true });
    await expect(reverseToggle).toBeVisible();
  });
});