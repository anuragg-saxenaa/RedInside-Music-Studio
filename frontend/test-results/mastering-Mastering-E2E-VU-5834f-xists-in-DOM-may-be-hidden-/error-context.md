# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mastering.spec.ts >> Mastering E2E >> VU meter exists in DOM (may be hidden)
- Location: tests/e2e/mastering.spec.ts:17:3

# Error details

```
Error: expect(locator).toBeAttached() failed

Locator: locator('[data-testid="vu-meter"]')
Expected: attached
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeAttached" with timeout 5000ms
  - waiting for locator('[data-testid="vu-meter"]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic:
    - img
    - img
  - banner [ref=e4]:
    - heading "RedInside Music Studio" [level=1] [ref=e5]:
      - img [ref=e6]
      - text: RedInside
      - generic [ref=e9]: Music Studio
    - navigation [ref=e10]:
      - link "History" [ref=e11] [cursor=pointer]:
        - /url: "#/history"
  - main [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e15]:
        - textbox "Name your new track..." [ref=e16]
        - button "Create" [disabled] [ref=e17]:
          - img [ref=e18]
          - text: Create
      - generic [ref=e20]:
        - img [ref=e21]
        - textbox "Search projects..." [ref=e24]
      - generic [ref=e25]:
        - heading "Recent" [level=3] [ref=e26]
        - generic [ref=e27]:
          - button "May-06-MySongs ✍️ Lyrics v13 🎵 Music v16 11h ago ⋮" [ref=e28] [cursor=pointer]:
            - generic [ref=e29]:
              - generic [ref=e30]:
                - heading "May-06-MySongs" [level=4] [ref=e31]
                - generic [ref=e32]:
                  - generic [ref=e33]: ✍️ Lyrics v13
                  - generic [ref=e35]: 🎵 Music v16
              - generic [ref=e37]:
                - generic [ref=e38]: 11h ago
                - button "⋮" [ref=e40]
          - button "test ✍️ Lyrics 🎵 Music 1d ago ⋮" [ref=e41] [cursor=pointer]:
            - generic [ref=e42]:
              - generic [ref=e43]:
                - heading "test" [level=4] [ref=e44]
                - generic [ref=e45]:
                  - generic [ref=e46]: ✍️ Lyrics
                  - generic [ref=e48]: 🎵 Music
              - generic [ref=e50]:
                - generic [ref=e51]: 1d ago
                - button "⋮" [ref=e53]
          - button "Test Project ✍️ Lyrics v1 🎵 Music v1 1d ago ⋮" [ref=e54] [cursor=pointer]:
            - generic [ref=e55]:
              - generic [ref=e56]:
                - heading "Test Project" [level=4] [ref=e57]
                - generic [ref=e58]:
                  - generic [ref=e59]: ✍️ Lyrics v1
                  - generic [ref=e61]: 🎵 Music v1
              - generic [ref=e63]:
                - generic [ref=e64]: 1d ago
                - button "⋮" [ref=e66]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Mastering E2E', () => {
  4  |   test('studio page loads', async ({ page }) => {
  5  |     await page.goto('/studio');
  6  |     // Just verify page loaded and has expected title
  7  |     await expect(page).toHaveTitle(/RedInside/);
  8  |   });
  9  | 
  10 |   test('upload zone exists in DOM (may be hidden)', async ({ page }) => {
  11 |     await page.goto('/studio');
  12 |     // Check the element exists in DOM (not necessarily visible)
  13 |     const uploadZone = page.locator('[data-testid="upload-zone"]');
  14 |     await expect(uploadZone).toBeAttached();
  15 |   });
  16 | 
  17 |   test('VU meter exists in DOM (may be hidden)', async ({ page }) => {
  18 |     await page.goto('/studio');
  19 |     const vuMeter = page.locator('[data-testid="vu-meter"]');
> 20 |     await expect(vuMeter).toBeAttached();
     |                           ^ Error: expect(locator).toBeAttached() failed
  21 |   });
  22 | });
```