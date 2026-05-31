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
- `docs/superpowers/plans/2026-05-20-player-overhaul-plan.md` — Player overhaul (drag-seek, loop/shuffle, keyboard shortcuts, mute, Up Next queue)
- `docs/superpowers/plans/2026-05-20-sounds-tab-polish-plan.md` — SoundsTab polish (artwork thumbnails, search/sort, track count header)
- `docs/superpowers/plans/2026-05-20-discovery-navigation-plan.md` — Global search (Cmd+K), animated playlist indicator, sidebar search button

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
│   │   ├── LeftSidebar.tsx       # Projects (search, ⋯ menu, timestamps) + Playlists + search button
│   │   ├── Titlebar.tsx          # Top bar with project name and mock mode badge
│   │   ├── GlobalSearch.tsx      # Cmd+K global search modal (tracks, playlists, projects)
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
- `isLooping`, `isShuffled`, `toggleLoop`, `toggleShuffle`
- `activeTab`, `setActiveTab`
- `isMockMode`

**App flow:**
```
App.tsx (hash router)
 ├── #/           → StudioV4 (full-viewport DAW)
 │    ├── Titlebar (breadcrumb: Project › name, green Ready dot)
 │    ├── LeftSidebar (search button ⌘K, projects, playlists with pulsing dot when playing)
 │    │    ├── Projects: search, ⋯ (Rename/Delete), timestamps, Recent/Earlier groups
 │    │    └── Playlists: collapsible, per-playlist expand shows tracks (lazy fetch)
 │    ├── CentreWorkspace (TabBar + tab content)
 │    │    ├── ♪ SOUNDS — TrackRow list with artwork thumbnails; search + sort controls;
│    │    │   track count + total duration header; ✎ = TrackEditPanel; ⋯ = Play/Write/Craft/Master/Export/Delete
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
 │    ├── PlayerBar
 │    │    ├── Track artwork thumbnail (46×46, shows if artwork_url set, else SVG icon)
 │    │    ├── Marquee title (dblclick to rename)
 │    │    ├── Shuffle + Prev / Play-Pause / Next + Loop transport controls
 │    │    ├── Scrubber with drag-to-seek (dragProgress state, document-level mouse tracking)
 │    │    ├── Volume slider + mute toggle button (pre-mute volume restore)
 │    │    └── Up Next queue popover (Up Next / Shuffle Queue, plays from queue)
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

## Mobile / Responsive Layout

The DAW is fully responsive — desktop shows the 3-column layout, mobile (≤768px) shows a Spotify/Apple Music style single-panel app. Same URL, same endpoints; layout switches via `useMobile()` hook.

- `frontend/src/hooks/useMobile.ts` — `useMobile(breakpoint=768)` returns true on small screens (matchMedia)
- `frontend/src/components/v4/layout/AppShell.tsx` — branches: desktop grid vs mobile single-panel. Contains `MobileMiniPlayer` (always-visible bottom strip with artwork/title/play + progress)
- `frontend/src/components/v4/mobile/MobileNav.tsx` — bottom tab bar: Library / Sounds / Studio / Details / More
- `frontend/src/components/v4/mobile/MobilePlayerFull.tsx` — full-screen player overlay (tap mini player to open): big artwork, drag/touch scrubber, transport, shuffle/loop, volume
- **Mobile sections** map to panels: Library→sidebar, Sounds/Studio→centre workspace, Details→right panel, More→links (History/Viral/Settings)
- `Titlebar.tsx` and `TabBar.tsx` collapse/adapt at ≤768px (logo + project name only; tab bar scrolls horizontally)
- `index.html` — viewport `viewport-fit=cover`, `apple-mobile-web-app-capable`, `100dvh` heights, touch-friendly range inputs, safe-area insets

## YouTube Import (yt-dlp)

- `backend/src/modules/downloader/downloader.service.js` — yt-dlp wrapper. Uses `--extractor-args youtube:player-client=tv_embedded,android,ios,mweb,web` to bypass server-IP auth blocks on Railway. Age-restricted/premium videos still need cookies.
- `backend/Dockerfile` installs `yt-dlp` via `pip3 install --break-system-packages` + `ffmpeg` via apk
- **Status polling fallback** (`download.controller.js`): in-memory `downloadStatus` Map + `GET /api/downloader/status/:downloadId`. Frontend (`YoutubeDownloader.tsx`) polls every 2s AND listens to WebSocket — polling ensures progress/completion works even when WS events don't reach the browser on cloud.
- Downloaded MP3 → temp dir → uploaded to R2 + saved to local disk → R2 key stored in DB (plays on both local and cloud)

## Deployment Architecture (Production)

### URLs
- **Frontend (Vercel):** `https://frontend-orpin-two-47.vercel.app`
- **Backend (Railway):** `https://redinside-music-studio-production.up.railway.app`
- **Database:** Turso cloud — `libsql://redinside-music-studi-redinside.aws-us-east-1.turso.io`
- **File Storage:** Railway S3 bucket — `redinside-storage-iec2vak` at `https://t3.storageapi.dev`

