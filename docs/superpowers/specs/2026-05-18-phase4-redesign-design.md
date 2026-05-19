# Phase 4 — Studio Redesign Design Spec

**Date:** 2026-05-18  
**Branch:** `feat/phase4-redesign`  
**Status:** Approved, ready for implementation planning

---

## Goal

Complete UI/UX redesign of RedInside Music Studio. Keep all existing backend APIs and business logic unchanged. Replace the 7-step linear wizard with a DAW-style workspace that is track-centric, visually premium, and organises songs via a playlist system.

---

## Architecture

### Approach

- New `frontend/src/pages/StudioV4.tsx` replaces `Studio.tsx` (old page stays on `main`)
- New `frontend/src/components/v4/` directory for all Phase 4 components
- All existing backend API endpoints consumed as-is — zero backend changes
- Feature branch `feat/phase4-redesign` — migrate to `main` when stable + full E2E pass

### Layout: DAW Workspace (three-column + player bar)

```
┌─────────────────────────────────────────────────────────────┐
│ Titlebar: logo · window controls · mock mode badge · avatar │
├──────────────┬──────────────────────────────┬───────────────┤
│ LEFT SIDEBAR │ CENTRE: 5 tabs               │ RIGHT PANEL   │
│              ├──────────────────────────────┤               │
│ Projects     │ [SOUNDS][WRITE][CREATE]      │ Selected track│
│   └ active   │ [CRAFT][RELEASE]             │   artwork     │
│   └ ...      │                              │   metadata    │
│              │ Tab content area             │   quick acts  │
│ Playlists    │                              │               │
│   └ named    │                              │ In playlists  │
│   └ smart    │                              │               │
│              │                              │               │
│ More         │                              │               │
│   History    │                              │               │
│   Viral      │                              │               │
│   Settings   │                              │               │
├──────────────┴──────────────────────────────┴───────────────┤
│ Persistent player bar: ⏮ ▶ ⏭ · title · progress · vol     │
└─────────────────────────────────────────────────────────────┘
```

---

## Visual Design

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#000` | Body |
| `--bg-app` | radial gradient | App shell bg |
| `--red` | `#E63946` | Primary accent |
| `--red-dark` | `#a01828` | Button gradient end |
| `--gold` | `#FFB800` | Secondary accent, progress gradient end |
| `--glass` | `rgba(0,0,0,0.55)` + `backdrop-filter:blur(18px)` | All panels |
| `--glass-active` | `rgba(230,57,70,0.10)` + red border | Selected/active panels |
| `--border` | `rgba(230,57,70,0.16)` | Panel borders |
| `--border-active` | `rgba(230,57,70,0.36)` | Active element borders |
| `--text` | `#fff` | Primary text |
| `--text-dim` | `rgba(255,255,255,0.28)` | Secondary text |
| `--text-label` | `rgba(230,57,70,0.45)` | Section labels |

### Background

```css
background:
  radial-gradient(ellipse at 10% 0%,  rgba(230,57,70,0.40) 0%, transparent 45%),
  radial-gradient(ellipse at 90% 90%, rgba(180,30,40,0.30) 0%, transparent 45%),
  radial-gradient(ellipse at 55% 45%, rgba(80,5,10,0.50)   0%, transparent 70%),
  #040102;
```

### Glass Panels

```css
.glass {
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(18px) saturate(1.2);
  border: 1px solid rgba(230,57,70,0.16);
  border-radius: 10px;
}
```

### Typography

- Display/headings: `SF Pro Display` → `Inter` → system fallback
- Body: `SF Pro Text` → `Inter` → system fallback
- Monospace (timestamps, BPM, technical): `SF Mono` → `Fira Code` → monospace

### Animations

- Panel entry: `opacity 0 → 1` + `translateY(6px) → 0`, `200ms ease-out`
- Tab switch: content crossfade `150ms`
- Track row hover: `background` transition `120ms`
- Play button: red glow pulse `2s infinite` while playing
- Progress bar scrubber: expand on hover `100ms`

---

## Left Sidebar

### Projects Section

- Lists all projects from `GET /api/projects`
- Active project highlighted with red left border + glass-active bg
- Click → loads project into centre workspace
- `＋ New Project` → inline name input → `POST /api/projects`
- Project count badge

### Playlists Section

**Manual playlists:**
- User-created named playlists stored in new `playlists` SQLite table
- `POST /api/playlists` · `GET /api/playlists` · `PUT /api/playlists/:id` · `DELETE /api/playlists/:id`
- Add track: `POST /api/playlists/:id/tracks`
- Remove track: `DELETE /api/playlists/:id/tracks/:musicId`
- Badge shows track count

**Smart playlists (auto-populated, read-only):**
- "All Mastered" — tracks with `mastered: true`
- "Instrumentals" — tracks with `isInstrumental: true`
- "Unmastered" — tracks without mastered file
- Smart playlists computed client-side from existing music data — no new endpoints

### More Section

- History → `/history` page
- Viral Toolkit → `/viral` page
- Settings → `/settings` page

---

## Centre: 5 Tabs

### SOUNDS Tab

