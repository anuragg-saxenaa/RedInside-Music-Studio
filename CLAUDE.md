# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of Truth

**Superpowers specs and plans are the authoritative reference for this project.** Always consult these before making significant changes:

- `docs/superpowers/specs/2026-05-03-redinside-music-studio-design.md` - Architecture, module specs, API design, database schema
- `docs/superpowers/plans/2026-05-03-redinside-music-studio-phase1-mvp.md` - Implementation plan with tasks and TDD steps

## Project Overview

RedInside Music Studio - self-hosted desi hip-hop music creation platform using MiniMax AI APIs. Complete workflow: lyrics → music → video generation with FFmpeg audio processing.

## Commands

### Backend Development
```bash
cd backend
npm run dev          # Watch mode with auto-reload
npm start            # Production start
npm test             # Run all tests (node --test)
npm run db:migrate   # Initialize SQLite database
```

### Running Single Test
```bash
node --test tests/modules/lyrics.service.test.js
```

### Database
```bash
cd backend && npm run db:migrate  # Creates tables in database/music-studio.sqlite
```

## Architecture

### Modular Monolith
```
backend/src/
├── modules/          # Feature modules (lyrics, music, video, ffmpeg, history, viral)
│   └── {module}/
│       ├── {module}.service.js    # Business logic
│       ├── {module}.controller.js # HTTP handlers
│       └── presets.js            # Configuration/presets (lyrics only)
├── database/
│   ├── connection.js             # SQLite setup
│   ├── migrate.js                 # Schema creation
│   └── models/                    # Data access (project, lyrics, music model.js)
├── utils/
│   ├── minimax.client.js          # MiniMax API wrapper
│   ├── storage.util.js             # File management with path traversal protection
│   └── logger.js                  # Winston structured logging
└── config/
    └── env.config.js              # Environment validation
```

### Data Model
- **SQLite** database at `database/music-studio.sqlite`
- **File storage** at `storage/projects/{project-id}/generations/{lyrics|music|video}/`
- **Version tracking**: Each generation type tracks versions per project (v1, v2, ...)

### Module Pattern
Each module follows: `Controller → Service → Model/Storage`
- Controller: HTTP request handling, input validation
- Service: Business logic, API calls, data transformation
- Model: Database operations

## Implementation Status

### Completed
- Project setup with dependencies
- Config/logger/environment validation
- Database models and migrations
- MiniMax API client (with error handling for status codes 1002, 1004, 1008, etc.)
- Storage utility (path traversal protection)
- Lyrics module (service, controller, presets)
- Music module (service, controller)
- FFmpeg service (320kbps conversion)
- BullMQ queue system with workers (lyrics, music, ffmpeg)
- API routes (projects, lyrics, music, jobs)
- Middleware (error, validation)
- Express server with CORS and route registration
- React frontend (Studio page, LyricsEditor, MusicPlayer, WorkflowStepper)
- Docker Compose setup
- README documentation

### Not Yet Implemented
- Video module, History module, Viral toolkit
- WebSocket real-time updates
- Auth middleware
- Integration tests
- End-to-end workflow tests

## MiniMax API Integration

Client at `backend/src/utils/minimax.client.js` handles:
- Lyrics: `/v1/lyrics_generation`
- Music: `/v1/music_generation`
- Video: `/v1/video_generation` (async, poll via `/v1/query/video_generation`)
- Files: `/v1/files/retrieve`

Error codes mapped: 0=success, 1002=rate limit, 1004=auth failed, 1008=balance, 1026=sensitive, 2013=invalid params, 2049=invalid key

## Music Generation Notes

- `output_format: 'url'` - MiniMax music API requires URL format to avoid timeout on >30s songs
- `/api/music/:id/file` serves processed 320kbps if available, falls back to original
- Music fields: `original_file_path` (DB/API), `processedFilePath` (JS), `durationSeconds` (API returns ms, display as seconds)
- FFmpeg version parsing: use `/^v(\d+)/` regex on filename, not `split('-').pop()` (returns NaN)

## Infrastructure

- BullMQ requires Redis at localhost:6379 (Docker: redinside-redis container)

## Style Presets (Lyrics)
Located at `backend/src/modules/lyrics/presets.js`:
- `hinglish-urban`: Hindi-English mix, trap/drill
- `hindi-urdu-classical`: Ghazal-inspired, poetic
- `punjabi-swagger`: Bhangra, Sidhu Moose Wala style
- `regional-fusion`: Multi-language (Tamil, Telugu, Bengali + English)
- `custom`: User-defined prompt

## Testing

**CRITICAL: Read `docs/TESTING_GUIDELINES.md` before writing any tests.**

### Golden Rules
- Backend tests MUST call real API endpoints via HTTP (not mocked)
- Frontend E2E tests MUST exercise real browser + real backend
- Never mock API boundaries - this hides integration bugs like `file` vs `files` field name mismatch

### Quick Reference
```bash
# Backend integration tests (real API, real files)
cd backend && npm test

# Frontend E2E tests (real browser, real stack)
cd frontend && npx playwright test

# Both must pass before any commit
```

### What Counts as Real Tests
- Backend `fetch('http://localhost:3000/api/...')` - REAL HTTP ✓
- Playwright clicking UI elements - REAL BROWSER ✓
- `jest.mock()` or `page.route()` - MOCK ✗

### Legacy (Phase 1) Testing Status
Tests listed as passing may use mocks. See `docs/TESTING_GUIDELINES.md` for mandatory practices.

## Key Files
- `backend/src/server.js` - Express app entry point
- `backend/src/database/models/project.model.js` - Project CRUD
- `backend/src/database/models/lyrics.model.js` - Lyrics CRUD
- `storage/` - Git-ignored, contains generated content
- `config/.env` - API keys (git-ignored)
