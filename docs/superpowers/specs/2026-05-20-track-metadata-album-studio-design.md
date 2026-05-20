# Track Metadata & Album Studio Design

## Goal

Replace the confusing "Create" tab with a song-centric metadata editing experience and a first-class Album Studio. Each track gets an inline edit panel with Apple Music-style metadata + per-song artwork. Albums are separate entities from playlists.

## Architecture

**Three independent changes:**
1. **Sounds tab** — inline ✎ edit panel per track (metadata + artwork)
2. **Create tab → Album tab** — albums as a new DB entity with cover art, fields, ordered tracklist
3. **Relocate Video and Voice** — Video moves to Release tab, Voice moves to Craft tab

## Database Schema

### Migration 018 — per-song user metadata columns

Add to `music_generations`:
```sql
ALTER TABLE music_generations ADD COLUMN artist TEXT;
ALTER TABLE music_generations ADD COLUMN genre TEXT;
ALTER TABLE music_generations ADD COLUMN year INTEGER;
ALTER TABLE music_generations ADD COLUMN track_number INTEGER;
ALTER TABLE music_generations ADD COLUMN composer TEXT;
ALTER TABLE music_generations ADD COLUMN lyrics_credit TEXT;
```

Note: `title` and `artwork_url` already exist (migrations 008, 007). BPM and key_signature live in `music_tags` (read-only, auto-analyzed).

### Migration 019 — albums table