### Sync Architecture
Local dev and cloud production share the SAME data:
- **DB:** Both local and Railway connect to Turso cloud DB
- **Files:** Both use Railway S3 (R2-compatible) bucket — `STORAGE_DRIVER=r2`
- **Auth:** Cloud enforces Clerk JWT; local uses `DEV_USER_ID=dev-user` fallback (no login needed)
- **user_id:** All projects use `dev-user` as owner (single-user studio, no per-user filtering)

### Railway Deployment
- **Auto-deploy:** Every `git push origin main` triggers Railway rebuild via GitHub webhook
- **Force deploy (no login needed):** `bash scripts/railway-deploy.sh`
- **Permanent token:** `ba3a01ed-9279-4925-b3dc-5444c2eaee12` (stored in `config/.env` as `RAILWAY_TOKEN`)
- **Build time:** ~4 min (includes yt-dlp install via pip)
- **Service ID:** `ac1d7490-87f1-40ad-b51c-2c38fa0ff608`
- **Project ID:** `e4ebb35d-aaa2-4449-9090-650e61a3659c`

### Vercel Deployment
- **Auto-deploy:** NOT connected to GitHub — must run `npx vercel --prod --yes` from `frontend/` directory
- **Env vars set:** `VITE_API_BASE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`
- **fetch interceptor** in `frontend/src/main.tsx` rewrites all `/api/` calls to Railway URL + adds Clerk JWT

### Frontend Cloud Routing (Critical)
`frontend/src/main.tsx` patches `window.fetch` to:
1. Rewrite `fetch('/api/...')` → `fetch('https://...railway.app/api/...')`
2. Inject Clerk JWT from `window.Clerk.session.getToken()` into Authorization header
3. MutationObserver patches `<img src="/api/...">` and `<audio src="/api/...">` elements

`frontend/src/contexts/WorkspaceContext.tsx`:
- `authFetch` uses `API_BASE` prefix for all relative URLs
- `prefixApiUrls()` transforms `artwork_url` from Turso to full URLs
- Audio `new Audio(...)` uses `${API_BASE}/api/music/:id/file`

### Backend Auth (Railway)
- Clerk auth enforced in production via `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- **EXEMPT from auth** (used by `<audio>`/`<img>` elements that can't send JWT):
  - `GET /api/music/:id/file` and `/api/music/:id/download`
  - `GET /api/projects/:id/artwork/*`
- All other `/api/` routes require valid Clerk JWT

### Restore Deleted Project
If a project is accidentally deleted from Turso, restore from local SQLite backup:
```bash
cd backend && node migrate-to-turso.mjs   # restores from database/music-studio.sqlite
```
Local SQLite at `database/music-studio.sqlite` is the source of truth backup (never deleted).

### Config Files
- `config/.env` — all secrets (Turso, R2, Clerk, Railway token) — git-ignored
- `scripts/railway-deploy.sh` — force Railway deploy without login
- `scripts/setup-cloud-storage.sh` — initial R2 bucket setup (one-time)

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
- **PlayerBar keyboard shortcuts** — Space (play/pause), ←/→ (seek ±5%), M (mute), N (next), P (prev). Guard: skips INPUT/TEXTAREA targets.
- **PlayerBar drag-to-seek** — mousedown on scrubber starts drag, document mousemove/mouseup track position, visual shows dragProgress fraction while dragging, seekTo called on mouseup.
- **Player auto-advance** — when track ends, `playNextRef.current()` is called from the `ended` listener. Uses refs (`isLoopingRef`, `isShuffledRef`, `playNextRef`) to avoid stale closure — toggling loop/shuffle mid-song takes effect immediately. Loop on = restart same track; loop off + last track = stop; shuffle = random next.
- **playTrack syncs selectedTrack** — every call to `playTrack` (manual, Next button, auto-advance, shuffle) also calls `setSelectedTrack` so the Sounds tab highlight always matches the playing track.
- **Global search (⌘K)** — searches tracks/playlists/projects; keyboard navigation (↑↓ to cursor, Enter to select/open, Esc to close). Opens from sidebar search button or global Cmd+K shortcut.
- **Playlist sidebar dot** — tracks in sidebar playlists show pulsing red dot (rds-pulse keyframe) when playing; click plays and selects.
- **Project delete (LeftSidebar)** — ⋯ menu → Delete swaps the project row to an inline confirmation strip (slide-in animation, red left border). Shows `Delete "name"?` with full name in `title` tooltip. Cancel restores row; Delete calls `deleteProject`. No browser `confirm()` dialog.
- **RightPanel delete** — Quick Actions grid includes ✕ Delete (red), confirms before calling DELETE /api/music/:id.
- **V4Tab type**: `'sounds' | 'write' | 'album' | 'craft' | 'release'` — note `album` not `create`.
