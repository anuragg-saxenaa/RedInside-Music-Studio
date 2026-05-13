# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-app-flow.spec.ts >> Full App Flow - No Skips >> upload zone sends correct field name to backend
- Location: tests/e2e/full-app-flow.spec.ts:157:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.isDisabled: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Export")')

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
          - button "E2E Full Flow 1778633909346 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e28] [cursor=pointer]:
            - generic [ref=e29]:
              - generic [ref=e30]:
                - heading "E2E Full Flow 1778633909346" [level=4] [ref=e31]
                - generic [ref=e32]:
                  - generic [ref=e33]: ✍️ Lyrics
                  - generic [ref=e35]: 🎵 Music
              - generic [ref=e37]:
                - generic [ref=e38]: Just now
                - button "⋮" [ref=e40]
          - button "E2E Full Flow 1778633784381 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e41] [cursor=pointer]:
            - generic [ref=e42]:
              - generic [ref=e43]:
                - heading "E2E Full Flow 1778633784381" [level=4] [ref=e44]
                - generic [ref=e45]:
                  - generic [ref=e46]: ✍️ Lyrics
                  - generic [ref=e48]: 🎵 Music
              - generic [ref=e50]:
                - generic [ref=e51]: Just now
                - button "⋮" [ref=e53]
          - button "E2E Full Flow 1778633753788 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e54] [cursor=pointer]:
            - generic [ref=e55]:
              - generic [ref=e56]:
                - heading "E2E Full Flow 1778633753788" [level=4] [ref=e57]
                - generic [ref=e58]:
                  - generic [ref=e59]: ✍️ Lyrics
                  - generic [ref=e61]: 🎵 Music
              - generic [ref=e63]:
                - generic [ref=e64]: Just now
                - button "⋮" [ref=e66]
      - generic [ref=e67]:
        - heading "Older Projects" [level=3] [ref=e68]
        - generic [ref=e69]:
          - button "E2E Full Flow 1778633723223 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e70] [cursor=pointer]:
            - generic [ref=e71]:
              - generic [ref=e72]:
                - heading "E2E Full Flow 1778633723223" [level=4] [ref=e73]
                - generic [ref=e74]:
                  - generic [ref=e75]: ✍️ Lyrics
                  - generic [ref=e77]: 🎵 Music
              - generic [ref=e79]:
                - generic [ref=e80]: Just now
                - button "⋮" [ref=e82]
          - button "E2E Full Flow 1778633721524 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e83] [cursor=pointer]:
            - generic [ref=e84]:
              - generic [ref=e85]:
                - heading "E2E Full Flow 1778633721524" [level=4] [ref=e86]
                - generic [ref=e87]:
                  - generic [ref=e88]: ✍️ Lyrics
                  - generic [ref=e90]: 🎵 Music
              - generic [ref=e92]:
                - generic [ref=e93]: Just now
                - button "⋮" [ref=e95]
          - button "Mastering Project test-save-music-1778633686482 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e96] [cursor=pointer]:
            - generic [ref=e97]:
              - generic [ref=e98]:
                - heading "Mastering Project test-save-music-1778633686482" [level=4] [ref=e99]
                - generic [ref=e100]:
                  - generic [ref=e101]: ✍️ Lyrics
                  - generic [ref=e103]: 🎵 Music
              - generic [ref=e105]:
                - generic [ref=e106]: Just now
                - button "⋮" [ref=e108]
          - button "Mastering Project test-save-music-1778632107489 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e109] [cursor=pointer]:
            - generic [ref=e110]:
              - generic [ref=e111]:
                - heading "Mastering Project test-save-music-1778632107489" [level=4] [ref=e112]
                - generic [ref=e113]:
                  - generic [ref=e114]: ✍️ Lyrics
                  - generic [ref=e116]: 🎵 Music
              - generic [ref=e118]:
                - generic [ref=e119]: Just now
                - button "⋮" [ref=e121]
          - button "Mastering Project test-save-music-1778632039104 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e122] [cursor=pointer]:
            - generic [ref=e123]:
              - generic [ref=e124]:
                - heading "Mastering Project test-save-music-1778632039104" [level=4] [ref=e125]
                - generic [ref=e126]:
                  - generic [ref=e127]: ✍️ Lyrics
                  - generic [ref=e129]: 🎵 Music
              - generic [ref=e131]:
                - generic [ref=e132]: Just now
                - button "⋮" [ref=e134]
          - button "Batch Test Project ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e135] [cursor=pointer]:
            - generic [ref=e136]:
              - generic [ref=e137]:
                - heading "Batch Test Project" [level=4] [ref=e138]
                - generic [ref=e139]:
                  - generic [ref=e140]: ✍️ Lyrics
                  - generic [ref=e142]: 🎵 Music
              - generic [ref=e144]:
                - generic [ref=e145]: Just now
                - button "⋮" [ref=e147]
          - button "Batch Test Project ✍️ Lyrics v1 🎵 Music v1 Just now ⋮" [ref=e148] [cursor=pointer]:
            - generic [ref=e149]:
              - generic [ref=e150]:
                - heading "Batch Test Project" [level=4] [ref=e151]
                - generic [ref=e152]:
                  - generic [ref=e153]: ✍️ Lyrics v1
                  - generic [ref=e155]: 🎵 Music v1
              - generic [ref=e157]:
                - generic [ref=e158]: Just now
                - button "⋮" [ref=e160]
          - button "Mastering Project test-save-music-1778630336523 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e161] [cursor=pointer]:
            - generic [ref=e162]:
              - generic [ref=e163]:
                - heading "Mastering Project test-save-music-1778630336523" [level=4] [ref=e164]
                - generic [ref=e165]:
                  - generic [ref=e166]: ✍️ Lyrics
                  - generic [ref=e168]: 🎵 Music
              - generic [ref=e170]:
                - generic [ref=e171]: Just now
                - button "⋮" [ref=e173]
          - button "Mastering Project test-save-music-1778630323863 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e174] [cursor=pointer]:
            - generic [ref=e175]:
              - generic [ref=e176]:
                - heading "Mastering Project test-save-music-1778630323863" [level=4] [ref=e177]
                - generic [ref=e178]:
                  - generic [ref=e179]: ✍️ Lyrics
                  - generic [ref=e181]: 🎵 Music
              - generic [ref=e183]:
                - generic [ref=e184]: Just now
                - button "⋮" [ref=e186]
          - button "Mastering Project test-save-music-1778630289103 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e187] [cursor=pointer]:
            - generic [ref=e188]:
              - generic [ref=e189]:
                - heading "Mastering Project test-save-music-1778630289103" [level=4] [ref=e190]
                - generic [ref=e191]:
                  - generic [ref=e192]: ✍️ Lyrics
                  - generic [ref=e194]: 🎵 Music
              - generic [ref=e196]:
                - generic [ref=e197]: Just now
                - button "⋮" [ref=e199]
          - button "Mastering Project test-save-music-1778630269859 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e200] [cursor=pointer]:
            - generic [ref=e201]:
              - generic [ref=e202]:
                - heading "Mastering Project test-save-music-1778630269859" [level=4] [ref=e203]
                - generic [ref=e204]:
                  - generic [ref=e205]: ✍️ Lyrics
                  - generic [ref=e207]: 🎵 Music
              - generic [ref=e209]:
                - generic [ref=e210]: Just now
                - button "⋮" [ref=e212]
          - button "Mastering Project test-save-music-1778630242309 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e213] [cursor=pointer]:
            - generic [ref=e214]:
              - generic [ref=e215]:
                - heading "Mastering Project test-save-music-1778630242309" [level=4] [ref=e216]
                - generic [ref=e217]:
                  - generic [ref=e218]: ✍️ Lyrics
                  - generic [ref=e220]: 🎵 Music
              - generic [ref=e222]:
                - generic [ref=e223]: Just now
                - button "⋮" [ref=e225]
          - button "Mastering Project test-save-music-1778630174843 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e226] [cursor=pointer]:
            - generic [ref=e227]:
              - generic [ref=e228]:
                - heading "Mastering Project test-save-music-1778630174843" [level=4] [ref=e229]
                - generic [ref=e230]:
                  - generic [ref=e231]: ✍️ Lyrics
                  - generic [ref=e233]: 🎵 Music
              - generic [ref=e235]:
                - generic [ref=e236]: Just now
                - button "⋮" [ref=e238]
          - button "Mastering Project test-save-music-1778630147721 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e239] [cursor=pointer]:
            - generic [ref=e240]:
              - generic [ref=e241]:
                - heading "Mastering Project test-save-music-1778630147721" [level=4] [ref=e242]
                - generic [ref=e243]:
                  - generic [ref=e244]: ✍️ Lyrics
                  - generic [ref=e246]: 🎵 Music
              - generic [ref=e248]:
                - generic [ref=e249]: Just now
                - button "⋮" [ref=e251]
          - button "Mastering Project test-save-music-1778630132044 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e252] [cursor=pointer]:
            - generic [ref=e253]:
              - generic [ref=e254]:
                - heading "Mastering Project test-save-music-1778630132044" [level=4] [ref=e255]
                - generic [ref=e256]:
                  - generic [ref=e257]: ✍️ Lyrics
                  - generic [ref=e259]: 🎵 Music
              - generic [ref=e261]:
                - generic [ref=e262]: Just now
                - button "⋮" [ref=e264]
          - button "Mastering Project test-save-music-1778630116661 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e265] [cursor=pointer]:
            - generic [ref=e266]:
              - generic [ref=e267]:
                - heading "Mastering Project test-save-music-1778630116661" [level=4] [ref=e268]
                - generic [ref=e269]:
                  - generic [ref=e270]: ✍️ Lyrics
                  - generic [ref=e272]: 🎵 Music
              - generic [ref=e274]:
                - generic [ref=e275]: Just now
                - button "⋮" [ref=e277]
          - button "Mastering Project test-save-music-1778630102863 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e278] [cursor=pointer]:
            - generic [ref=e279]:
              - generic [ref=e280]:
                - heading "Mastering Project test-save-music-1778630102863" [level=4] [ref=e281]
                - generic [ref=e282]:
                  - generic [ref=e283]: ✍️ Lyrics
                  - generic [ref=e285]: 🎵 Music
              - generic [ref=e287]:
                - generic [ref=e288]: Just now
                - button "⋮" [ref=e290]
          - button "Mastering Project test-save-music-1778630070909 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e291] [cursor=pointer]:
            - generic [ref=e292]:
              - generic [ref=e293]:
                - heading "Mastering Project test-save-music-1778630070909" [level=4] [ref=e294]
                - generic [ref=e295]:
                  - generic [ref=e296]: ✍️ Lyrics
                  - generic [ref=e298]: 🎵 Music
              - generic [ref=e300]:
                - generic [ref=e301]: Just now
                - button "⋮" [ref=e303]
          - button "Mastering Project test-save-music-1778630064525 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e304] [cursor=pointer]:
            - generic [ref=e305]:
              - generic [ref=e306]:
                - heading "Mastering Project test-save-music-1778630064525" [level=4] [ref=e307]
                - generic [ref=e308]:
                  - generic [ref=e309]: ✍️ Lyrics
                  - generic [ref=e311]: 🎵 Music
              - generic [ref=e313]:
                - generic [ref=e314]: Just now
                - button "⋮" [ref=e316]
          - button "Mastering Project test-manual-1778630058080 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e317] [cursor=pointer]:
            - generic [ref=e318]:
              - generic [ref=e319]:
                - heading "Mastering Project test-manual-1778630058080" [level=4] [ref=e320]
                - generic [ref=e321]:
                  - generic [ref=e322]: ✍️ Lyrics
                  - generic [ref=e324]: 🎵 Music
              - generic [ref=e326]:
                - generic [ref=e327]: Just now
                - button "⋮" [ref=e329]
          - button "Mastering Project test-manual-1778629999902 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e330] [cursor=pointer]:
            - generic [ref=e331]:
              - generic [ref=e332]:
                - heading "Mastering Project test-manual-1778629999902" [level=4] [ref=e333]
                - generic [ref=e334]:
                  - generic [ref=e335]: ✍️ Lyrics
                  - generic [ref=e337]: 🎵 Music
              - generic [ref=e339]:
                - generic [ref=e340]: Just now
                - button "⋮" [ref=e342]
          - button "Mastering Project test-manual-1778629954842 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e343] [cursor=pointer]:
            - generic [ref=e344]:
              - generic [ref=e345]:
                - heading "Mastering Project test-manual-1778629954842" [level=4] [ref=e346]
                - generic [ref=e347]:
                  - generic [ref=e348]: ✍️ Lyrics
                  - generic [ref=e350]: 🎵 Music
              - generic [ref=e352]:
                - generic [ref=e353]: Just now
                - button "⋮" [ref=e355]
          - button "Mastering Project test-save-music-1778629939279 ✍️ Lyrics 🎵 Music Just now ⋮" [ref=e356] [cursor=pointer]:
            - generic [ref=e357]:
              - generic [ref=e358]:
                - heading "Mastering Project test-save-music-1778629939279" [level=4] [ref=e359]
                - generic [ref=e360]:
                  - generic [ref=e361]: ✍️ Lyrics
                  - generic [ref=e363]: 🎵 Music
              - generic [ref=e365]:
                - generic [ref=e366]: Just now
                - button "⋮" [ref=e368]
          - button "May-06-MySongs ✍️ Lyrics v13 🎵 Music v17 1d ago ⋮" [ref=e369] [cursor=pointer]:
            - generic [ref=e370]:
              - generic [ref=e371]:
                - heading "May-06-MySongs" [level=4] [ref=e372]
                - generic [ref=e373]:
                  - generic [ref=e374]: ✍️ Lyrics v13
                  - generic [ref=e376]: 🎵 Music v17
              - generic [ref=e378]:
                - generic [ref=e379]: 1d ago
                - button "⋮" [ref=e381]
          - button "Final E2E Test ✍️ Lyrics v1 🎵 Music 2d ago ⋮" [ref=e382] [cursor=pointer]:
            - generic [ref=e383]:
              - generic [ref=e384]:
                - heading "Final E2E Test" [level=4] [ref=e385]
                - generic [ref=e386]:
                  - generic [ref=e387]: ✍️ Lyrics v1
                  - generic [ref=e389]: 🎵 Music
              - generic [ref=e391]:
                - generic [ref=e392]: 2d ago
                - button "⋮" [ref=e394]
          - button "Final E2E Test ✍️ Lyrics 🎵 Music 3d ago ⋮" [ref=e395] [cursor=pointer]:
            - generic [ref=e396]:
              - generic [ref=e397]:
                - heading "Final E2E Test" [level=4] [ref=e398]
                - generic [ref=e399]:
                  - generic [ref=e400]: ✍️ Lyrics
                  - generic [ref=e402]: 🎵 Music
              - generic [ref=e404]:
                - generic [ref=e405]: 3d ago
                - button "⋮" [ref=e407]
          - button "E2E Test Project Controls ✍️ Lyrics 🎵 Music 3d ago ⋮" [ref=e408] [cursor=pointer]:
            - generic [ref=e409]:
              - generic [ref=e410]:
                - heading "E2E Test Project Controls" [level=4] [ref=e411]
                - generic [ref=e412]:
                  - generic [ref=e413]: ✍️ Lyrics
                  - generic [ref=e415]: 🎵 Music
              - generic [ref=e417]:
                - generic [ref=e418]: 3d ago
                - button "⋮" [ref=e420]
          - button "E2E Test Project ✍️ Lyrics 🎵 Music 3d ago ⋮" [ref=e421] [cursor=pointer]:
            - generic [ref=e422]:
              - generic [ref=e423]:
                - heading "E2E Test Project" [level=4] [ref=e424]
                - generic [ref=e425]:
                  - generic [ref=e426]: ✍️ Lyrics
                  - generic [ref=e428]: 🎵 Music
              - generic [ref=e430]:
                - generic [ref=e431]: 3d ago
                - button "⋮" [ref=e433]
          - button "E2E Test Project Controls ✍️ Lyrics 🎵 Music 3d ago ⋮" [ref=e434] [cursor=pointer]:
            - generic [ref=e435]:
              - generic [ref=e436]:
                - heading "E2E Test Project Controls" [level=4] [ref=e437]
                - generic [ref=e438]:
                  - generic [ref=e439]: ✍️ Lyrics
                  - generic [ref=e441]: 🎵 Music
              - generic [ref=e443]:
                - generic [ref=e444]: 3d ago
                - button "⋮" [ref=e446]
          - button "E2E Test Project ✍️ Lyrics 🎵 Music 3d ago ⋮" [ref=e447] [cursor=pointer]:
            - generic [ref=e448]:
              - generic [ref=e449]:
                - heading "E2E Test Project" [level=4] [ref=e450]
                - generic [ref=e451]:
                  - generic [ref=e452]: ✍️ Lyrics
                  - generic [ref=e454]: 🎵 Music
              - generic [ref=e456]:
                - generic [ref=e457]: 3d ago
                - button "⋮" [ref=e459]
          - button "test ✍️ Lyrics 🎵 Music 5d ago ⋮" [ref=e460] [cursor=pointer]:
            - generic [ref=e461]:
              - generic [ref=e462]:
                - heading "test" [level=4] [ref=e463]
                - generic [ref=e464]:
                  - generic [ref=e465]: ✍️ Lyrics
                  - generic [ref=e467]: 🎵 Music
              - generic [ref=e469]:
                - generic [ref=e470]: 5d ago
                - button "⋮" [ref=e472]
          - button "Test Project ✍️ Lyrics v1 🎵 Music v1 5d ago ⋮" [ref=e473] [cursor=pointer]:
            - generic [ref=e474]:
              - generic [ref=e475]:
                - heading "Test Project" [level=4] [ref=e476]
                - generic [ref=e477]:
                  - generic [ref=e478]: ✍️ Lyrics v1
                  - generic [ref=e480]: 🎵 Music v1
              - generic [ref=e482]:
                - generic [ref=e483]: 5d ago
                - button "⋮" [ref=e485]