**Track list** (primary view):
- Fetches `GET /api/projects/:id/music`
- Each track row: artwork colour · title · meta (duration, kbps) · waveform preview · badges (MASTERED, BPM, INSTRUMENTAL, STEMS)
- Active/playing track: `glass-active` bg + red glow
- Click → selects track (updates right panel)
- Double-click → opens CRAFT tab with that track loaded in Audio Editor

**Generate section:**
- `⚡ Generate New` button → expands inline panel with model selector + lyrics selector → `POST /api/music/generate` → BullMQ job → WebSocket progress
- `▼ YouTube Import` → expands `YoutubeDownloader` component inline

**Vocal Removal:**
- Per-track `Remove Vocals` action in track row overflow menu → opens inline `VocalRemovalCard`

**A/B Comparator strip:**
- Persistent at bottom of SOUNDS tab
- Slot A and Slot B — drag tracks onto slots or click to assign
- Play A / Play B buttons — instant switch, same seek position
- `⇄ SWAP` exchanges slots

### WRITE Tab

- Full `LyricsEditor` component
- Style preset chips: Hinglish Urban · Punjabi Swagger · Hindi-Urdu Classical · Regional Fusion · Custom
- Generate → edit inline → version history accordion
- Lyrics linked to selected project

### CREATE Tab

Three sections, accordion-expandable:

1. **Artwork** — `ArtworkGenerator` component + artwork thumbnail grid per track
2. **Video** — `VideoPreview` component
3. **Voice** — `VoiceDesign` component

### CRAFT Tab

Three sections, tab-within-tab:

1. **Audio Editor** — `AudioEditorPanel` for selected track. Real-time preview via `useRealtimeAudio`.
2. **Medley Mixer** — `MedleyPanel`. Drag tracks from library into medley.
3. **A/B** — expanded A/B view with waveform overlay comparison.

**AI Remix Suggestions panel** (below Audio Editor):
- Triggered after any audio generation completes
- Shows 3 preset suggestions: "Lo-fi chill", "Stadium reverb", "Gym energy"
- Each suggestion maps to a set of `AudioOperations` — clicking applies them to the Audio Editor controls
- Implemented client-side: no new API, just preset `AudioOperations` objects

### RELEASE Tab

Three sections:

1. **Release Readiness Checklist** — computed from track metadata:
   - ✅/⚠ Has artwork · Has lyrics · Mastered to −14 LUFS · Title not "Version N" · Duration > 60s
   - Shows per selected track, not blocking

2. **Mastering** — `AudioMasteringPanel` (existing component, unchanged)

3. **Social Export Presets:**
   - Presets: TikTok (60s), Instagram Reels (30s), YouTube Shorts (60s), Full Track
   - Each preset calls `POST /api/audio/process` with trim + optional artwork overlay note
   - New backend endpoint: `POST /api/audio/social-export` — wraps ffmpeg trim + metadata tag
   - Downloads result directly

---

## Right Panel

### Selected Track Card

- Artwork thumbnail (140×140) with `✎ Edit` overlay → opens CREATE tab, Artwork section
- Track title + editable on double-click → `PUT /api/music/:id`
- Meta: BPM (auto-detected) · key · duration
- Status badges: MASTERED · INSTRUMENTAL · STEMS · BPM value
- Playlist membership list with add/remove

### Quick Actions

- ▶ Play — plays in persistent player bar
- ✎ Edit Audio — switches to CRAFT tab, Audio Editor
- ⬆ Master — switches to RELEASE tab, Mastering section
- 📤 Social Export — switches to RELEASE tab, Social Export section
- ＋ Add to Playlist — dropdown of playlists
- 🔗 Share Link — generates read-only project share URL

### Track Notes

- Timestamp-anchored notes: text input + current playhead time → saved to `POST /api/music/:id/notes`
- Notes displayed as markers on waveform in Audio Editor
- New `music_notes` table: `id, music_id, timestamp_sec, text, created_at`
- New endpoints: `GET /api/music/:id/notes` · `POST /api/music/:id/notes` · `DELETE /api/music/:id/notes/:noteId`

---

## Persistent Player Bar

- Always visible at bottom
- Track title · artwork mini thumb · ⏮ ▶/⏸ ⏭
- Progress bar: red→gold gradient · scrubber dot · click-to-seek
- Time elapsed / total
- Volume slider
- Current playlist indicator with `⇄ shuffle` toggle

---

## Auto-Tagging (BPM + Key Detection)

- On music load: `GET /api/music/:id/tags` → returns `{ bpm, key, mood }`
- Backend: runs `ffmpeg`-based BPM detection (aubio or essentia via CLI) on the audio file
- New endpoint: `GET /api/music/:id/tags` — lazy-computes and caches in `music_tags` table
- If detection fails: shows `—` gracefully, no error state shown to user
- Smart playlists filter by these tags

---

## Share Links

- `POST /api/projects/:id/share` → returns `{ shareToken, url }`
- `GET /api/share/:token` → read-only project view (no auth required)
- Share view: project name · track list · play each track · view lyrics · view artwork
- No editing, no generation controls in share view
- Token stored in `project_shares` table: `id, project_id, token, created_at, expires_at`
- Expiry: 30 days default, renewable

