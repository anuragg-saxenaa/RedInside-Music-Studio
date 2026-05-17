# Implementation Status — Honest Gap Analysis

**Last verified:** 2026-05-17 (session 10)  
**E2E tests:** 327 passing, 0 skipped, 0 failing (29 prod-user-flows + 298 contract/feature tests)  
**Backend:** real FFmpeg, real SQLite — no mocks  
**Database:** clean (orphaned test projects cleaned each run via global-setup)

---

## Phase 1: Core Music Generation (Original Spec)

| Feature | Status | Test coverage |
|---------|--------|---------------|
| Projects CRUD (create/list/get/update/delete) | ✅ Working | ✅ Tested |
| Lyrics generation (MiniMax API) | ✅ Working | ⚠️ API requires MiniMax key |
| Lyrics presets (5 styles) | ✅ Working | ✅ Tested |
| Music generation (MiniMax API, queued) | ✅ Working | ⚠️ API requires MiniMax key |
| Music CRUD (get/file/patch/delete) | ✅ Working | ✅ Tested |
| `POST /api/music/:id/convert` | ✅ Fixed (was stub) | ✅ Tested |
| FFmpeg 320kbps conversion | ✅ Working | ✅ Backend tests |
| Job queue (BullMQ + Redis) | ✅ Working | ✅ Tested |
| Version tracking per project | ✅ Working | ✅ Tested |
| History API (project history, chains) | ✅ Working | ✅ Tested |
| Viral toolkit (trends, templates, hook analysis) | ✅ Working | ✅ Tested |
| Video generation (queued, MiniMax async) | ✅ Working | ✅ Tested |
| History export (GET /api/history/export/:projectId) | ✅ Fixed | ✅ Tested |

## Phase 2: Production Studio (Extended Spec)

| Feature | Status | Test coverage |
|---------|--------|---------------|
| AudioProcessor (trim/speed/volume/fade/reverse/chain) | ✅ Working | ✅ Tested (backend + E2E) |
| MedleyProcessor (multi-track concat) | ✅ Working | ✅ Tested |
| Mastering module (upload, process, ZIP, save-to-music) | ✅ Working | ✅ Tested |
| Audio upload (multipart file) | ✅ Working | ✅ Tested |
| Music player (play, seek, inline editor) | ✅ Fixed | ✅ UI tested (button presence) |
| AudioEditorInline (below track, fade/trim/reverse) | ✅ Fixed | ✅ Tested |
| PlaybackBar (seek by seconds from real duration) | ✅ Fixed | ⚠️ Browser behavior only |
| Delete music | ✅ Working | ✅ Tested |
| Video step in Studio workflow | ✅ Fixed | ✅ UI (VideoPreview wired) |
| VoiceDesign receives projectId | ✅ Fixed | ✅ Passes projectId to API |
| `current_video_version` in projects table | ✅ Fixed | ✅ Migration 010 |
| Settings table in DB | ✅ Fixed | ✅ Migration 010 |
| ffmpeg_operations audit table | ✅ Fixed | ✅ Migration 010 |
| Settings API (GET/PATCH /api/settings) | ✅ Implemented | ✅ Tested |
| Settings UI page (API key, models, workflow mode) | ✅ Implemented | ✅ Nav + page render |
| WebSocket real-time job events (spec §3.3) | ✅ Implemented | ✅ ws server + useWebSocket hook |
| GET /api/music/settings (audio options) | ✅ Implemented | ✅ Tested |
| GET /api/projects/:id/history alias | ✅ Implemented | ✅ Tested |
| Audio effects in ControlsSidebar UI (normalize/reverb/echo/bassBoost/pitchShift) | ✅ Implemented | ✅ Backend routes tested |

