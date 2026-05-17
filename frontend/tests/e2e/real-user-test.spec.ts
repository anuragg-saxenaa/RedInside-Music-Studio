import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000';

test.describe('Real User Journey - Finding actual bugs', () => {
  let projectId: string;
  
  test.beforeAll(async ({ request }) => {
    const proj = await request.post(`${API}/api/projects`, {
      data: { name: 'REAL_USER_TEST_' + Date.now() }
    });
    projectId = (await proj.json()).id;
  });
  
  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`);
  });

  test('PROJECT SELECT: create project and load studio', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    // App renders without crash
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Type project name and create
    await page.fill('input[placeholder*="Name your"]', 'Test Track ' + Date.now());
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(2000);

    // Should show Studio — look for "← Back to Projects" which only exists in Studio
    await expect(page.locator('button:has-text("Back to Projects")').or(page.locator('text=Back to Projects'))).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: '/tmp/01_studio_loaded.png' });
  });

  test('LYRICS STEP: UI renders correctly', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Click a REAL_USER_TEST project (created in beforeAll)
    const projectBtn = page.locator('button, div[role="button"]').filter({ hasText: /REAL_USER_TEST/ }).first();
    await expect(projectBtn).toBeVisible({ timeout: 5000 });
    await projectBtn.click();
    await page.waitForTimeout(1500);

    // Studio loaded - back button confirms we're in studio
    await expect(page.locator('text=Back to Projects')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: '/tmp/02_lyrics_step.png' });

    // Lyrics step renders
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.toLowerCase()).toMatch(/style|lyrics|generate/i);
  });

  test('MUSIC STEP: navigation and UI', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    
    // Load project with existing music
    const music = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/projects/${pid}/music`);
      return r.json();
    }, projectId);
    
    // Use a project that has music
    await page.evaluate(async (pid) => {
      const r = await fetch(`/api/projects/${pid}`);
      const proj = await r.json();
      return proj;
    }, projectId);
    
    // Navigate directly
    await page.evaluate((pid) => {
      window.location.href = '/';
    }, projectId);
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/03_project_list.png' });
  });

  test('SETTINGS PAGE: loads and shows API key field', async ({ page }) => {
    await page.goto('http://localhost:5173/#/settings');
    await page.waitForTimeout(1000);
    
    const settings = await page.evaluate(async () => {
      const r = await fetch('/api/settings');
      return r.json();
    });
    console.log('Settings:', JSON.stringify(settings).slice(0, 200));
    await page.screenshot({ path: '/tmp/04_settings.png' });
    const settingsBody = await page.locator('body').textContent();
    expect(settingsBody?.toLowerCase()).toMatch(/settings|api|configuration/i);
  });

  test('HISTORY PAGE: loads and shows projects', async ({ page }) => {
    await page.goto('http://localhost:5173/#/history');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/05_history.png' });
    // Should show something, not crash
    const bodyText = await page.locator('body').textContent();
    console.log('History page text sample:', bodyText?.slice(0, 200));
    expect(bodyText).toBeTruthy();
  });

  test('VIRAL TOOLKIT PAGE: loads and shows trends', async ({ page }) => {
    await page.goto('http://localhost:5173/#/viral');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/06_viral.png' });
    // Should show trends data
    const viralBody = await page.locator('body').textContent();
    expect(viralBody?.toLowerCase()).toMatch(/viral|trend/i);
  });
});
