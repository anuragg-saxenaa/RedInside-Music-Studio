# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of Truth

**Superpowers specs and plans are the authoritative reference for this project.** Always consult before making significant changes:

- `docs/superpowers/specs/2026-05-03-redinside-music-studio-design.md` — Phase 1-3 architecture, API design, DB schema
- `docs/superpowers/plans/2026-05-18-phase4-frontend.md` — Phase 4 StudioV4 DAW redesign plan
- `docs/superpowers/plans/2026-05-18-phase4-backend.md` — Phase 4 backend APIs (playlists, tags, notes, share)
- `docs/superpowers/specs/2026-05-19-phase4-gap-fix-design.md` — Gap audit and fix design
- `docs/superpowers/specs/2026-05-20-track-metadata-album-studio-design.md` — Phase 4.5: per-track metadata, album CRUD, per-song artwork, upload/generate
- `docs/superpowers/plans/2026-05-20-track-metadata-album-studio-plan.md` — Phase 4.5 implementation plan

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
│   │   ├── RightPanel.tsx        # Track card, ArtworkBox (upload/display), editable title, tags, notes, share link
│   │   └── PlayerBar.tsx         # Transport, scrubber, volume, marquee title, rename
│   ├── workspace/
│   │   ├── CentreWorkspace.tsx   # TabBar + active tab router
│   │   ├── TabBar.tsx            # Write / Sounds / Album / Craft / Release tabs
│   │   ├── WriteTab.tsx          # Lyrics editor (wrapped LyricsEditor)
│   │   ├── SoundsTab.tsx         # Track list with TrackRow components
│   │   ├── CraftTab.tsx          # Medley Mixer + A/B Comparator + Voice Design sub-tabs
│   │   ├── AlbumTab.tsx          # Album list + editor: cover art, metadata, drag-reorder tracklist
│   │   └── ReleaseTab.tsx        # ReadinessChecklist + SocialExportPanel + RemixSuggestions + Video
│   ├── tracks/
│   │   ├── TrackRow.tsx          # Single track row with play, status, actions; ✎ opens TrackEditPanel
│   │   ├── TrackEditPanel.tsx    # Inline metadata editor: title/artist/genre/year/BPM/key + artwork generate/upload
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

**Fonts:** Outfit (UI) + DM Sans (fallback) + JetBrains Mono (timestamps/metadata) — loaded in `index.html` via Google Fonts

**WorkspaceContext key exports:**
- `projects`, `activeProjectId`, `setActiveProjectId`, `refreshProjects`
- `tracks`, `selectedTrack`, `setSelectedTrack`, `refreshTracks`
- `playlists`, `refreshPlaylists`
- `playerTrack`, `playerIsPlaying`, `playerProgress`, `playerCurrentTime`, `playerDuration`, `playerVolume`
- `togglePlay`, `seekTo`, `setPlayerVolume`, `playNext`, `playPrev`, `playTrack`
- `activeTab`, `setActiveTab`
- `isMockMode`

**App flow:**
```
App.tsx (hash router)
 ├── #/           → StudioV4 (full-viewport DAW)
 │    ├── Titlebar (breadcrumb: Project › name, green Ready dot)
 │    ├── LeftSidebar
 │    │    ├── Projects: search, ⋯ (Rename/Delete), timestamps, Recent/Earlier groups
 │    │    └── Playlists: collapsible, per-playlist expand shows tracks (lazy fetch)
 │    ├── CentreWorkspace (TabBar + tab content)
 │    │    ├── ♪ SOUNDS — TrackRow list; click row = play+select; ✎ = TrackEditPanel; ⋯ = Play/Write/Craft/Master/Export/Delete
 │    │    ├── ✎ WRITE  — LyricsEditor
 │    │    ├── ◈ ALBUM  — album list, editor (cover art generate, metadata), drag-reorder tracklist
 │    │    ├── ⚙ CRAFT  — AudioEditorPanel + RemixSuggestions (presets wired) + MedleyMixer + Voice Design
 │    │    └── ↗ RELEASE — ReadinessChecklist + SocialExportPanel + AudioMasteringPanel + Video export
 │    ├── RightPanel (track selected)
 │    │    ├── ArtworkBox: per-track artwork, hover → click-to-upload (FileReader → POST /artwork)
 │    │    ├── Editable title (dblclick)
 │    │    ├── BPM/key/duration tags
 │    │    ├── Quick actions: Play / Craft / Master / Export / Delete
 │    │    ├── Share: generate link → copy
 │    │    ├── Playlists: add/remove membership
 │    │    └── Timed notes: add at current playhead position
 │    └── PlayerBar
 │         ├── Track artwork thumbnail (46×46, shows if artwork_url set, else SVG icon)
 │         ├── Marquee title (dblclick to rename)
 │         ├── Prev / Play-Pause / Next controls
 │         ├── Scrubber with drag-to-seek
 │         └── Volume slider
 ├── #/share/:token → ShareView (public, no auth)
 ├── #/history      → History page
 ├── #/viral        → ViralToolkit
 └── #/settings     → Settings
```

