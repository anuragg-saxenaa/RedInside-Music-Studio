# Testing Guidelines

**MANDATORY: Read before writing tests. No exceptions.**

## The Golden Rule

> **Test the contract, not the mock. Frontend tests must call real backend. Backend tests must verify real behavior.**

## Why This Matters

Bug that slipped through: UploadZone sent `file` field but backend expected `files[]`. Backend tests passed (used correct field). Frontend tests were mocked. Gap = bug in production.

## Testing Layers (in order of importance)

### 1. Backend Integration Tests (REAL)
**Run**: `cd backend && npm test`

Tests MUST:
- Use real file I/O
- Use real FFmpeg
- Call actual HTTP endpoints via `fetch('http://localhost:3000/api/...')`
- NOT mock database, storage, or FFmpeg

```javascript
// ✅ CORRECT - tests actual API
const form = new FormData();
form.append('files', fs.createReadStream(fixture));
const res = await fetch('/api/mastering/upload/project-1', { method: 'POST', body: form });
const data = await res.json();
assert.strictEqual(data.files.length, 1);

// ❌ WRONG - mocks hide bugs
jest.mock('/api/mastering/upload', () => ({ files: [{ id: '1' }] }));
```

### 2. Frontend E2E Tests (REAL Browser)
**Run**: `cd frontend && npx playwright test`

Tests MUST:
- Launch real browser
- Click real UI elements
- Verify actual state changes in browser
- NOT mock API responses

```typescript
// ✅ CORRECT - exercises full stack
await page.locator('[data-testid="upload-zone"]').click();
await page.locator('input[type="file"]').setInputFiles('./fixtures/test.mp3');
await expect(page.locator('[data-testid="file-item"]')).toBeVisible();

// ❌ WRONG - mocked API = no contract verification
page.route('/api/mastering/upload*', route => route.fulfill({ body: '{}' }));
```

### 3. Component Unit Tests (with caveats)
Only use when integration tests are too slow. MUST verify real API behavior somewhere.

```typescript
// If mocking API, ALSO have E2E test that exercises same flow
// Mock lets you test component logic fast
// E2E verifies API contract is correct
```

## Critical: API Contract Testing

Every time you change an API endpoint, you MUST:

1. **Backend test** - verifies endpoint returns correct format
2. **Frontend test** - verifies frontend sends correct format
3. **Integration test** - verifies they talk to each other correctly

The `file` vs `files` bug would have been caught if:
- Frontend component was tested against real backend
- OR a simple "smoke test" verified UploadZone's fetch calls match what backend expects

## Pre-commit Checklist

Before every commit:

- [ ] Backend tests pass: `cd backend && npm test`
- [ ] Frontend builds: `cd frontend && npm run build`
- [ ] New features have integration tests
- [ ] No mocked API calls in E2E tests
- [ ] API request/response formats verified

## What NOT To Do

1. **Don't mock at component boundary** - it hides integration bugs
2. **Don't skip E2E tests** - they're the only way to verify full stack
3. **Don't assume backend/frontend agree** - verify explicitly
4. **Don't let tests pass with mocks** - mocks are for speed, not correctness

## Testing Speed vs. Correctness

| Type | Speed | Correctness | When to Use |
|------|-------|-------------|-------------|
| Unit (mocked) | Fast | Low | Only for pure component logic |
| Integration (real API) | Medium | High | Every API feature |
| E2E (real browser) | Slow | Highest | Critical user flows |

## Adding New API Endpoint

When adding `POST /api/module/action`:

1. **Write backend integration test first**
   ```javascript
   it('handles action correctly', async () => {
     const res = await fetch('/api/module/action', { method: 'POST', body: JSON.stringify({ key: 'value' }) });
     const data = await res.json();
     assert.strictEqual(data.result, 'expected');
   });
   ```

2. **Write frontend API call**
   ```typescript
   const response = await fetch('/api/module/action', { method: 'POST', body: JSON.stringify({ key: 'value' }) });
   ```

3. **Write E2E test that exercises UI → API → UI**
   ```typescript
   test('action via UI', async ({ page }) => {
     await page.click('[data-testid="do-action"]');
     await expect(page.locator('[data-testid="result"]')).toHaveText('expected');
   });
   ```

## Verification Commands

```bash
# Backend (real API, real files)
cd backend && npm test

# Frontend (real browser, real stack)
cd frontend && npx playwright test

# Both must pass before PR
```

## MiniMax API Mock (Avoid Burning Credits)

The real MiniMax API costs credits and has rate limits. Use the built-in mock server for local E2E testing of generate flows:

```bash
# Terminal 1: Start backend pointing to mock (REQUIRED — Playwright will hard-abort if backend uses real API)
cd backend && npm run dev:mock

# Terminal 2: Start frontend
cd frontend && npm run dev

# Terminal 3: Run tests (Playwright auto-starts mock server at port 8999)
cd frontend && npx playwright test
```

> **Note**: `playwright.config.ts` auto-starts `minimax-mock-server.js` at port 8999 before any tests run (`reuseExistingServer: true`). The global setup will **hard abort** the entire test run if backend is connected to the real MiniMax API — protecting your daily credit limits.

The mock server (`backend/tests/minimax-mock-server.js`) returns realistic fake responses for all MiniMax endpoints:
- `POST /v1/lyrics_generation` → returns sample Hindi/English lyrics
- `POST /v1/music_generation` → returns status:2 (complete) with local audio URL
- `POST /v1/video_generation` → returns mock task_id
- All other endpoints → success responses

**When to use mock vs real API:**
- Development & E2E tests → always use mock
- Manual QA of actual music quality → use real API
- CI/CD → use mock (never burn credits in CI)

## The One Rule

**If your test has `mock`, `stub`, `spy`, or `fake` in the request/response path, it's not a real integration test.**

Real integration tests use real HTTP. Everything else is a guess.

**Exception**: MiniMax API mock is acceptable because:
1. It tests the full stack (frontend → backend → mock → backend → frontend)
2. It doesn't test AI model quality (not the point of E2E tests)
3. The backend code path is identical; only the external API response is mocked
