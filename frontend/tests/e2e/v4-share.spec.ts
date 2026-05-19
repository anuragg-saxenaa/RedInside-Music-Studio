import { test, expect } from '@playwright/test';

test.describe('Share Links', () => {
  test('share button generates link displayed in right panel', async ({ page }) => {
    const { project, music } = await page.request.post('http://localhost:3000/api/test/seed-project', {
      data: { name: `ShareE2E-${Date.now()}`, music: true },
    }).then(r => r.json());
    const musicArr = Array.isArray(music) ? music : [music];

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="project-item-${project.id}"]`).click();
    await page.waitForTimeout(1000);
    await page.locator(`[data-testid="track-row-${musicArr[0].id}"]`).click();
    await page.waitForTimeout(500);

    await page.locator('[data-testid="action-share"]').click();
    await page.waitForTimeout(1200);

    const shareUrlEl = page.locator('[data-testid="share-url"]');
    await expect(shareUrlEl).toBeVisible({ timeout: 8000 });
    const shareUrl = await shareUrlEl.textContent();
    expect(shareUrl).toMatch(/\/share\//);

    // Navigate to share view
    const token = shareUrl!.split('/share/')[1];
    await page.goto(`/#/share/${token}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page.locator('[data-testid="share-view"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator(`text=${project.name}`).first()).toBeVisible({ timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('invalid share token shows error page', async ({ page }) => {
    await page.goto('/#/share/totally-invalid-token-xyz-abc-123');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page.locator('text=Share link not found or expired').first()).toBeVisible({ timeout: 8000 });
  });
});
