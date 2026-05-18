# Changelog

All notable changes to RedInside Music Studio are documented here.

---

## [Unreleased] — 2026-05-18

### Fixed
- Mock MiniMax server returned `extra_info` inside `data` instead of at top level — `duration_seconds`, `sample_rate`, and `bitrate` were always `undefined` in test runs
- `music.model.findByProject` filtered out records whose `original_file_path` was an HTTP URL (orphan-protection guard called `fs.existsSync` on URLs)
- Seed endpoint (`/api/test/seed-music`) used `process.cwd()` for fixture path — broke when run from directories other than `backend/`
- Test 9.1 (`Music step Generate button`) gave false passes via API fallback; now uses strict `toBeVisible()` on DOM elements
- Workflow step buttons had no stable selectors — `button:has-text("Music")` matched "Generate Music" button in MusicPlayer

### Added
- Yellow "TEST MODE" banner in App.tsx when backend reports `health.minimax === 'mock'` — prevents confusion when Playwright leaves a mock-mode server running
- `data-testid` attributes on key interactive elements: `generate-music-btn`, `download-btn`, `delete-btn`, `audio-editor-panel`, `playback-bar`, `compact-player`, `step-{lyrics,music,artwork,video,voice,medley,export}`
- Medley workflow step wired into Studio (7th step between Voice and Export)
- `dump.rdb` added to `.gitignore`

### Changed
- All workflow steps are now always accessible (removed lyrics/music precondition gating from `canAccessStep`)
- Playwright config auto-starts mock MiniMax server (port 8999) and mock-mode backend — `npx playwright test` works with zero manual setup
- `global-setup.ts` blocks test run if backend is connected to real MiniMax API

---

## [0.9.0] — 2026-05-17

### Fixed
- `GET /api/history/chain/:id` returned 404 when passed the chain's own ID (only resolved by generation ID)
- `GET /api/projects/:id/medleys` route was missing despite `MedleyModel.findByProject` being implemented
- `duration_seconds` null on all music records — mock server used field name `duration` instead of `music_duration`; added `ffprobe` fallback for real API calls

---

## [0.8.0] — 2026-05-14

### Fixed
- `POST /api/medley` returned 500 FOREIGN KEY error — no project existence check before insert
- Medley controller hardcoded `res.status(500)`, swallowing 404 status codes from service layer
- 11 TypeScript build errors (TS6133 unused variables in 4 files)
- Mastering panel showed hardcoded "3:24" duration — `formatDuration()` was defined but never wired to render
- Remove file button in mastering panel existed in code but not in UI
- "Select All" and mastered count stats not rendered
- ZIP test failed after JSZip empty-check fix — test tried to ZIP unmastered files

### Added
- `POST /api/medley/:id/export` content-type detection from filename (was always `audio/mpeg`)

---

## [0.7.0] — 2026-05-12

### Added
- Batch mastering panel (upload multiple files, master to Spotify standard, download ZIP or save to Music library)
- ZIP download of mastered files using JSZip + archiver
- `POST /api/mastering/save-to-music` — moves mastered file into project music library

### Fixed
- Mastering ZIP returned empty archive for non-empty selections (JSZip `generateAsync` null check missing)

---

## [0.6.0] — 2026-05-10

### Added
- Medley mixer: create, add tracks, reorder (drag-order), remove, export to merged audio file
- `MedleyPanel.tsx` frontend component
- Medley API: POST/GET/PUT/DELETE `/api/medley`, `/api/medley/:id/tracks`, `/api/medley/:id/export`
- Generation chain linking — lyrics → music → video automatically linked in history

### Fixed
- Medley export path collision when two projects had tracks with identical filenames
- `generation_chains` table not populated — `HistoryService.linkGeneration` never called from controllers

---

## [0.5.0] — 2026-05-08

### Added
- Spotify-standard auto-mastering on music generation (−14 LUFS, −1 dBTP, configurable via `auto_ffmpeg_320kbps` setting)
- `AudioMasteringService.masterToSpotify()` using FFmpeg `loudnorm` filter
- Settings page: API key, default music model, auto-mastering toggle
- Settings persistence in SQLite (`settings` table, `GET/PATCH /api/settings`)
- WebSocket server (`ws://localhost:3000`) with `useWebSocket` hook — real-time `job.started`, `job.completed`, `job.failed` events
- `GET /api/music/settings` — available audio settings options
- `GET /api/projects/:id/history` alias route
- Per-track artwork: artwork saved per `music_id`, loaded when entering artwork step

---

## [0.4.0] — 2026-05-07

### Added
- Voice design and cloning (`POST /api/voice/design`, `POST /api/voice/clone`)
- Image generation (`POST /api/image/generate`)
- Audio file upload (`POST /api/upload/audio`, `POST /api/upload/url`)
- Viral Toolkit: trending topics, hook analysis, structure templates, reference track analysis
- History browser UI page
- Viral Toolkit UI page
- AudioEditor inline panel (trim, speed, volume, fade in/out, reverse)
- Audio effects: normalize, reverb, echo, bass boost, pitch shift
- Audio effects chain via `POST /api/audio/process`

### Fixed
- Video generation: poll loop never cleared `setInterval` on completion
- Video step wired into Studio workflow
- `current_video_version` column missing from projects schema
- `ffmpeg_operations` audit table missing from schema

---

## [0.3.0] — 2026-05-06

### Added
- Music generation via URL format (`output_format: 'url'`) — prevents timeout on songs > 30s
- Compact persistent player bar below Studio view
- Seek-by-seconds in PlaybackBar using `duration_seconds` from API
- HTTP range request support on `/api/music/:id/file` for audio seeking in browser
- `POST /api/music/:id/convert` endpoint (320kbps FFmpeg conversion)
- Music cover / voice transfer via two-step preprocess → generate flow
- Video generation module (MiniMax async, poll via `/v1/query/video_generation`)

### Fixed
- FFmpeg version parsing returned NaN — switched from `split('-').pop()` to `/^v(\d+)/` regex
- Error middleware used MiniMax status codes (1002, 1004) as HTTP status codes
- Route ordering — literal paths shadowed by param routes (e.g. `/api/lyrics/presets` matched `:id`)
- Audio seeking broke at end of track (off-by-one in seek range)

---

## [0.2.0] — 2026-05-05

### Added
- Spotify-style music player UI (track list, waveform progress, keyboard shortcuts)
- Production Studio dark theme design system
- Architecture flow documentation
- Full API endpoint documentation

### Fixed
- Storage path traversal vulnerability in `storage.util.js`
- Upload flow now unlocks downstream workflow steps

---

## [0.1.0] — 2026-05-03

### Added
- Initial project scaffold: backend (Node/Express/SQLite/BullMQ) + frontend (React/TypeScript/Vite)
- Projects CRUD
- Lyrics generation with 5 style presets (Hinglish Urban, Punjabi Swagger, Hindi-Urdu Classical, Regional Fusion, Custom)
- Music generation (BullMQ queued, MiniMax `music-2.6`)
- FFmpeg 320kbps MP3 conversion
- Job queue with Redis/BullMQ workers
- Version tracking per project
- History API (generation chains, version diff, replay)
- Docker Compose setup
- MiniMax API client with error code mapping (1002 rate limit, 1004 auth, 1008 balance, etc.)