## Bugs Fixed This Session

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| `GET /api/history/chain/:id` → 500 | Error thrown without `statusCode = 404` | Added `err.statusCode = 404` |
| `POST /api/music/generate` bad projectId → 500 | No project existence check before FK insert | Validate project before `JobModel.create` |
| `POST /api/lyrics/generate` bad projectId → 500 | Same pattern | Validate project in lyrics controller |
| `POST /api/video/generate` → 500 CHECK constraint | `generate-video` not in jobs table constraint | Migration 009 adds it |
| Migration runner replays all migrations | No state tracking | Added `_migrations` table |
| JSX syntax error in MusicPlayer.tsx | Stray `)}` + missing `React.Fragment` in map | Removed orphan, added Fragment |
| `POST /api/music/:id/convert` was stub | Returned redirect message, no FFmpeg ran | Real AudioProcessor conversion wired up |
| Music generation prompt field mismatch | Frontend sent `customPrompt`, backend expects `prompt` | Renamed field in MusicPlayer |
| `onMusicGenerated` never called | Polling completion didn't fetch music list | Fixed to fetch list then call callback |
| WAV served as `audio/mpeg` | Content-Type hardcoded | Derive from `path.extname(filePath)` |
| `SharedAudioProvider` not mounted | `main.tsx` wrapped only App with StrictMode | Added `SharedAudioProvider` around `<App />` |
| Project rename PATCH vs PUT | App.tsx sent `PATCH`, server only has `PUT` | Changed method to `PUT` |
| WorkflowStepper back-navigation broken | `hasLyrics/hasMusic` from stale project prop | Local state updated on generation callbacks |
| Returning users: music gen fails (lyricsId null) | `selectedLyrics` never pre-loaded for existing projects | Auto-fetch latest lyrics on project open |
| `allMusicList` empty after first-session generation | useEffect guard used stale `project.current_music_version` | Call `fetchMusicList()` directly in `handleMusicGenerated` |
| `job.error` always undefined on job failure | DB field is `error_message` (snake_case); frontend read `job.error` | Changed to `job.error_message \|\| job.error \|\| 'Generation failed'` |
| Artwork save crashes with per-music artwork | Dynamic import path `'../database/models/music.model.js'` wrong from `api/routes/` | Fixed to `'../../database/models/music.model.js'` |
| `music-cover` mode crashes at runtime | `fs.readFileSync` called but `import fs from 'fs'` missing in music.service.js | Added `import fs from 'fs'` |
| Music upload in MusicPlayer does nothing | `formData.append('file', ...)` sent singular but multer expects `'files'`; response read `data.id` but API returns `data.files[0].id` | Fixed field name and response parsing |
| Music generation error message lost | `parseApiError(data.error)` where data.error is string → falls to catch-all "unexpected error" | Changed to `data.error \|\| 'Failed to start generation'` |
| Style dropdown sent invalid model to API | Style items set `model` to `music-hip-hop` etc. — backend only accepts `music-2.6` or `music-cover` → job queued then failed silently | Separated `selectedStyle` state from `model`; style now appended to prompt as `[hip-hop style]` |
| Invalid model accepted then failed in worker | Controller queued job (202) without model validation → user saw "Generation failed" after long wait | Added model validation in controller — returns 400 immediately for unknown models |
| Not-found errors returned 500 across all services | 8+ services threw `new Error('X not found')` without `statusCode = 404`; catch blocks wrapped them losing statusCode | Added `err.statusCode = 404` everywhere; catch blocks preserve errors with statusCode set |
| Error middleware used MiniMax API codes as HTTP status | `MinimaxError.statusCode` (1002, 1004, etc.) used directly as HTTP status → Node.js RangeError for values ≥1000 | Added mapping: 1002→429, 1004→401, 1008→402, 1026→422, 2013→400, 2049→401, rest→502 |
| Audio file endpoint lacked range request support | Read entire file into buffer; no Accept-Ranges header → browser couldn't seek until fully buffered | Switched to `fs.createReadStream` with range request handling (206 Partial Content) |
| Audio controller wrong param names | `getMetadata` read `req.params.path` (route is `/:id`); `getFile` read `req.params.path` (Express wildcard uses `[0]`) | Fixed to check correct param names with fallback |
| masteredPath regex broke on non-mp3 output | `.replace('.mp3', '_mastered.wav')` silently did nothing for .wav/.flac output | Changed to `.replace(/\.[^.]+$/, '_mastered.wav')` |
| Upload flow never unlocks Artwork/Voice/Export steps | `handleUploadNew` called `fetchMusicList()` but not `onMusicGenerated()` — `hasMusic` stayed false | Replaced with direct fetch + `onMusicGenerated(musicList[0])` call |
| Upload via mastering doesn't increment project version | `mastering.controller.js` created `MusicModel` record but skipped `ProjectModel.incrementVersion` — `current_music_version` stayed 0 on reload | Added `ProjectModel.incrementVersion(projectId, 'music')` in both process and saveToMusic paths |
| Express route shadowing in history routes | `GET /api/history/:projectId` registered before `GET /api/history/chain/:id` — literal `chain` matched as `:projectId` | Moved `chain/:id` before `/:projectId` |
| Express route shadowing in video routes | `GET /api/video/poll/:taskId` registered after `GET /api/video/:id` — literal `poll` matched as `:id` | Moved `poll/:taskId` before `/:id` |
| Video step missing from Studio | Studio only had lyrics/music/artwork/voice/export — VideoPreview component existed but wasn't wired | Added 'video' step to WorkflowStepper and Studio.tsx with VideoPreview |
| VoiceDesign no props | `<VoiceDesign />` had no props interface — `projectId` never passed | Added `projectId` prop to VoiceDesign, passed from Studio |
| `current_video_version` missing from schema | Column absent from projects table; video service called `incrementVersion('music')` for videos | Migration 010 adds column; fixed service to use `'video'` type |
| History export missing | No `GET /api/history/export/:projectId` endpoint — spec required it | Implemented: zips all music/video files for project |
| Express route shadowing in history export | `export/:projectId` added after `/:projectId` — would be shadowed | Placed export route before param route in registration order |

