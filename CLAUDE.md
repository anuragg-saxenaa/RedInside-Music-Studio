# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of Truth

**Superpowers specs and plans are the authoritative reference for this project.** Always consult before making significant changes:

- `docs/superpowers/specs/2026-05-03-redinside-music-studio-design.md` — Phase 1-3 architecture, API design, DB schema
- `docs/superpowers/plans/2026-05-18-phase4-frontend.md` — Phase 4 StudioV4 DAW redesign plan
- `docs/superpowers/plans/2026-05-18-phase4-backend.md` — Phase 4 backend APIs (playlists, tags, notes, share)
- `docs/superpowers/specs/2026-05-19-phase4-gap-fix-design.md` — Gap audit and fix design

## Project Overview

RedInside Music Studio — self-hosted desi hip-hop music creation platform using MiniMax AI APIs. Full workflow: lyrics → music → video generation with FFmpeg audio processing. Frontend is a full-viewport DAW (StudioV4) with sidebar, workspace tabs, right panel, and player bar.

## Commands

### Backend Development
```bash
cd backend
npm run dev          # Watch mode with auto-reload
npm start            # Production start
npm test             # Run all tests (node --test)
npm run db:migrate   # Initialize SQLite database (runs all migrations in order)
```

### Frontend Development
```bash
cd frontend
npm run dev          # Vite dev server at localhost:5173
npm run build        # Production build
npx playwright test  # Run E2E tests
```

### Running Single Test
```bash
# Backend
node --test tests/integration/playlist.test.js

# Frontend E2E
npx playwright test tests/e2e/v4-workspace.spec.ts
```

### Database
```bash
cd backend && npm run db:migrate  # Creates/updates tables in database/music-studio.sqlite
```

## Architecture

### Frontend — StudioV4 DAW Layout

```
frontend/src/
├── pages/
│   ├── StudioV4.tsx              # Root: composes AppShell with all panels
│   └── ShareView.tsx             # Public share page at #/share/:token
├── components/v4/
│   ├── layout/
│   │   ├── AppShell.tsx          # 3-column grid: sidebar / centre / right + player bar
│   │   ├── LeftSidebar.tsx       # Projects (search, ⋯ menu, timestamps) + Playlists
│   │   ├── Titlebar.tsx          # Top bar with project name and mock mode badge
│   │   ├── RightPanel.tsx        # Track card, editable title, tags, notes, share link
│   │   └── PlayerBar.tsx         # Transport, scrubber, volume, marquee title, rename
│   ├── workspace/
│   │   ├── CentreWorkspace.tsx   # TabBar + active tab router
│   │   ├── TabBar.tsx            # Write / Sounds / Craft / Release tabs
│   │   ├── WriteTab.tsx          # Lyrics editor (wrapped LyricsEditor)
│   │   ├── SoundsTab.tsx         # Track list with TrackRow components
│   │   ├── CraftTab.tsx          # Medley Mixer + A/B Comparator sub-tabs
│   │   ├── CreateTab.tsx         # Artwork / Video / Voice generation sections
│   │   └── ReleaseTab.tsx        # ReadinessChecklist + SocialExportPanel + RemixSuggestions
│   ├── tracks/
│   │   ├── TrackRow.tsx          # Single track row with play, status, actions
│   │   └── ABComparator.tsx      # Side-by-side audio comparison widget
│   ├── playlist/
│   │   └── PlaylistSection.tsx   # Playlist panel (add/remove tracks)
│   ├── release/
│   │   ├── ReadinessChecklist.tsx
│   │   └── SocialExportPanel.tsx
│   └── shared/
│       ├── colors.ts             # C.* color tokens (C.red, C.bg, C.border, etc.)
│       ├── GlassPanel.tsx
│       └── RemixSuggestions.tsx
├── contexts/
│   └── WorkspaceContext.tsx      # Global state: projects, tracks, playlists, player, selected track
└── App.tsx                       # Hash router: studio / history / viral / settings / share
```

**AppShell grid:** `gridTemplateColumns: '232px 1fr 268px'` — left sidebar / centre / right panel

**WorkspaceContext key exports:**
- `projects`, `activeProjectId`, `setActiveProjectId`, `refreshProjects`
- `tracks`, `selectedTrack`, `setSelectedTrack`, `refreshTracks`
- `playlists`, `refreshPlaylists`
- `playerTrack`, `playerIsPlaying`, `playerProgress`, `playerCurrentTime`, `playerDuration`, `playerVolume`
- `togglePlay`, `seekTo`, `setPlayerVolume`, `playNext`, `playPrev`, `playTrack`
- `activeTab`, `setActiveTab`

### Backend — Modular Monolith