**WebSocket:** `useWebSocket` mounted in `StudioV4Inner` — always connected. Sets `window.__studioWs`. Used by `YoutubeDownloader`, `VocalRemovalCard`, `MusicPlayer` for real-time job progress.

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
│   ├── album/
│   │   ├── album.model.js        # albums + album_tracks tables; CRUD helpers
│   │   └── album.controller.js   # REST routes for albums, artwork, tracklist reorder
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
│       ├── 017_project_shares.sql
│       ├── 018_music_metadata.sql  # artist, genre, year, track_number, composer, lyrics_credit, artwork_url
│       ├── 019_albums.sql          # albums table (id, project_id, title, artist, year, genre, label, artwork_path)
│       └── 020_album_tracks.sql    # album_tracks table (album_id, music_id, position)
├── utils/
│   ├── minimax.client.js
│   ├── storage.util.js
│   └── logger.js
└── config/env.config.js
```

### Key API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects |
| PUT | `/api/projects/:id` | Rename project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/music` | List tracks for project |
| PATCH | `/api/music/:id` | Update track title |
| DELETE | `/api/music/:id` | **Delete track** (removes file + DB row) |
| GET | `/api/music/:id/tags` | Get BPM/key tags (lazy analysis) |
| GET | `/api/music/:id/notes` | Get timed notes |
| POST | `/api/music/:id/notes` | Add timed note |
| DELETE | `/api/music/:id/notes/:noteId` | Delete note |
| GET | `/api/playlists` | List all playlists (with track_count) |
| POST | `/api/playlists` | Create playlist |
| DELETE | `/api/playlists/:id` | Delete playlist |
| GET | `/api/playlists/:id/tracks` | List tracks in playlist |
| POST | `/api/playlists/:id/tracks` | Add track to playlist |
| DELETE | `/api/playlists/:id/tracks/:musicId` | Remove track from playlist |
| POST | `/api/projects/:id/share` | Generate share token |
| GET | `/api/share/:token` | Resolve share token → project + tracks |
| GET | `/api/projects/:id/artwork/:musicId` | Serve per-track artwork PNG |
| POST | `/api/projects/:id/artwork` | Save per-track artwork `{ musicId, imageUrl }` (data URI) |
| POST | `/api/projects/:id/artwork/fetch-image` | Fetch remote image → return `{ imageData }` base64 data URI |
| GET | `/api/projects/:id/albums` | List albums for project |
| POST | `/api/projects/:id/albums` | Create album `{ title, artist, year, genre, label }` |
| PATCH | `/api/projects/:id/albums/:albumId` | Update album metadata |
| DELETE | `/api/projects/:id/albums/:albumId` | Delete album |
| GET | `/api/projects/:id/albums/:albumId/tracks` | List tracks in album (ordered by position) |
| POST | `/api/projects/:id/albums/:albumId/tracks` | Add track `{ musicId }` |
| DELETE | `/api/projects/:id/albums/:albumId/tracks/:musicId` | Remove track from album |
| PATCH | `/api/projects/:id/albums/:albumId/tracks/reorder` | Reorder `{ orderedIds: string[] }` |
| POST | `/api/projects/:id/albums/:albumId/artwork` | Save album cover `{ imageData }` (data URI) |
| GET | `/api/projects/:id/albums/:albumId/artwork` | Serve album cover PNG |
| POST | `/api/downloader/youtube` | Start YouTube import (returns downloadId, progress via WS) |
| POST | `/api/audio/social-export` | Export track as MP3 for social preset |

### Data Model
- **SQLite** at `database/music-studio.sqlite`
- **File storage** at `storage/projects/{project-id}/generations/{lyrics|music|video}/`
- **Artwork storage** at `storage/projects/{project-id}/artwork/music-{musicId}.png` (per-track) and `storage/projects/{project-id}/artwork/album-{albumId}.png` (album cover)
- **Version tracking**: Each generation tracks versions per project (v1, v2, ...)