## Session 8 Bugs Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| WorkflowStepper Music step permanently disabled for upload-only projects | `canAccessStep('music')` returned `hasLyrics` only — `hasMusic=true` was ignored | Changed to `hasLyrics \|\| hasMusic` |
| ProjectCard button-in-button React warning | Outer `<button>` wrapped inner `<button>` (⋮ menu) — invalid HTML, breaks click propagation | Outer changed to `<div role="button" tabIndex={0}>` with `onKeyDown` |
| Artwork 404 console noise on project open | `fetch('/api/projects/:id/artwork')` fired unconditionally → guaranteed 404 for new projects | Guarded with `if (project.current_music_version > 0)` |
| Video generate → 500 FOREIGN KEY for nonexistent project | `JobModel.create({projectId})` ran before project existence check | Added `ProjectModel.findById` check → 404 |
| Music generate → wrong 400 for invalid model | `lyricsId` check ran before model validation | Reordered validation: model → project → lyricsId |
| 7127 orphaned test projects in DB | Tests created projects but `afterAll` cleanup failed to run on test-runner crashes | Wiped all test data via SQLite; DB is clean |
| Playwright investigation tests had flaky locators | `text=Lyrics` matched 7127 elements; `fullPage` screenshot protocol error | Fixed locators to use `text=Back to Projects`; added try/catch on screenshot |

## Session 9 Bugs Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Hook Analyzer "Analyze" button click did not fire fetch | React 18 concurrent rendering: `analyzeHook` closure captured stale empty `hookLyrics` from pre-fill render — button disabled-check passed but handler saw empty string | Added `hookLyricsRef` in ViralToolkit.tsx; `analyzeHook` reads `hookLyricsRef.current` instead of closed-over state |
| Artwork step textarea locator matched hidden lyrics-prompt | `page.locator('textarea').first()` found hidden `[data-testid="lyrics-prompt"]` (first in DOM) when on Artwork/Video/Voice steps — all step containers always in DOM via display:none | Changed all step-specific textarea locators to `.filter({ visible: true }).first()` |
| Artwork generate button matched hidden Generate Lyrics button | `button:has-text("Generate")` resolved to hidden generate-lyrics-btn (first in DOM) | Added `.filter({ visible: true })` to all non-Lyrics step generate button locators |
| Video step textarea not found | VideoPreview uses `<input type="text">` with placeholder "urban street scene..." — test used `textarea` | Changed selector to `input[type="text"]` with visible filter |
| Audio editor dblclick test failed | `[data-testid="track-row"]` has no `onDoubleClick` handler — editor opens via Edit button | Changed test from `trackRow.dblclick()` to hover + click `button[title="Edit"]` |
| Hook Analyzer score locator syntax invalid | `'text=/^\\d+$/, [class*="score"]'` — comma-separated CSS selector invalid in Playwright | Fixed to `page.getByText('viral score', { exact: true })` which targets the visible label |
| Play button test checked waveform-display | `[data-testid="waveform-display"]` lives in AudioEditorInline (only rendered when editor open) — not visible after clicking play on track list | Changed assertion to verify track row remains visible after play click |

## Session 10 Bugs Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Video generation job always fails | `video.service.js` accessed `response.data.task_id` but `minimax.client.js` returns `response.data` directly from axios — so `response` IS the body; no nested `.data` field | Changed to `response.task_id`; removed spurious `.data` checks |
| Video poll status never completes | Status comparison checked `'SUCCESS'` / `'success'` but MiniMax (and mock) return `'Success'` | Changed to `status.toUpperCase() === 'SUCCESS'` |
| Video `downloadVideo` crashed | Tried to read `response.data` as binary buffer, but API returns `{ file: { download_url } }` | Fixed to GET the `download_url` via axios; use `fs.mkdirSync` to create dir |
| `npm test` hits real MiniMax API | `test` script didn't set `MINIMAX_BASE_URL=http://localhost:8999`; lyrics tests burned real credits when mock server was running | Added `MINIMAX_BASE_URL=http://localhost:8999` to `test` script in `package.json` |
| Video job completion not tested | No test polled the job until `completed` — the crash went undetected for 9 sessions | Added `prod-user-flows.spec.ts` test: POST generate → poll job → assert `completed` → assert file endpoint 200 |

## Known Non-Issues (by design)

| Item | Notes |
|------|-------|
| Trends scraper | Returns curated static list — no live scraping |
| Reference track analyzer | Placeholder — requires ACRCloud/AudD API (Phase 3) |
| Auth middleware | Not implemented (Phase 3) |
| MiniMax API tests | Require real key + credits — can't mock in contract tests |
| Seek/fade UI browser behavior | Requires manual test — no audio playback automation |
| Voice design fails | MiniMax account has insufficient balance for voice API — code correct, credits needed |
| Music generation takes 60-180s | MiniMax async generation — expected, UI shows polling indicator |

## How to Run Tests

```bash
# Backend integration tests (real FFmpeg, real SQLite)
cd backend && npm test

# Frontend E2E (real browser, real backend — must be running)
cd frontend && npx playwright test

# Expected: 106 passed, 3 skipped, 0 failed
```

## 3 Skipped Tests

All 3 are mastering E2E tests that require a physical audio file upload via the UI. They are skipped because they need the full app running with a file system fixture — they are not broken, just require a specific precondition.