```
backend/src/
├── modules/
│   ├── lyrics/                   # lyrics.service.js, controller, presets.js
│   ├── music/
│   │   ├── music-tags.service.js # GET /api/music/:id/tags (lazy BPM analysis)
│   │   ├── music-notes.model.js  # CRUD for per-track notes
│   │   └── music-notes.controller.js
│   ├── playlist/
│   │   ├── playlist.model.js     # playlists + playlist_tracks tables
│   │   └── playlist.controller.js
│   ├── share/
│   │   └── share.controller.js   # project_shares — generate/resolve share tokens
│   └── audio/
│       └── social-export.controller.js # stems/mastered export metadata
├── database/
│   ├── connection.js
│   ├── migrate.js                # Runs all SQL files in migrations/ in order
│   └── migrations/
│       ├── 001–012_*.sql         # Phase 1-3 schema
│       ├── 013_playlists.sql
│       ├── 014_music_tags.sql
│       ├── 015_music_notes.sql
│       ├── 016_social_exports.sql
│       └── 017_project_shares.sql
├── utils/
│   ├── minimax.client.js
│   ├── storage.util.js
│   └── logger.js
└── config/env.config.js
```

### Key API Routes (Phase 4 additions)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/playlists` | List all playlists |
| POST | `/api/playlists` | Create playlist |
| DELETE | `/api/playlists/:id` | Delete playlist |
| POST | `/api/playlists/:id/tracks` | Add track to playlist |
| DELETE | `/api/playlists/:id/tracks/:musicId` | Remove track |
| GET | `/api/music/:id/tags` | Get BPM/key tags (lazy) |
| GET | `/api/music/:id/notes` | Get track notes |
| PUT | `/api/music/:id/notes` | Save track notes |
| PATCH | `/api/music/:id` | Update track title |
| POST | `/api/projects/:id/share` | Generate share token |
| GET | `/api/share/:token` | Resolve share token |
| GET | `/api/projects` | List projects |
| PUT | `/api/projects/:id` | Rename project |
| DELETE | `/api/projects/:id` | Delete project |

### Data Model
- **SQLite** at `database/music-studio.sqlite`
- **File storage** at `storage/projects/{project-id}/generations/{lyrics|music|video}/`
- **Version tracking**: Each generation tracks versions per project (v1, v2, ...)

## MiniMax API Integration

Client at `backend/src/utils/minimax.client.js`:
- Lyrics: `/v1/lyrics_generation`
- Music: `/v1/music_generation` — use `output_format: 'url'` (avoids timeout on >30s)
- Video: `/v1/video_generation` (async, poll via `/v1/query/video_generation`)
- Files: `/v1/files/retrieve`

Error codes: 0=success, 1002=rate limit, 1004=auth failed, 1008=balance, 1026=sensitive, 2013=invalid params, 2049=invalid key

FFmpeg version parsing: use `/^v(\d+)/` regex on filename, not `split('-').pop()`.

## Infrastructure

- BullMQ requires Redis at localhost:6379 (Docker: `redinside-redis` container)
- Mock MiniMax server: `backend/tests/minimax-mock-server.js` (port 8999) — use during E2E tests

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
- Never mock API boundaries

### Quick Reference
```bash
# Backend integration tests
cd backend && npm test

# Frontend E2E (auto-starts backend + minimax mock)
cd frontend && npx playwright test

# Single spec
npx playwright test tests/e2e/v4-workspace.spec.ts
```

### E2E Test Files (v4)
All in `frontend/tests/e2e/` — use `POST /api/test/seed-project` for data, `DELETE /api/projects/:id` for cleanup.

| File | Covers |
|------|--------|
| `v4-workspace.spec.ts` | Create project, select, titlebar |
| `v4-sounds.spec.ts` | Track list, play, title edit, tags |
| `v4-playlists.spec.ts` | Create/add/remove playlist tracks |
| `v4-rightpanel.spec.ts` | Track card, notes, share link |
| `v4-craft.spec.ts` | Medley Mixer, A/B Comparator |
| `v4-write.spec.ts` | Write tab, lyrics editor |
| `v4-create.spec.ts` | Artwork/Video/Voice sections |
| `v4-release.spec.ts` | ReadinessChecklist, SocialExport |
| `v4-share.spec.ts` | Share token, ShareView page |

Legacy tests (pre-Phase 4) archived in `frontend/tests/e2e/legacy/` — excluded from Playwright run.

## Key Files
- `backend/src/server.js` — Express entry, registers all routes
- `frontend/src/App.tsx` — Hash router (studio → StudioV4, legacy pages)
- `frontend/src/contexts/WorkspaceContext.tsx` — All UI state
- `frontend/src/components/v4/shared/colors.ts` — Color tokens
- `storage/` — Git-ignored, generated content
- `config/.env` — API keys (git-ignored)