**MusicGeneration fields** (relevant subset): `id`, `project_id`, `title`, `artist`, `genre`, `year`, `track_number`, `composer`, `lyrics_credit`, `artwork_url` (non-null if artwork exists), `bpm` (auto-analysed), `key_signature` (auto-analysed)

**Album type:**
```ts
interface Album {
  id: string;           // uuid v4
  project_id: string;
  title: string | null;
  artist: string | null;
  year: number | null;
  genre: string | null;
  label: string | null;
  artwork_path: string | null;
  created_at: string;
}
```

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
| `v4-create.spec.ts` | Album tab: create album, see editor |
| `v4-album.spec.ts` | Album CRUD, track inline edit (TrackEditPanel) |
| `v4-release.spec.ts` | ReadinessChecklist, SocialExport |
| `v4-share.spec.ts` | Share token, ShareView page |

Legacy tests (pre-Phase 4) archived in `frontend/tests/e2e/legacy/` — excluded from Playwright run.

## Key Files
- `backend/src/server.js` — Express entry, registers all routes
- `frontend/src/App.tsx` — Hash router (studio → StudioV4, legacy pages)
- `frontend/src/pages/StudioV4.tsx` — DAW root; mounts `useWebSocket` at app level
- `frontend/src/contexts/WorkspaceContext.tsx` — All UI state + player state
- `frontend/src/components/v4/shared/colors.ts` — Color tokens (C.red, C.gold, C.border, …)
- `frontend/src/hooks/useWebSocket.ts` — WS hook; sets `window.__studioWs` on connect
- `frontend/index.html` — Google Fonts (Outfit, DM Sans, JetBrains Mono) + scrollbar styles
- `backend/src/modules/downloader/downloader.service.js` — yt-dlp wrapper (--concurrent-fragments 4)
- `storage/` — Git-ignored, generated content
- `config/.env` — API keys (git-ignored)

## Known Behaviours / Gotchas
- **YouTube import progress** requires `useWebSocket` to be mounted (it's in `StudioV4Inner`). `YoutubeDownloader` reads `window.__studioWs` directly via `addEventListener`.
- **yt-dlp** speed: uses `--concurrent-fragments 4` for parallel chunk download. Long videos (>5 min) can still take 1-3 min. Progress updates arrive via WebSocket.
- **Playlist track list in sidebar** is fetched lazily on first expand and re-fetched on every `refreshPlaylists` call (so adding from RightPanel reflects immediately).
- **TrackRow click** = play + select. ✎ button opens `TrackEditPanel` inline. `⋯` menu has Play / Write / Craft / Master / Export / Delete.
- **TrackEditPanel** — inline panel below TrackRow. Artwork generate: POST `/api/image/generate` → POST `.../artwork/fetch-image` → POST `.../artwork` with `{ musicId, imageUrl: fetchData.imageData }`. Lyrics pre-fill: GET `/api/lyrics/:lyricsId` → first 300 chars → artwork prompt.
- **ArtworkBox (RightPanel)** — shows per-track artwork at `/api/projects/:projectId/artwork/:musicId`. Hover reveals upload overlay. Upload: FileReader → readAsDataURL → POST `/api/projects/:projectId/artwork` with `{ musicId, imageUrl: dataURI }`. Calls `refreshTracks()` after upload so PlayerBar thumbnail updates.
- **PlayerBar artwork** — shows `<img>` if `playerTrack.artwork_url` is set, else shows SVG icon. URL is `/api/projects/${playerTrack.project_id}/artwork/${playerTrack.id}` (no cache-busting needed; `artwork_url` column presence is the signal).
- **AlbumTab cover generate** — same 3-step flow as TrackEditPanel. Save call uses `{ imageData }` (not `imageUrl`) for album artwork endpoint.
- **RemixSuggestions** (Craft tab) applies audio operations via `presetOperations` prop on `AudioEditorPanel` — not just cosmetic.
- **PlayerBar rename** — double-click the title in the player bar to inline-rename (same PATCH /api/music/:id call as RightPanel).
- **RightPanel delete** — Quick Actions grid includes ✕ Delete (red), confirms before calling DELETE /api/music/:id.
- **V4Tab type**: `'sounds' | 'write' | 'album' | 'craft' | 'release'` — note `album` not `create`.
