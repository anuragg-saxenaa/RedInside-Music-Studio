# Phase 1 & Phase 2 Integration Test Specification

**Date:** 2026-05-12
**Purpose:** Document mandatory integration tests for all Phase 1 and Phase 2 features
**Status:** MANDATORY - All tests must pass before feature is considered complete

---

## Critical: Testing Principle

> **Frontend tests that don't call real backend are worthless.** They verify component logic, not API contract. The `file` vs `files` bug proved this.

Every feature needs tests that exercise:
1. Frontend UI → Real Backend API → Real Response → UI Update

---

## Phase 1: Core Music Generation

### Feature 1.1: Lyrics Generation

**Backend Integration Test Requirements:**
```javascript
// backend/tests/integration/lyrics.e2e.test.js
test('generates lyrics via API', async ({ page }) => {
  // 1. Create project
  const projectRes = await fetch('http://localhost:3000/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Project' })
  });

  // 2. Generate lyrics
  const lyricsRes = await fetch(`http://localhost:3000/api/lyrics/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'test lyrics', style: 'hinglish-urban' })
  });

  // 3. Verify response structure
  const lyrics = await lyricsRes.json();
  assert.strictEqual(lyrics.status, 'complete');
  assert.ok(lyrics.content);
});
```

**Frontend E2E Test Requirements:**
```typescript
// frontend/tests/e2e/lyrics.spec.ts
test('generates lyrics via UI', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("New Project")');

  // Fill lyrics form
  await page.fill('[data-testid="lyrics-prompt"]', 'test lyrics');
  await page.selectOption('[data-testid="style-select"]', 'hinglish-urban');

  // Click generate
  await page.click('button:has-text("Generate Lyrics")');

  // Wait for completion
  await expect(page.locator('[data-testid="lyrics-output"]')).toBeVisible({ timeout: 60000 });

  // Verify lyrics appear
  const lyricsText = await page.locator('[data-testid="lyrics-output"]').textContent();
  assert.ok(lyricsText.length > 50);
});
```

### Feature 1.2: Music Generation

**Backend Integration Test Requirements:**
```javascript
test('generates music via API', async () => {
  // 1. Create lyrics first
  const lyricsId = await createLyrics(projectId);

  // 2. Generate music
  const musicRes = await fetch(`http://localhost:3000/api/music/generate/${lyricsId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'mini-jazz' })
  });

  const music = await musicRes.json();
  assert.ok(music.id);
  assert.ok(music.originalFilePath || music.status);

  // 3. Poll until complete (or queue)
  if (music.status === 'queued') {
    const jobId = music.jobId;
    // Poll for completion
  }
});
```

**Frontend E2E Test Requirements:**
```typescript
test('generates music via UI', async ({ page }) => {
  // 1. Navigate to project with lyrics
  await page.goto('/project/test-project-id');

  // 2. Click generate music
  await page.click('button:has-text("Generate Music")');

  // 3. Wait for job to start
  await expect(page.locator('[data-testid="job-status"]')).toContainText('queued');

  // 4. Wait for completion (up to 2 min)
  await expect(page.locator('[data-testid="music-player"]')).toBeVisible({ timeout: 120000 });

  // 5. Verify player has controls
  await expect(page.locator('[data-testid="play-button"]')).toBeVisible();
});
```

### Feature 1.3: Audio Mastering (Single File)

**Backend Integration Test Requirements:**
```javascript
test('master single audio file', async () => {
  // 1. Upload audio
  const form = new FormData();
  form.append('files', fs.createReadStream('./fixtures/test.mp3'));

  const uploadRes = await fetch(`/api/mastering/upload/${projectId}`, {
    method: 'POST',
    body: form
  });

  const { files: [{ id: fileId }] } = await uploadRes.json();
  assert.ok(fileId);

  // 2. Process/master
  const processRes = await fetch('/api/mastering/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds: [fileId], projectId, preset: 'spotify' })
  });

  const { results } = await processRes.json();
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].status, 'success');

  // 3. Verify mastered file exists
  assert.ok(fs.existsSync(results[0].masteredPath));
});
```

**Frontend E2E Test Requirements:**
```typescript
test('master audio via UI', async ({ page }) => {
  await page.goto('/project/test-project-id/export');

  // 1. Upload file
  await page.locator('[data-testid="upload-zone"]').click();
  await page.locator('input[type="file"]').setInputFiles('./fixtures/test.mp3');

  // 2. Wait for file in list
  await expect(page.locator('[data-testid="file-item"]')).toBeVisible();

  // 3. Click Master
  await page.click('button:has-text("Master All")');

  // 4. Wait for mastered status
  await expect(page.locator('[data-testid="file-item"]:has-text("Mastered")')).toBeVisible({ timeout: 120000 });
});
```

---

## Phase 2: Batch Mastering

### Feature 2.1: Multi-File Upload

**Backend Integration Test Requirements:**
```javascript
test('uploads multiple files', async () => {
  const form = new FormData();
  form.append('files', fs.createReadStream('./fixtures/track1.mp3'), 'track1.mp3');
  form.append('files', fs.createReadStream('./fixtures/track2.mp3'), 'track2.mp3');
  form.append('files', fs.createReadStream('./fixtures/track3.mp3'), 'track3.mp3');

  const res = await fetch(`/api/mastering/upload/${projectId}`, {
    method: 'POST',
    body: form
  });

  const { files } = await res.json();
  assert.strictEqual(files.length, 3);
  files.forEach(f => assert.ok(f.id && f.filename && f.originalPath));
});
```

**Frontend E2E Test Requirements:**
```typescript
test('uploads multiple files via UI', async ({ page }) => {
  await page.goto('/project/test-project-id/export');

  // 1. Upload 3 files
  await page.locator('input[type="file"]').setInputFiles([
    './fixtures/track1.mp3',
    './fixtures/track2.mp3',
    './fixtures/track3.mp3'
  ]);

  // 2. Verify 3 items in list
  await expect(page.locator('[data-testid="file-item"]')).toHaveCount(3, { timeout: 10000 });
});
```

### Feature 2.2: Batch Processing

**Backend Integration Test Requirements:**
```javascript
test('batch processes multiple files', async () => {
  // Upload 3 files
  const { fileIds } = await uploadMultipleFiles(3);

  // Batch process all
  const res = await fetch('/api/mastering/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, projectId, preset: 'spotify', saveToProject: false })
  });

  const { results, errors } = await res.json();
  assert.strictEqual(results.length, 3);
  assert.strictEqual(errors.length, 0);
  results.forEach(r => assert.ok(fs.existsSync(r.masteredPath)));
});
```

**Frontend E2E Test Requirements:**
```typescript
test('batch master via UI', async ({ page }) => {
  await page.goto('/project/test-project-id/export');

  // Upload 3 files
  await uploadThreeFiles(page);

  // Click Master All
  await page.click('button:has-text("Master All")');

  // Wait all 3 to show Mastered
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('[data-testid="file-item"]');
    return items.length >= 3 && Array.from(items).every(i => i.textContent.includes('Mastered'));
  }, { timeout: 300000 }); // 3 files × ~30s each = 90s + buffer
});
```

### Feature 2.3: Selection and Save to Music

**Backend Integration Test Requirements:**
```javascript
test('saves mastered files to music history', async () => {
  // Upload, process
  const { fileIds } = await uploadAndProcess(2);

  // Save to music
  const saveRes = await fetch('/api/mastering/save-to-music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, fileIds })
  });

  const { saved } = await saveRes.json();
  assert.strictEqual(saved.length, 2);
  saved.forEach(s => assert.ok(s.musicId && s.version));

  // Verify via API
  const musicRes = await fetch(`/api/projects/${projectId}/music`);
  const musicList = await musicRes.json();
  assert.strictEqual(musicList.length, 2);
});
```

**Frontend E2E Test Requirements:**
```typescript
test('select files and save to music', async ({ page }) => {
  await page.goto('/project/test-project-id/export');

  // Setup: upload and master 3 files
  await uploadAndMasterThreeFiles(page);

  // Select 2 files
  await page.locator('[data-testid="file-item"]').first().click();
  await page.locator('[data-testid="file-item"]').nth(1).click();

  // Verify selection count
  await expect(page.locator('text="2 selected"')).toBeVisible();

  // Save to Music
  await page.click('button:has-text("Save to Music")');

  // Verify success feedback
  await expect(page.locator('text="Saved to Music"')).toBeVisible({ timeout: 10000 });
});
```

### Feature 2.4: ZIP Download

**Backend Integration Test Requirements:**
```javascript
test('creates ZIP of mastered files', async () => {
  const { fileIds } = await uploadAndProcess(2);

  const zipRes = await fetch(`/api/mastering/zip?projectId=${projectId}&fileIds=${fileIds.join(',')}`);

  assert.strictEqual(zipRes.status, 200);
  assert.ok(zipRes.headers.get('content-type').includes('zip'));

  // Verify ZIP is valid
  const buffer = await zipRes.arrayBuffer();
  const zip = new AdmZip(Buffer.from(buffer));
  const entries = zip.getEntries();
  assert.ok(entries.length >= 2);
});
```

**Frontend E2E Test Requirements:**
```typescript
test('download ZIP via UI', async ({ page }) => {
  await page.goto('/project/test-project-id/export');

  // Setup files
  await uploadAndMasterThreeFiles(page);

  // Select 2 files
  await page.locator('[data-testid="file-item"]').first().click();
  await page.locator('[data-testid="file-item"]').nth(1).click();

  // Download ZIP
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Download ZIP")')
  ]);

  assert.ok(download.suggestedFilename().endsWith('.zip'));
  const path = await download.path();
  assert.ok(fs.existsSync(path));
});
```

---

## Phase 2: Player Polish (Waveform)

### Feature 2.5: Real Waveform Display

**Backend Integration Test Requirements:**
```javascript
test('serves audio file for waveform', async () => {
  const { fileId } = await uploadAndProcess(projectId);

  const audioRes = await fetch(`/api/mastering/${fileId}/file/${projectId}`);

  assert.strictEqual(audioRes.status, 200);
  assert.ok(audioRes.headers.get('content-type').startsWith('audio/'));
});
```

**Frontend E2E Test Requirements:**
```typescript
test('displays waveform for mastered audio', async ({ page }) => {
  await page.goto('/project/test-project-id/export');

  // Upload and master file
  await uploadAndMasterSingleFile(page);

  // Click on file to select
  await page.locator('[data-testid="file-item"]').click();

  // Verify waveform renders (canvas or SVG)
  await expect(page.locator('[data-testid="waveform-display"] canvas, [data-testid="waveform-display"] svg')).toBeVisible({ timeout: 10000 });
});
```

---

## Verification Commands

```bash
# Run all backend integration tests
cd backend && npm test

# Run all frontend E2E tests
cd frontend && npx playwright test

# Run specific feature tests
cd backend && node --test tests/integration/lyrics.e2e.test.js
cd frontend && npx playwright test tests/e2e/lyrics.spec.ts
```

---

## Test Fixtures Required

| Fixture | Location | Purpose |
|---------|----------|---------|
| `test-audio.mp3` | `backend/tests/fixtures/` | Short MP3 for upload tests |
| `test-audio.wav` | `backend/tests/fixtures/` | WAV format test |
| `test-lyrics.txt` | `backend/tests/fixtures/` | Sample lyrics text |

---

## Anti-Patterns (What NOT To Do)

### ❌ Never Mock API in E2E Tests
```typescript
// WRONG - hides API contract bugs
page.route('/api/mastering/upload*', route => route.fulfill({ body: JSON.stringify({ files: [] }) }));
```

### ❌ Never Test Frontend Without Real Backend
```typescript
// WRONG - doesn't verify API contract
const mockHandler = http.mock<NextRequest>();
```

### ❌ Never Skip E2E Because "Backend Tests Cover It"
```typescript
// WRONG - backend tests don't verify UI integration
// Backend test: fetch('/api/...') works ✓
// Frontend test: mocked response ✓
// Reality: UI might send wrong field name, miss headers, etc.
```

---

## CI Enforcement

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. **Backend tests** - Real API, real files, no mocks
2. **Frontend build** - Verifies TypeScript compiles
3. **Frontend E2E** - Real browser, against localhost API

Both must pass for PR to merge.

---

## Implementation Checklist

For each feature, ensure:

- [ ] Backend integration test exists and passes
- [ ] Frontend E2E test exists and passes
- [ ] Tests call real APIs (no mocks)
- [ ] Tests verify actual file I/O
- [ ] CI workflow includes the tests
