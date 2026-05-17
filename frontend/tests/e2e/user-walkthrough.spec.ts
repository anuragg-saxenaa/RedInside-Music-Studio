import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UI = 'http://localhost:5173';
const API = 'http://localhost:3000';
const OUT = '/tmp/walkthrough';
const FIXTURE = path.resolve(__dirname, '../../../backend/tests/fixtures/test-audio.mp3');

function shot(page: any, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
}

test.describe('Full User Walkthrough', () => {
test('Full user journey - every step', async ({ page, request }) => {
  const jsErrors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
  page.on('pageerror', e => jsErrors.push('PAGE ERROR: ' + e.message));

  // ── 1. HOME ──────────────────────────────────────────────────────────
  await page.goto(UI);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await shot(page, '01-home-empty');

  // App must show project creation UI
  await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('button:has-text("Create")')).toBeVisible({ timeout: 5000 });
  expect(jsErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  jsErrors.length = 0;

  // ── 2. CREATE PROJECT ─────────────────────────────────────────────────
  const projectName = 'Walkthrough Test ' + Date.now();
  await page.locator('input').first().fill(projectName);
  await page.locator('button:has-text("Create")').click();
  await page.waitForTimeout(1500);
  await shot(page, '02-studio-opened');

  // Studio must open — "Back to Projects" only appears in Studio
  await expect(
    page.locator('button:has-text("Back to Projects")').or(page.locator('text=Back to Projects')),
    'Studio must open after Create'
  ).toBeVisible({ timeout: 8000 });
  expect(jsErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  jsErrors.length = 0;

  // ── 3. LYRICS STEP ────────────────────────────────────────────────────
  await shot(page, '03-lyrics-step');

  // Lyrics step must have style select and generate button
  await expect(page.locator('[data-testid="style-select"]'), 'Style select must be visible in lyrics step').toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-testid="generate-lyrics-btn"]'), 'Generate Lyrics button must be visible').toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-testid="lyrics-prompt"]'), 'Lyrics prompt textarea must be visible').toBeVisible({ timeout: 5000 });
  expect(jsErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  jsErrors.length = 0;

  // ── 4. BACK TO PROJECTS ──────────────────────────────────────────────
  await page.locator('text=Back to Projects').click();
  await page.waitForTimeout(800);
  await shot(page, '04-back-to-projects');

  // Created project must be visible in project list
  await expect(
    page.locator('[role="button"]').filter({ hasText: projectName }).first(),
    'Created project must appear in project list'
  ).toBeVisible({ timeout: 5000 });
  expect(jsErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  jsErrors.length = 0;

  // ── 5. PROJECT WITH MUSIC: MUSIC STEP ────────────────────────────────
  const proj = await request.post(`${API}/api/projects`, { data: { name: 'Audio Test ' + Date.now() } });
  const { id: pid } = await proj.json();
  const fileBytes = fs.readFileSync(FIXTURE);
  const uploadRes = await request.post(`${API}/api/mastering/upload/${pid}`, {
    multipart: { files: { name: 'test.mp3', mimeType: 'audio/mpeg', buffer: fileBytes } }
  });
  const uploadData = await uploadRes.json();
  const fileId = uploadData.files[0].id;
  await request.post(`${API}/api/mastering/process`, {
    data: { fileId, projectId: pid, preset: 'spotify', saveToProject: true }
  });

  // Navigate to the project with music
  await page.goto(UI);
  await page.waitForLoadState('networkidle');
  const audioProj = page.locator('[role="button"]').filter({ hasText: 'Audio Test' }).first();
  await expect(audioProj).toBeVisible({ timeout: 5000 });
  await audioProj.click();
  await page.waitForTimeout(1500);
  await shot(page, '05-studio-audio-project');

  // ── 6. MUSIC STEP (has tracks) ────────────────────────────────────────
  const musicBtn = page.locator('button').filter({ hasText: /^music$/i }).first();
  // Music step must be enabled when project has music
  await expect(musicBtn).not.toBeDisabled({ timeout: 5000 });
  await musicBtn.click();
  await page.waitForTimeout(1500);
  await shot(page, '06-music-step-with-tracks');

  // Track rows must be visible
  await expect(page.locator('[data-testid="track-row"]').first(), 'Track row must show seeded music').toBeVisible({ timeout: 5000 });
  // Play button must exist
  await expect(page.locator('[data-testid="play-button"]').first()).toBeVisible({ timeout: 5000 });
  expect(jsErrors.filter(e => !e.includes('favicon') && !e.includes('AudioContext'))).toHaveLength(0);
  jsErrors.length = 0;

  // ── 7. EXPORT STEP ───────────────────────────────────────────────────
  await page.locator('button').filter({ hasText: /export/i }).first().click();
  await page.waitForTimeout(1500);
  await shot(page, '07-export-step');

  // Upload zone must be visible in export step
  await expect(page.locator('[data-testid="upload-zone"]'), 'Upload zone must be visible in Export step').toBeVisible({ timeout: 5000 });
  expect(jsErrors.filter(e => !e.includes('favicon') && !e.includes('AudioContext'))).toHaveLength(0);
  jsErrors.length = 0;

  // ── 8. HISTORY PAGE ───────────────────────────────────────────────────
  await page.goto(`${UI}/#/history`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await shot(page, '08-history');

  // History page must render with a project selector
  await expect(page.locator('select').first(), 'History must show a project selector <select>').toBeVisible({ timeout: 5000 });
  expect(jsErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  jsErrors.length = 0;

  // ── 9. SETTINGS PAGE ──────────────────────────────────────────────────
  await page.goto(`${UI}/#/settings`);
  await page.waitForTimeout(1000);
  await shot(page, '09-settings');

  // Settings must show API key field
  const settingsText = await page.locator('body').textContent();
  expect(settingsText?.toLowerCase(), 'Settings page must mention "api" and "key"').toMatch(/api.*key|key.*api/i);
  expect(jsErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  jsErrors.length = 0;

  // ── 10. VIRAL TOOLKIT ─────────────────────────────────────────────────
  await page.goto(`${UI}/#/viral`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await shot(page, '10-viral');

  // Viral page must show trends
  const viralText = await page.locator('body').textContent();
  expect(viralText?.toLowerCase(), 'Viral page must show trends content').toMatch(/trend/i);
  expect(jsErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);

  // Cleanup — delete only projects created in THIS test (by exact name match)
  await request.delete(`${API}/api/projects/${pid}`);
  const allProj = await request.get(`${API}/api/projects`);
  const projects = await allProj.json();
  for (const p of projects) {
    if (p.name === projectName) {
      await request.delete(`${API}/api/projects/${p.id}`);
    }
  }
});
}); // end describe