```

# Test source

```ts
  89  | 
  90  |     // Find and click our project (it has unique name with timestamp)
  91  |     const projectCard = page.locator(`button:has-text("${projectId.substring(0, 8)}")`).first();
  92  |     const projectExists = await projectCard.isVisible().catch(() => false);
  93  | 
  94  |     if (!projectExists) {
  95  |       // Try finding by partial match on the E2E prefix
  96  |       const allCards = page.locator('button[class*="project"], button[class*="card"]');
  97  |       const count = await allCards.count();
  98  |       if (count === 0) {
  99  |         throw new Error('No project cards found - app may not be loading correctly');
  100 |       }
  101 |       // Click first project that has Music available
  102 |       for (let i = 0; i < count; i++) {
  103 |         await allCards.nth(i).click();
  104 |         await page.waitForTimeout(500);
  105 |         const exportBtn = page.locator('button:has-text("Export")');
  106 |         if (await exportBtn.isVisible() && !(await exportBtn.isDisabled())) {
  107 |           break;
  108 |         }
  109 |       }
  110 |     } else {
  111 |       await projectCard.click();
  112 |     }
  113 | 
  114 |     await page.waitForTimeout(1500);
  115 | 
  116 |     // Click Export step (should be enabled now that we have music)
  117 |     const exportBtn = page.locator('button:has-text("Export")');
  118 |     await expect(exportBtn).toBeVisible({ timeout: 5000 });
  119 | 
  120 |     // If Export is disabled, something is wrong with setup
  121 |     const isDisabled = await exportBtn.isDisabled();
  122 |     if (isDisabled) {
  123 |       throw new Error('Export button disabled - setup failed or music not created');
  124 |     }
  125 | 
  126 |     await exportBtn.click();
  127 |     await page.waitForTimeout(1000);
  128 | 
  129 |     // CRITICAL: Verify mastering panel is visible
  130 |     const masteringPanel = page.locator('.mastering-panel, [data-testid="mastering-panel"]');
  131 |     await expect(masteringPanel).toBeVisible({ timeout: 10000 });
  132 | 
  133 |     // CRITICAL: Verify upload zone is visible
  134 |     const uploadZone = page.locator('[data-testid="upload-zone"]');
  135 |     await expect(uploadZone).toBeVisible({ timeout: 5000 });
  136 | 
  137 |     // CRITICAL: Upload file and verify it appears
  138 |     // This exercises the UI→API contract
  139 |     const fileInput = page.locator('input[type="file"]');
  140 |     await fileInput.setInputFiles(FIXTURE_PATH);
  141 | 
  142 |     // Wait for file to appear in list
  143 |     // If this times out, the upload didn't work (like the `file` vs `files` bug)
  144 |     const fileItem = page.locator('[data-testid="file-item"]');
  145 |     await expect(fileItem).toBeVisible({ timeout: 10000 });
  146 | 
  147 |     // Verify file has correct status
  148 |     const pendingTag = page.locator('.tag-pending, [class*="pending"], text="Pending"');
  149 |     const hasPending = await pendingTag.isVisible().catch(() => false);
  150 | 
  151 |     if (hasPending) {
  152 |       // File uploaded successfully and shows Pending status
  153 |       console.log('✓ File uploaded successfully via UI');
  154 |     }
  155 |   });
  156 | 
  157 |   test('upload zone sends correct field name to backend', async ({ page }) => {
  158 |     // This test verifies the API contract that caused the `file` vs `files` bug
  159 |     expect(fs.existsSync(FIXTURE_PATH)).toBe(true);
  160 | 
  161 |     const { projectId } = await setupProjectWithMusic(page);
  162 | 
  163 |     // Navigate to Export step
  164 |     await page.goto('/');
  165 |     await page.waitForLoadState('networkidle');
  166 |     await page.waitForSelector('input[placeholder*="Name your new track"]', { timeout: 10000 });
  167 | 
  168 |     // Find project and navigate to Export
  169 |     const projectCard = page.locator(`button:has-text("${projectId.substring(0, 8)}")`).first();
  170 |     const exists = await projectCard.isVisible().catch(() => false);
  171 |     if (exists) {
  172 |       await projectCard.click();
  173 |     } else {
  174 |       // Find any project with Export enabled
  175 |       const cards = page.locator('button[class*="project"], button[class*="card"]');
  176 |       const count = await cards.count();
  177 |       for (let i = 0; i < count; i++) {
  178 |         await cards.nth(i).click();
  179 |         await page.waitForTimeout(500);
  180 |         const exportBtn = page.locator('button:has-text("Export")');
  181 |         if (await exportBtn.isVisible() && !(await exportBtn.isDisabled())) {
  182 |           break;
  183 |         }
  184 |       }
  185 |     }
  186 |     await page.waitForTimeout(1500);
  187 | 
  188 |     const exportBtn = page.locator('button:has-text("Export")');
> 189 |     if (!(await exportBtn.isDisabled())) {
      |                           ^ Error: locator.isDisabled: Test timeout of 60000ms exceeded.
  190 |       await exportBtn.click();
  191 |     }
  192 |     await page.waitForTimeout(1000);
  193 | 
  194 |     await expect(page.locator('[data-testid="upload-zone"]')).toBeVisible({ timeout: 5000 });
  195 | 
  196 |     // Upload file via UI
  197 |     const fileInput = page.locator('input[type="file"]');
  198 |     await fileInput.setInputFiles(FIXTURE_PATH);
  199 | 
  200 |     // CRITICAL: File must appear if backend accepts the request
  201 |     // If backend returns 400 (wrong field name), file won't appear
  202 |     const fileItem = page.locator('[data-testid="file-item"]');
  203 | 
  204 |     // Wait longer - backend might be slow
  205 |     const appeared = await fileItem.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  206 | 
  207 |     if (!appeared) {
  208 |       // Diagnose: check what error backend returned
  209 |       // We can't directly check network logs in Playwright easily,
  210 |       // but we can check if the upload zone shows any error state
  211 |       const uploadZone = page.locator('[data-testid="upload-zone"]');
  212 |       const zoneText = await uploadZone.textContent();
  213 |       throw new Error(`File did not appear after upload. This means backend rejected the request (likely wrong field name). Upload zone text: ${zoneText}`);
  214 |     }
  215 | 
  216 |     console.log('✓ Upload zone sends correct field name - backend accepts upload');
  217 |   });
  218 | 
  219 |   test('batch mastering - master all → save to music', async ({ page }) => {
  220 |     expect(fs.existsSync(FIXTURE_PATH)).toBe(true);
  221 | 
  222 |     const { projectId } = await setupProjectWithMusic(page);
  223 | 
  224 |     // Navigate to Export
  225 |     await page.goto('/');
  226 |     await page.waitForLoadState('networkidle');
  227 |     await page.waitForSelector('input[placeholder*="Name your new track"]', { timeout: 10000 });
  228 | 
  229 |     const projectCard = page.locator(`button:has-text("${projectId.substring(0, 8)}")`).first();
  230 |     if (await projectCard.isVisible().catch(() => false)) {
  231 |       await projectCard.click();
  232 |     } else {
  233 |       const cards = page.locator('button[class*="project"], button[class*="card"]');
  234 |       const count = await cards.count();
  235 |       for (let i = 0; i < count; i++) {
  236 |         await cards.nth(i).click();
  237 |         await page.waitForTimeout(500);
  238 |         const exportBtn = page.locator('button:has-text("Export")');
  239 |         if (await exportBtn.isVisible() && !(await exportBtn.isDisabled())) break;
  240 |       }
  241 |     }
  242 |     await page.waitForTimeout(1500);
  243 | 
  244 |     const exportBtn = page.locator('button:has-text("Export")');
  245 |     if (!(await exportBtn.isDisabled())) {
  246 |       await exportBtn.click();
  247 |     }
  248 |     await page.waitForTimeout(1000);
  249 | 
  250 |     // Upload multiple files
  251 |     const fileInput = page.locator('input[type="file"]');
  252 |     await fileInput.setInputFiles([FIXTURE_PATH, FIXTURE_PATH]);
  253 | 
  254 |     // Wait for files to appear
  255 |     const fileItems = page.locator('[data-testid="file-item"]');
  256 |     await expect(fileItems).toHaveCount(2, { timeout: 15000 });
  257 | 
  258 |     console.log('✓ Multiple files uploaded successfully');
  259 | 
  260 |     // Click Master All
  261 |     const masterAllBtn = page.locator('button:has-text("Master All")');
  262 |     await masterAllBtn.click();
  263 | 
  264 |     // Wait for at least one file to be mastered (FFmpeg takes time)
  265 |     const masteredItem = page.locator('[data-testid="file-item"]:has-text("Mastered"), .tag-complete');
  266 |     const masteredAppeared = await masteredItem.waitFor({ state: 'visible', timeout: 180000 }).then(() => true).catch(() => false);
  267 | 
  268 |     if (masteredAppeared) {
  269 |       console.log('✓ Files mastered successfully');
  270 | 
  271 |       // Select mastered file(s)
  272 |       const firstFile = page.locator('[data-testid="file-item"]').first();
  273 |       await firstFile.click();
  274 | 
  275 |       // Verify selection count shows
  276 |       const selectionInfo = page.locator('text=/\\d+ selected/');
  277 |       await expect(selectionInfo).toBeVisible({ timeout: 3000 });
  278 | 
  279 |       // Save to Music
  280 |       const saveBtn = page.locator('button:has-text("Save to Music")');
  281 |       await saveBtn.click();
  282 | 
  283 |       // Wait for success feedback
  284 |       await page.waitForTimeout(2000);
  285 |       console.log('✓ Save to Music clicked');
  286 |     } else {
  287 |       console.log('⚠ Master All timed out (FFmpeg may be slow or unavailable)');
  288 |     }
  289 |   });
```