```sql
CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  year INTEGER,
  genre TEXT,
  label TEXT,
  artwork_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Migration 020 — album_tracks table

```sql
CREATE TABLE IF NOT EXISTS album_tracks (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  music_id TEXT NOT NULL REFERENCES music_generations(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(album_id, music_id)
);
```

## Backend API

### Per-song metadata

| Method | Path | Body | Description |
|--------|------|------|-------------|
| PATCH | `/api/music/:id/metadata` | `{ artist, genre, year, track_number, composer, lyrics_credit, title }` | Save user-editable metadata fields |

Per-song artwork already works via existing endpoints:
- `POST /api/projects/:projectId/artwork` with `{ musicId, imageData }` → saves `music-{musicId}.png`, updates `artwork_url`
- `GET /api/projects/:projectId/artwork/:musicId` → serves the file

Image generation: existing `/api/image/generate` already works — caller saves result via artwork endpoint.

### Albums CRUD

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/projects/:id/albums` | — | List albums (with track_count) |
| POST | `/api/projects/:id/albums` | `{ title, artist, year, genre, label }` | Create album |
| PUT | `/api/projects/:id/albums/:albumId` | `{ title, artist, year, genre, label, artwork_path }` | Update album fields |
| DELETE | `/api/projects/:id/albums/:albumId` | — | Delete album |
| GET | `/api/projects/:id/albums/:albumId/tracks` | — | List tracks ordered by position (full `music_generations` row) |
| POST | `/api/projects/:id/albums/:albumId/tracks` | `{ musicId }` | Add track (appends to end) |
| DELETE | `/api/projects/:id/albums/:albumId/tracks/:musicId` | — | Remove track |
| PUT | `/api/projects/:id/albums/:albumId/tracks/reorder` | `{ order: [musicId, ...] }` | Update positions |

Album artwork: same pattern as per-song. Save via `POST /api/projects/:id/albums/:albumId/artwork` with `{ imageData }` → writes file, updates `albums.artwork_path`.

## Frontend Components

### Files to create

- `frontend/src/components/v4/tracks/TrackEditPanel.tsx` — inline expand form (artwork + metadata fields)
- `frontend/src/components/v4/workspace/AlbumTab.tsx` — album list + album editor

### Files to modify

- `frontend/src/components/v4/workspace/SoundsTab.tsx` — add `expandedTrackId` state, render `TrackEditPanel` below active row
- `frontend/src/components/v4/tracks/TrackRow.tsx` — add ✎ button, `onEdit` prop callback
- `frontend/src/components/v4/workspace/CentreWorkspace.tsx` — rename `create` tab to `album`, route to `AlbumTab`
- `frontend/src/components/v4/workspace/TabBar.tsx` — rename CREATE → ALBUM, update icon to `◈`
- `frontend/src/components/v4/workspace/CraftTab.tsx` — add VoiceDesign section at bottom
- `frontend/src/components/v4/workspace/ReleaseTab.tsx` — add VideoPreview section at top

### TrackRow changes

Add ✎ icon button between the track info and ⋯ menu. Add `onEdit?: () => void` prop. Clicking ✎ calls `onEdit()`. ✎ button highlights red when `isEditOpen` prop is true.

```tsx
interface TrackRowProps {
  track: MusicGeneration;
  onDoubleClick?: () => void;
  onEdit?: () => void;
  isEditOpen?: boolean;
}
```

### TrackEditPanel

Single-responsibility component. Receives `track: MusicGeneration`, `onClose: () => void`, `onSaved: () => void`.

**Layout:** Two-column grid — artwork column (100px wide) + metadata fields.

**Artwork column:**
- Shows `<img>` if `track.artwork_url` exists, else placeholder box with ✦ Generate button
- ✦ Generate button: opens prompt textarea inline, calls `POST /api/image/generate`, then saves result via `POST /api/projects/:projectId/artwork` with musicId, then refreshes
- Artwork is 1:1 — generating replaces, never appends

**Metadata fields (all editable inputs):**
- Title (full-width)
- Artist, Genre (row)
- Year, Track # (row)
- Composer, Lyrics By (row)
- BPM (read-only, from tags), Key (read-only, from tags)

**Save:** `PATCH /api/music/:id/metadata` with all field values. Then calls `refreshTracks()` and `onSaved()`.

**Cancel:** calls `onClose()` without saving.

### SoundsTab changes

Add `const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null)`.

For each track, render:
1. `<TrackRow onEdit={() => setExpandedTrackId(t.id === expandedTrackId ? null : t.id)} isEditOpen={expandedTrackId === t.id} />`
2. If `expandedTrackId === t.id`: render `<TrackEditPanel track={t} onClose={() => setExpandedTrackId(null)} onSaved={() => setExpandedTrackId(null)} />`

Opening a new track's edit panel closes the previous one (single expanded state).

### AlbumTab

Two-panel layout:
- **Left/top:** album list — each album shown as a card with cover thumbnail, title, artist, track count. "+ New Album" button creates a blank album and opens the editor.
- **Right/bottom:** album editor — shown when an album is selected.

**Album editor:**
- Cover art box (110×110) — shows artwork if set, else placeholder. ✦ Generate button opens prompt, generates via `/api/image/generate`, saves via album artwork endpoint.
- Fields: Album Title (required), Artist, Year, Genre, Label
- Tracklist section:
  - Lists current tracks with position numbers and drag handles (use `onDragStart`/`onDrop` HTML5 drag events, no library needed)
  - "✕" removes a track from album (does not delete the track)
  - "+ Add track from project" — dropdown of tracks in active project not yet in album
  - Drag reorder calls `PUT .../tracks/reorder` on drop
- Save Album button — `PUT /api/projects/:id/albums/:albumId`
- Delete album button (red, confirmation required)

### CraftTab additions

Append VoiceDesign component at the bottom of CraftTab, inside a collapsible `<Section title="Voice Design">` (same Section component used in old CreateTab).

### ReleaseTab additions

Prepend VideoPreview component at the top of ReleaseTab, inside a collapsible `<Section title="Video">`. Move it before ReadinessChecklist.

## Artwork Flow (both per-song and album)

1. User clicks ✦ Generate
2. Inline prompt textarea appears
3. User types prompt, clicks Generate
4. Call `POST /api/image/generate` → returns `{ imageUrls: [url] }`
5. Call backend proxy to fetch image bytes: `POST /api/projects/:id/artwork/fetch-image` → returns `{ base64 }`
6. Call `POST /api/projects/:id/artwork` with `{ musicId, imageData: base64 }` (or album endpoint)
7. Backend saves file, returns `{ artworkUrl }`
8. UI updates artwork display immediately

## Error Handling

- Metadata save failure: show inline error message below form, keep panel open
- Artwork generation failure: show error below prompt textarea
- Album save failure: show error toast near Save button
- All delete operations require `confirm()` dialog before proceeding

## What is NOT changing

- `ArtworkGenerator` component (legacy, used only from old CreateTab — can be removed when AlbumTab is complete)
- `VideoPreview`, `VoiceDesign` components — moved, not rewritten
- Playlist functionality — albums are separate, playlists unchanged
- `RightPanel` — artwork thumbnail already shows `track.artwork_url`; it will auto-reflect once per-song artwork is saved

## Testing

- Backend: integration tests for new metadata PATCH endpoint and all album CRUD endpoints via real HTTP calls
- Frontend E2E: `v4-track-metadata.spec.ts` — open inline edit panel, save metadata, verify persistence; generate artwork stub
- Frontend E2E: `v4-album.spec.ts` — create album, add tracks, reorder, save, delete
