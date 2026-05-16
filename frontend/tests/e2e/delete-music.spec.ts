/**
 * Delete Music E2E Test
 *
 * Tests that delete music functionality works correctly.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-audio.mp3');

async function getProjectWithMusic(page: Page) {
  const response = await page.request.get('http://localhost:3000/api/projects');
  const projects = await response.json();
  const projectsWithMusic = projects.filter((p: any) => p.current_music_version > 0);
  const uniqueName = projectsWithMusic.find((p: any) => {
    return projectsWithMusic.filter((o: any) => o.name === p.name).length === 1;
  });
  if (uniqueName) return uniqueName;
  return projectsWithMusic[0] || null;
}

test.describe('Delete Music - Backend API', () => {
  test('DELETE /api/music/:id removes music record', async ({ page }) => {
    // Create a test project with music via seed
    const seedRes = await page.request.post('http://localhost:3000/api/test/seed-project', {
      data: { name: `Delete Music Test ${Date.now()}`, lyrics: true, music: true }
    });
    expect(seedRes.status()).toBe(200);
    const { project } = await seedRes.json();

    // Get music list
    const musicRes = await page.request.get(`http://localhost:3000/api/projects/${project.id}/music`);
    expect(musicRes.status()).toBe(200);
    const musicList = await musicRes.json();
    expect(musicList.length).toBeGreaterThan(0);

    const musicToDelete = musicList[0];
    const musicId = musicToDelete.id;

    // Delete the music
    const deleteRes = await page.request.delete(`http://localhost:3000/api/music/${musicId}`);
    expect(deleteRes.status()).toBe(200);
    const deleteResult = await deleteRes.json();
    expect(deleteResult.message).toBe('Music deleted successfully');

    // Verify music is gone
    const getRes = await page.request.get(`http://localhost:3000/api/music/${musicId}`);
    expect(getRes.status()).toBe(404);
  });

  test('DELETE /api/music/:id returns 404 for non-existent music', async ({ page }) => {
    const deleteRes = await page.request.delete('http://localhost:3000/api/music/non-existent-id');
    expect(deleteRes.status()).toBe(404);
  });
});

test.describe('Delete Music - UI Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
  });

  test('delete button appears in track row actions', async ({ page }) => {
    // Seed a fresh project with music so test is self-contained
    const seedRes = await page.request.post('http://localhost:3000/api/test/seed-project', {
      data: { name: `UI Delete Test ${Date.now()}`, lyrics: true, music: true }
    });
    expect(seedRes.status()).toBe(200);
    const { project } = await seedRes.json();

    // Reload so new project appears in list
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate to the seeded project by name (seed endpoint returns stale version=0, navigate by name)
    const projectCard = page.locator('button').filter({ hasText: project.name }).first();
    await expect(projectCard).toBeVisible({ timeout: 5000 });
    await projectCard.click();
    await page.waitForTimeout(1500);

    // Navigate to Music step
    const musicBtn = page.locator('button:has-text("Music")').first();
    await expect(musicBtn).toBeVisible({ timeout: 3000 });
    if (!await musicBtn.isDisabled()) {
      await musicBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify track list is showing
    await expect(page.locator('text=Your Songs')).toBeVisible({ timeout: 5000 });

    // Track rows should exist (data-testid added to TrackRow)
    const trackRow = page.locator('[data-testid="track-row"]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });

    // Hover to reveal action buttons
    await trackRow.hover();
    await page.waitForTimeout(300);

    // Delete button must be present
    const deleteBtn = page.locator('button[title="Delete"]').first();
    await expect(deleteBtn).toBeVisible();
  });
});