---

## New Backend Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/playlists` | List user playlists |
| POST | `/api/playlists` | Create playlist |
| PUT | `/api/playlists/:id` | Rename playlist |
| DELETE | `/api/playlists/:id` | Delete playlist |
| POST | `/api/playlists/:id/tracks` | Add track |
| DELETE | `/api/playlists/:id/tracks/:musicId` | Remove track |
| GET | `/api/music/:id/tags` | BPM/key/mood tags |
| GET | `/api/music/:id/notes` | Track timestamp notes |
| POST | `/api/music/:id/notes` | Add note |
| DELETE | `/api/music/:id/notes/:noteId` | Delete note |
| POST | `/api/audio/social-export` | Trim + tag for social clip |
| POST | `/api/projects/:id/share` | Generate share token |
| GET | `/api/share/:token` | Read-only project view |

---

## New Database Tables

```sql
CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlist_tracks (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  music_id TEXT NOT NULL REFERENCES music_generations(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE music_tags (
  music_id TEXT PRIMARY KEY REFERENCES music_generations(id) ON DELETE CASCADE,
  bpm REAL,
  key TEXT,
  mood TEXT,
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE music_notes (
  id TEXT PRIMARY KEY,
  music_id TEXT NOT NULL REFERENCES music_generations(id) ON DELETE CASCADE,
  timestamp_sec REAL NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_shares (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
```

---

## New Frontend Component Tree

```
frontend/src/
├── pages/
│   ├── StudioV4.tsx              # New main workspace page
│   └── ShareView.tsx             # Read-only share link view
└── components/v4/
    ├── layout/
    │   ├── AppShell.tsx          # Root layout: sidebar + main + right panel
    │   ├── Titlebar.tsx          # Window controls + logo + avatar
    │   ├── LeftSidebar.tsx       # Projects + playlists + more
    │   ├── RightPanel.tsx        # Track card + quick actions + notes
    │   └── PlayerBar.tsx         # Persistent bottom player
    ├── workspace/
    │   ├── TabBar.tsx            # SOUNDS/WRITE/CREATE/CRAFT/RELEASE
    │   ├── SoundsTab.tsx         # Track list + generate + YouTube + A/B
    │   ├── WriteTab.tsx          # Lyrics editor wrapper
    │   ├── CreateTab.tsx         # Artwork + video + voice
    │   ├── CraftTab.tsx          # Audio editor + medley + A/B detail
    │   └── ReleaseTab.tsx        # Mastering + social export + checklist
    ├── tracks/
    │   ├── TrackRow.tsx          # Single track list item with waveform
    │   ├── WaveformMini.tsx      # Mini waveform from AudioBuffer
    │   └── ABComparator.tsx      # A/B compare strip
    ├── playlist/
    │   ├── PlaylistList.tsx      # Sidebar playlist items
    │   └── PlaylistManager.tsx   # Add/remove tracks modal
    ├── release/
    │   ├── ReadinessChecklist.tsx
    │   └── SocialExportPanel.tsx
    └── shared/
        ├── GlassPanel.tsx        # Reusable glass panel wrapper
        ├── Badge.tsx             # Status badges (MASTERED, BPM, etc.)
        └── RemixSuggestions.tsx  # AI remix preset tiles
```

---

## Testing Requirements

All existing E2E tests must still pass. New tests required:

### Backend Integration Tests

- `playlist.test.js` — CRUD + track add/remove
- `music-tags.test.js` — GET tags, fallback to `—` on detection failure
- `music-notes.test.js` — CRUD
- `social-export.test.js` — trim + output file exists
- `share.test.js` — token creation, GET share view, expiry

### Frontend E2E Tests (Playwright)

- `v4-workspace.spec.ts` — DAW layout renders, all 5 tabs accessible
- `v4-sounds.spec.ts` — track list loads, generate triggers job, A/B compare
- `v4-playlists.spec.ts` — create playlist, add track, smart playlist filters
- `v4-release.spec.ts` — readiness checklist, social export downloads file
- `v4-share.spec.ts` — share link generation, read-only view accessible without auth

---

## Implementation Order

1. **Backend foundations** — DB migrations + playlist/notes/tags/share endpoints
2. **AppShell + layout** — shell, titlebar, sidebar skeleton, player bar
3. **SOUNDS tab** — track list with waveforms, A/B strip
4. **WRITE tab** — lyrics editor wired in
5. **CREATE tab** — artwork/video/voice wired in
6. **CRAFT tab** — audio editor + medley wired in + remix suggestions
7. **RELEASE tab** — mastering + social export + readiness checklist
8. **Playlists** — manual + smart
9. **Right panel** — track card, notes, quick actions, share link
10. **PlayerBar** — persistent playback
11. **Share view** — read-only page
12. **Auto-tagging** — BPM/key detection
13. **Full E2E test pass** — all new tests green

---

## Out of Scope (Phase 4.1)

- Real-time collaboration (multi-user editing)
- Mobile responsive layout
- Offline mode / PWA
- Direct social media posting (OAuth to TikTok/Instagram)
