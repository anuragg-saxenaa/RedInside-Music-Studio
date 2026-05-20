# Track Metadata & Album Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Apple Music-style per-track metadata editing (inline panel in Sounds tab with artwork + lyrics pre-fill) and a first-class Album Studio tab; relocate Video to Release tab and Voice to Craft tab.

**Architecture:** Three layers — DB migrations add new columns/tables, backend extends existing PATCH and adds album CRUD, frontend replaces CreateTab with AlbumTab and adds inline TrackEditPanel. No new libraries. HTML5 drag for tracklist reorder.

**Tech Stack:** SQLite (better-sqlite3), Express, React 18 + TypeScript, inline styles only, nanoid for IDs.

---

## File Structure

**New files:**
- `backend/src/database/migrations/018_music_metadata.sql`
- `backend/src/database/migrations/019_albums.sql`
- `backend/src/database/migrations/020_album_tracks.sql`
- `backend/src/modules/album/album.model.js`
- `backend/src/modules/album/album.controller.js`
- `backend/src/api/routes/album.routes.js`
- `frontend/src/components/v4/tracks/TrackEditPanel.tsx`
- `frontend/src/components/v4/workspace/AlbumTab.tsx`
- `frontend/tests/e2e/v4-album.spec.ts`

**Modified files:**
- `backend/src/database/models/music.model.js` — add new metadata fields to `update()`
- `backend/src/modules/music/music.service.js` — extend `updateMusicMetadata()`
- `backend/src/modules/music/music.controller.js` — extend `update()` to accept new fields
- `backend/src/api/routes/projects.routes.js` — add album artwork route handler
- `backend/src/server.js` — import + register AlbumRoutes
- `frontend/src/types.ts` — add fields to `MusicGeneration`, add `Album` type, rename V4Tab `'create'` → `'album'`
- `frontend/src/components/v4/workspace/TabBar.tsx` — rename CREATE → ALBUM
- `frontend/src/components/v4/workspace/CentreWorkspace.tsx` — swap CreateTab for AlbumTab
- `frontend/src/components/v4/workspace/SoundsTab.tsx` — add `expandedTrackId` state
- `frontend/src/components/v4/tracks/TrackRow.tsx` — add ✎ button + `onEdit`/`isEditOpen` props
- `frontend/src/components/v4/workspace/CraftTab.tsx` — add VoiceDesign section
- `frontend/src/components/v4/workspace/ReleaseTab.tsx` — add VideoPreview section
- `frontend/tests/e2e/v4-create.spec.ts` — update for renamed tab

---

## Task 1: DB migrations — per-song metadata columns

**Files:**
- Create: `backend/src/database/migrations/018_music_metadata.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 018_music_metadata.sql
ALTER TABLE music_generations ADD COLUMN artist TEXT;
ALTER TABLE music_generations ADD COLUMN genre TEXT;
ALTER TABLE music_generations ADD COLUMN year INTEGER;
ALTER TABLE music_generations ADD COLUMN track_number INTEGER;
ALTER TABLE music_generations ADD COLUMN composer TEXT;
ALTER TABLE music_generations ADD COLUMN lyrics_credit TEXT;
```

- [ ] **Step 2: Run migrations**

```bash
cd backend && npm run db:migrate
```

Expected: no errors. Verify by running:
```bash
node -e "import('./src/database/connection.js').then(m => { const cols = m.default.prepare(\"PRAGMA table_info(music_generations)\").all(); console.log(cols.map(c=>c.name).join(', ')); })"
```
Expected output includes: `artist, genre, year, track_number, composer, lyrics_credit`

- [ ] **Step 3: Commit**

```bash
git add backend/src/database/migrations/018_music_metadata.sql
git commit -m "feat: migration 018 — per-song metadata columns"
```

---

## Task 2: DB migrations — albums and album_tracks tables

**Files:**
- Create: `backend/src/database/migrations/019_albums.sql`
- Create: `backend/src/database/migrations/020_album_tracks.sql`

- [ ] **Step 1: Write albums migration**

```sql
-- 019_albums.sql
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

- [ ] **Step 2: Write album_tracks migration**

```sql
-- 020_album_tracks.sql
CREATE TABLE IF NOT EXISTS album_tracks (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  music_id TEXT NOT NULL REFERENCES music_generations(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(album_id, music_id)
);
```

- [ ] **Step 3: Run migrations**

```bash
cd backend && npm run db:migrate
```

Expected: no errors. Verify:
```bash
node -e "import('./src/database/connection.js').then(m => { const t = m.default.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all(); console.log(t.map(r=>r.name).join(', ')); })"
```
Expected output includes: `albums, album_tracks`

- [ ] **Step 4: Commit**

```bash
git add backend/src/database/migrations/019_albums.sql backend/src/database/migrations/020_album_tracks.sql
git commit -m "feat: migrations 019/020 — albums and album_tracks tables"
```

---

## Task 3: Extend music PATCH endpoint for new metadata fields

**Files:**
- Modify: `backend/src/database/models/music.model.js`
- Modify: `backend/src/modules/music/music.service.js`
- Modify: `backend/src/modules/music/music.controller.js`

Context: The existing `PATCH /api/music/:id` currently only saves `title`. Extend it to also save `artist`, `genre`, `year`, `track_number`, `composer`, `lyrics_credit`.

- [ ] **Step 1: Extend `MusicModel.update()` in `backend/src/database/models/music.model.js`**

Add six new field handlers inside the `update()` method, after the existing `if (data.title !== undefined)` block (around line 113):

```js
      if (data.artist !== undefined) {
        updates.push('artist = ?');
        values.push(data.artist);
      }
      if (data.genre !== undefined) {
        updates.push('genre = ?');
        values.push(data.genre);
      }
      if (data.year !== undefined) {
        updates.push('year = ?');
        values.push(data.year);
      }
      if (data.trackNumber !== undefined) {
        updates.push('track_number = ?');
        values.push(data.trackNumber);
      }
      if (data.composer !== undefined) {
        updates.push('composer = ?');
        values.push(data.composer);
      }
      if (data.lyricsCredit !== undefined) {
        updates.push('lyrics_credit = ?');
        values.push(data.lyricsCredit);
      }
```

- [ ] **Step 2: Extend `updateMusicMetadata()` in `backend/src/modules/music/music.service.js`**

Replace the existing method (line ~223):

```js
  async updateMusicMetadata(musicId, metadata) {
    const { processedFilePath, durationSeconds, bitrate, title,
            artist, genre, year, trackNumber, composer, lyricsCredit } = metadata;

    return MusicModel.update(musicId, {
      processedFilePath,
      durationSeconds,
      bitrate,
      title,
      artist,
      genre,
      year,
      trackNumber,
      composer,
      lyricsCredit,
    });
  }
```

- [ ] **Step 3: Extend `update()` in `backend/src/modules/music/music.controller.js`**

Replace the existing `update` handler (line ~170):

```js
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { title, artist, genre, year, track_number, composer, lyrics_credit } = req.body;

      const music = await musicService.getMusic(id);
      if (!music) return res.status(404).json({ error: 'Music not found' });

      const updated = await musicService.updateMusicMetadata(id, {
        title,
        artist,
        genre,
        year,
        trackNumber: track_number,
        composer,
        lyricsCredit: lyrics_credit,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
```

- [ ] **Step 4: Test the endpoint manually**

```bash
cd backend && npm run dev &
sleep 2
# First create or find a music id to test with
curl -s http://localhost:3000/api/music/nonexistent | jq .
# Should return: {"error":"Music not found"}

# If you have a real music ID (from a seeded project), test with:
# curl -s -X PATCH http://localhost:3000/api/music/MUSIC_ID \
#   -H "Content-Type: application/json" \
#   -d '{"artist":"RedInside","genre":"Desi Hip-Hop","year":2026}' | jq .
# Should return the updated music object with new fields set
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/models/music.model.js \
        backend/src/modules/music/music.service.js \
        backend/src/modules/music/music.controller.js
git commit -m "feat: extend PATCH /api/music/:id with artist/genre/year/track_number/composer/lyrics_credit"
```

---

## Task 4: Album backend — model, controller, routes

**Files:**
- Create: `backend/src/modules/album/album.model.js`
- Create: `backend/src/modules/album/album.controller.js`
- Create: `backend/src/api/routes/album.routes.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Write `backend/src/modules/album/album.model.js`**

```js
import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const AlbumModel = {
  create({ projectId, title, artist, year, genre, label }) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO albums (id, project_id, title, artist, year, genre, label)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, title, artist ?? null, year ?? null, genre ?? null, label ?? null);
    return this.findById(id);
  },

  findByProject(projectId) {
    return db.prepare(`
      SELECT a.*, COUNT(at.id) as track_count
      FROM albums a
      LEFT JOIN album_tracks at ON at.album_id = a.id
      WHERE a.project_id = ?
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `).all(projectId);
  },

  findById(id) {
    return db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
  },

  update(id, { title, artist, year, genre, label, artworkPath }) {
    const updates = [];
    const values = [];
    if (title !== undefined)       { updates.push('title = ?');        values.push(title); }
    if (artist !== undefined)      { updates.push('artist = ?');       values.push(artist); }
    if (year !== undefined)        { updates.push('year = ?');         values.push(year); }
    if (genre !== undefined)       { updates.push('genre = ?');        values.push(genre); }
    if (label !== undefined)       { updates.push('label = ?');        values.push(label); }
    if (artworkPath !== undefined) { updates.push('artwork_path = ?'); values.push(artworkPath); }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    db.prepare(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM albums WHERE id = ?').run(id);
  },

  getTracks(albumId) {
    return db.prepare(`
      SELECT mg.*, at.position
      FROM album_tracks at
      JOIN music_generations mg ON mg.id = at.music_id
      WHERE at.album_id = ?
      ORDER BY at.position ASC
    `).all(albumId);
  },

  addTrack(albumId, musicId) {
    const id = uuidv4();
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as m FROM album_tracks WHERE album_id = ?'
    ).get(albumId).m;
    db.prepare(`
      INSERT OR IGNORE INTO album_tracks (id, album_id, music_id, position)
      VALUES (?, ?, ?, ?)
    `).run(id, albumId, musicId, maxPos + 1);
  },

  removeTrack(albumId, musicId) {
    db.prepare('DELETE FROM album_tracks WHERE album_id = ? AND music_id = ?').run(albumId, musicId);
  },

  reorderTracks(albumId, orderedMusicIds) {
    const update = db.prepare(
      'UPDATE album_tracks SET position = ? WHERE album_id = ? AND music_id = ?'
    );
    const tx = db.transaction((ids) => {
      ids.forEach((musicId, idx) => update.run(idx, albumId, musicId));
    });
    tx(orderedMusicIds);
  },
};
```

- [ ] **Step 2: Write `backend/src/modules/album/album.controller.js`**

```js
import { AlbumModel } from './album.model.js';

export const AlbumController = {
  async list(req, res, next) {
    try {
      const { id: projectId } = req.params;
      res.json(AlbumModel.findByProject(projectId));
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const { id: projectId } = req.params;
      const { title, artist, year, genre, label } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
      res.status(201).json(AlbumModel.create({ projectId, title: title.trim(), artist, year, genre, label }));
    } catch (e) { next(e); }
  },

  async update(req, res, next) {
    try {
      const { albumId } = req.params;
      const album = AlbumModel.findById(albumId);
      if (!album) return res.status(404).json({ error: 'Album not found' });
      const { title, artist, year, genre, label } = req.body;
      res.json(AlbumModel.update(albumId, { title, artist, year, genre, label }));
    } catch (e) { next(e); }
  },

  async remove(req, res, next) {
    try {
      const { albumId } = req.params;
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      AlbumModel.delete(albumId);
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async getTracks(req, res, next) {
    try {
      const { albumId } = req.params;
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      res.json(AlbumModel.getTracks(albumId));
    } catch (e) { next(e); }
  },

  async addTrack(req, res, next) {
    try {
      const { albumId } = req.params;
      const { musicId } = req.body;
      if (!musicId) return res.status(400).json({ error: 'musicId is required' });
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      AlbumModel.addTrack(albumId, musicId);
      res.status(201).json(AlbumModel.getTracks(albumId));
    } catch (e) { next(e); }
  },

  async removeTrack(req, res, next) {
    try {
      const { albumId, musicId } = req.params;
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      AlbumModel.removeTrack(albumId, musicId);
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async reorderTracks(req, res, next) {
    try {
      const { albumId } = req.params;
      const { order } = req.body;
      if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of musicIds' });
      if (!AlbumModel.findById(albumId)) return res.status(404).json({ error: 'Album not found' });
      AlbumModel.reorderTracks(albumId, order);
      res.json(AlbumModel.getTracks(albumId));
    } catch (e) { next(e); }
  },
};
```

- [ ] **Step 3: Write `backend/src/api/routes/album.routes.js`**

```js
import { AlbumController } from '../../modules/album/album.controller.js';

export const AlbumRoutes = [
  { method: 'get',    path: '/api/projects/:id/albums',                               handler: AlbumController.list },
  { method: 'post',   path: '/api/projects/:id/albums',                               handler: AlbumController.create },
  { method: 'put',    path: '/api/projects/:id/albums/:albumId',                      handler: AlbumController.update },
  { method: 'delete', path: '/api/projects/:id/albums/:albumId',                      handler: AlbumController.remove },
  { method: 'get',    path: '/api/projects/:id/albums/:albumId/tracks',               handler: AlbumController.getTracks },
  { method: 'post',   path: '/api/projects/:id/albums/:albumId/tracks',               handler: AlbumController.addTrack },
  { method: 'delete', path: '/api/projects/:id/albums/:albumId/tracks/:musicId',      handler: AlbumController.removeTrack },
  { method: 'put',    path: '/api/projects/:id/albums/:albumId/tracks/reorder',       handler: AlbumController.reorderTracks },
];
```

- [ ] **Step 4: Register AlbumRoutes in `backend/src/server.js`**

Add import near the top (after the ShareRoutes import):
```js
import { AlbumRoutes } from './api/routes/album.routes.js';
```

Add registration after the `ShareRoutes.forEach` block:
```js
AlbumRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});
```

- [ ] **Step 5: Restart server and smoke-test**

```bash
cd backend && npm run dev &
sleep 2

# Create a project first if needed, then:
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Album Test"}' | jq '.id' > /tmp/proj_id.txt

PROJ=$(cat /tmp/proj_id.txt | tr -d '"')

# Create album
curl -s -X POST "http://localhost:3000/api/projects/$PROJ/albums" \
  -H "Content-Type: application/json" \
  -d '{"title":"Dil Se EP","artist":"RedInside","year":2026}' | jq .

# List albums
curl -s "http://localhost:3000/api/projects/$PROJ/albums" | jq .

kill %1
```

Expected: album created with id, listed in GET.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/album/ \
        backend/src/api/routes/album.routes.js \
        backend/src/server.js
git commit -m "feat: album CRUD backend — model, controller, routes"
```

---

## Task 5: Album artwork backend route

**Files:**
- Modify: `backend/src/api/routes/projects.routes.js`

Context: The existing `saveArtwork` handler at line ~144 already handles per-song artwork (when `musicId` is in body) and project artwork (when musicId is absent). Add an album artwork variant. The artwork dir is `storage/projects/{projectId}/artwork/`. Album artwork saves as `album-{albumId}.png`.

- [ ] **Step 1: Add `saveAlbumArtwork` and `getAlbumArtwork` handlers in `backend/src/api/routes/projects.routes.js`**

Import `AlbumModel` at top of file:
```js
import { AlbumModel } from '../../modules/album/album.model.js';
```

Add these two handlers to the `ProjectsController` object (after `getMusicArtwork`):

```js
  async saveAlbumArtwork(req, res, next) {
    try {
      const { id: projectId, albumId } = req.params;
      const { imageData } = req.body;
      if (!imageData) return res.status(400).json({ error: 'imageData is required' });

      const album = AlbumModel.findById(albumId);
      if (!album) return res.status(404).json({ error: 'Album not found' });

      const buffer = Buffer.from(
        imageData.startsWith('data:') ? imageData.split(',')[1] : imageData,
        'base64'
      );

      const artworkDir = storage.getArtworkDir(projectId);
      fs.mkdirSync(artworkDir, { recursive: true });
      const artworkPath = path.join(artworkDir, `album-${albumId}.png`);
      fs.writeFileSync(artworkPath, buffer);

      AlbumModel.update(albumId, { artworkPath });

      const artworkUrl = `/api/projects/${projectId}/albums/${albumId}/artwork`;
      res.json({ success: true, artworkUrl });
    } catch (err) { next(err); }
  },

  async getAlbumArtwork(req, res, next) {
    try {
      const { id: projectId, albumId } = req.params;
      const album = AlbumModel.findById(albumId);
      if (!album || !album.artwork_path) return res.status(404).json({ error: 'No artwork' });
      if (!fs.existsSync(album.artwork_path)) return res.status(404).json({ error: 'File not found' });
      res.setHeader('Content-Type', 'image/png');
      res.sendFile(album.artwork_path);
    } catch (err) { next(err); }
  },
```

- [ ] **Step 2: Register routes in `backend/src/server.js`**

In the inline routes array (find the artwork routes block around line 74), add:
```js
  { method: 'post', path: '/api/projects/:id/albums/:albumId/artwork', handler: ProjectsController.saveAlbumArtwork },
  { method: 'get',  path: '/api/projects/:id/albums/:albumId/artwork', handler: ProjectsController.getAlbumArtwork },
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/api/routes/projects.routes.js backend/src/server.js
git commit -m "feat: album artwork save/get endpoints"
```

---

## Task 6: TypeScript types + tab rename

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/v4/workspace/TabBar.tsx`
- Modify: `frontend/src/components/v4/workspace/CentreWorkspace.tsx`
- Modify: `frontend/tests/e2e/v4-create.spec.ts`

- [ ] **Step 1: Update `frontend/src/types.ts`**

Replace the `V4Tab` type:
```ts
export type V4Tab = 'sounds' | 'write' | 'album' | 'craft' | 'release';
```

Add new fields to `MusicGeneration` interface (after the `title?: string` line):
```ts
  artist?: string;
  genre?: string;
  year?: number;
  track_number?: number;
  composer?: string;
  lyrics_credit?: string;
```

Add new `Album` interface (after `MusicGeneration`):
```ts
export interface Album {
  id: string;
  project_id: string;
  title: string;
  artist?: string;
  year?: number;
  genre?: string;
  label?: string;
  artwork_path?: string;
  track_count?: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Update `TabBar.tsx`** — rename the create tab to album

Replace the TABS array:
```ts
const TABS: { id: V4Tab; label: string; icon: string }[] = [
  { id: 'sounds',  label: 'SOUNDS',  icon: '♪' },
  { id: 'write',   label: 'WRITE',   icon: '✎' },
  { id: 'album',   label: 'ALBUM',   icon: '◈' },
  { id: 'craft',   label: 'CRAFT',   icon: '⚙' },
  { id: 'release', label: 'RELEASE', icon: '↗' },
];
```

- [ ] **Step 3: Update `CentreWorkspace.tsx`** — swap CreateTab for AlbumTab

Replace CreateTab import with AlbumTab:
```ts
import AlbumTab from './AlbumTab';
```

Replace the tab render line:
```tsx
        {activeTab === 'album'   && <AlbumTab />}
```

Remove the old `import CreateTab` and `activeTab === 'create'` line.

- [ ] **Step 4: Update `frontend/tests/e2e/v4-create.spec.ts`** — fix tab selector

Replace every occurrence of `tab-create` with `tab-album` and `create-tab` with `album-tab`:
```ts
// Line 13: was [data-testid="tab-create"]
await page.locator('[data-testid="tab-album"]').click();
// Line 23: was [data-testid="create-tab"]
await expect(page.locator('[data-testid="album-tab"]')).toBeVisible({ timeout: 8000 });
// Line 46: was [data-testid="tab-create"]
await page.locator('[data-testid="tab-album"]').click();
// Line 49: was [data-testid="create-tab"]
await expect(page.locator('[data-testid="album-tab"]')).toBeVisible({ timeout: 5000 });
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts \
        frontend/src/components/v4/workspace/TabBar.tsx \
        frontend/src/components/v4/workspace/CentreWorkspace.tsx \
        frontend/tests/e2e/v4-create.spec.ts
git commit -m "feat: rename CREATE tab to ALBUM, add Album type, update MusicGeneration fields"
```

---

## Task 7: AlbumTab placeholder + move Video/Voice

**Files:**
- Create: `frontend/src/components/v4/workspace/AlbumTab.tsx` (placeholder — full implementation in Task 10)
- Modify: `frontend/src/components/v4/workspace/CraftTab.tsx`
- Modify: `frontend/src/components/v4/workspace/ReleaseTab.tsx`

- [ ] **Step 1: Create placeholder `AlbumTab.tsx`** so the app compiles

```tsx
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function AlbumTab() {
  const { activeProjectId } = useWorkspace();

  if (!activeProjectId) {
    return <div data-testid="album-tab" style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div data-testid="album-tab">
      <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>
        Album Studio — coming soon
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add VoiceDesign to `CraftTab.tsx`**

Add import at top:
```tsx
import VoiceDesign from '../../VoiceDesign/VoiceDesign';
```

Add a Section component at the bottom of the component (after the closing `</div>` of the medley subtab block, before the final `</div>`):

First, copy the Section component from CreateTab into CraftTab (or use inline collapsible):

```tsx
function VoiceSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden', marginTop: '16px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none',
          borderBottom: open ? `1px solid ${C.border}` : 'none',
          color: C.text, padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '13px', fontWeight: 600,
        }}
      >
        Voice Design
        <span style={{ color: C.textDim, fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '16px' }}>{children}</div>}
    </div>
  );
}
```

Add at the bottom of the CraftTab return, after the medley/editor divs, before the closing root `</div>`:
```tsx
      <VoiceSection>
        <VoiceDesign projectId={activeProjectId} />
      </VoiceSection>
```

- [ ] **Step 3: Add VideoPreview to `ReleaseTab.tsx`**

Add import at top:
```tsx
import VideoPreview from '../../VideoPreview/VideoPreview';
```

Add a VideoSection component before ReadinessChecklist in the return:

```tsx
function VideoSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none',
          borderBottom: open ? `1px solid ${C.border}` : 'none',
          color: C.text, padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '13px', fontWeight: 600,
        }}
      >
        Video
        <span style={{ color: C.textDim, fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '16px' }}>{children}</div>}
    </div>
  );
}
```

Add `useState` to ReleaseTab imports if not already there (it's already imported).

Wrap it around VideoPreview at the very top of the return JSX (before `<ReadinessChecklist`):
```tsx
      <VideoSection>
        <VideoPreview projectId={activeProjectId} selectedMusic={selectedTrack ?? null} />
      </VideoSection>
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/v4/workspace/AlbumTab.tsx \
        frontend/src/components/v4/workspace/CraftTab.tsx \
        frontend/src/components/v4/workspace/ReleaseTab.tsx
git commit -m "feat: AlbumTab placeholder, Video moved to Release, Voice moved to Craft"
```

---

## Task 8: TrackRow ✎ button + SoundsTab inline expand state

**Files:**
- Modify: `frontend/src/components/v4/tracks/TrackRow.tsx`
- Modify: `frontend/src/components/v4/workspace/SoundsTab.tsx`

- [ ] **Step 1: Add `onEdit` and `isEditOpen` props to `TrackRow.tsx`**

Update the interface:
```tsx
interface TrackRowProps {
  track: MusicGeneration;
  onDoubleClick?: () => void;
  onEdit?: () => void;
  isEditOpen?: boolean;
}
```

Update function signature:
```tsx
export default function TrackRow({ track, onDoubleClick, onEdit, isEditOpen }: TrackRowProps) {
```

Add ✎ button between the track info `</div>` and the ⋯ menu button. Insert after the closing `</div>` of the track info block (line ~111), before the `<button` for ⋯:

```tsx
        <button
          onClick={e => { e.stopPropagation(); onEdit?.(); }}
          title="Edit track metadata"
          style={{
            background: isEditOpen ? 'rgba(230,57,70,0.12)' : 'none',
            border: `1px solid ${isEditOpen ? 'rgba(230,57,70,0.3)' : 'transparent'}`,
            color: isEditOpen ? C.red : 'rgba(255,255,255,0.25)',
            cursor: 'pointer', fontSize: '13px', padding: '3px 6px', lineHeight: 1,
            borderRadius: '4px', flexShrink: 0,
          }}
          onMouseOver={e => { (e.currentTarget.style.color = C.text); }}
          onMouseOut={e => { if (!isEditOpen) e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
        >✎</button>
```

- [ ] **Step 2: Add `expandedTrackId` state to `SoundsTab.tsx`** and wire `onEdit`

Add import for TrackEditPanel at top (will be created in Task 9):
```tsx
import TrackEditPanel from '../tracks/TrackEditPanel';
```

Add state inside `SoundsTab`:
```tsx
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
```

Update the `tracks.map` in the track list section:
```tsx
        {tracks.map(track => (
          <div key={track.id}>
            <TrackRow
              track={track}
              onDoubleClick={() => { setSelectedTrack(track); setActiveTab('craft'); }}
              onEdit={() => setExpandedTrackId(prev => prev === track.id ? null : track.id)}
              isEditOpen={expandedTrackId === track.id}
            />
            {expandedTrackId === track.id && (
              <TrackEditPanel
                track={track}
                onClose={() => setExpandedTrackId(null)}
                onSaved={() => { setExpandedTrackId(null); refreshTracks(); }}
              />
            )}
          </div>
        ))}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: one error about TrackEditPanel not existing yet — that's fine, will be fixed in Task 9. If the error is only about TrackEditPanel module not found, proceed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/v4/tracks/TrackRow.tsx \
        frontend/src/components/v4/workspace/SoundsTab.tsx
git commit -m "feat: TrackRow edit button + SoundsTab inline expand state"
```

---

## Task 9: TrackEditPanel component

**Files:**
- Create: `frontend/src/components/v4/tracks/TrackEditPanel.tsx`

This component shows artwork (1:1 per song, replace-only), AI artwork generation pre-filled with track lyrics, and full Apple Music metadata fields.

- [ ] **Step 1: Create `frontend/src/components/v4/tracks/TrackEditPanel.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { MusicGeneration } from '../../../types';

interface TrackEditPanelProps {
  track: MusicGeneration;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  title: string;
  artist: string;
  genre: string;
  year: string;
  track_number: string;
  composer: string;
  lyrics_credit: string;
}

export default function TrackEditPanel({ track, onClose, onSaved }: TrackEditPanelProps) {
  const { activeProjectId, refreshTracks } = useWorkspace();
  const [form, setForm] = useState<FormState>({
    title: track.title ?? '',
    artist: track.artist ?? '',
    genre: track.genre ?? '',
    year: track.year?.toString() ?? '',
    track_number: track.track_number?.toString() ?? '',
    composer: track.composer ?? '',
    lyrics_credit: track.lyrics_credit ?? '',
  });
  const [bpm, setBpm] = useState<number | null>(null);
  const [keyStr, setKeyStr] = useState<string | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(
    track.artwork_url ? `/api/projects/${activeProjectId}/artwork/${track.id}` : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Artwork generation state
  const [showGenerate, setShowGenerate] = useState(false);
  const [artPrompt, setArtPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/music/${track.id}/tags`)
      .then(r => r.json())
      .then((t: { bpm?: number; key_signature?: string }) => {
        if (t.bpm) setBpm(Math.round(t.bpm));
        if (t.key_signature) setKeyStr(t.key_signature);
      })
      .catch(() => {});
  }, [track.id]);

  // Pre-fill artwork prompt with lyrics when generate panel opens
  useEffect(() => {
    if (!showGenerate || !track.lyrics_id || artPrompt) return;
    fetch(`/api/lyrics/${track.lyrics_id}`)
      .then(r => r.json())
      .then((l: { content?: string }) => {
        if (l.content) setArtPrompt(l.content.slice(0, 300));
      })
      .catch(() => {});
  }, [showGenerate, track.lyrics_id, artPrompt]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/music/${track.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || null,
          artist: form.artist || null,
          genre: form.genre || null,
          year: form.year ? parseInt(form.year, 10) : null,
          track_number: form.track_number ? parseInt(form.track_number, 10) : null,
          composer: form.composer || null,
          lyrics_credit: form.lyrics_credit || null,
        }),
      });
      if (!res.ok) { setError('Save failed'); return; }
      refreshTracks();
      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const generateArtwork = async () => {
    if (!artPrompt.trim() || !activeProjectId) return;
    setGenerating(true);
    setGenError(null);
    try {
      // 1. Generate image
      const genRes = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, prompt: artPrompt.trim(), aspectRatio: '1:1', n: 1 }),
      });
      const genData = await genRes.json();
      if (!genRes.ok || genData.error) { setGenError(genData.error || 'Generation failed'); return; }

      const imageUrl = genData.imageUrls?.[0];
      if (!imageUrl) { setGenError('No image returned'); return; }

      // 2. Fetch image bytes via backend proxy
      const fetchRes = await fetch(`/api/projects/${activeProjectId}/artwork/fetch-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const fetchData = await fetchRes.json();
      if (!fetchRes.ok || !fetchData.base64) { setGenError('Failed to fetch image'); return; }

      // 3. Save as per-song artwork (replaces existing)
      const saveRes = await fetch(`/api/projects/${activeProjectId}/artwork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicId: track.id, imageData: fetchData.base64 }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) { setGenError('Failed to save artwork'); return; }

      setArtworkUrl(saveData.artworkUrl + '?t=' + Date.now());
      setShowGenerate(false);
      setArtPrompt('');
    } catch {
      setGenError('Network error');
    } finally {
      setGenerating(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${C.border}`,
    borderRadius: '5px',
    padding: '5px 8px',
    color: C.text,
    fontSize: '12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    display: 'block',
    marginBottom: '3px',
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={{
      margin: '2px 0 8px 44px',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid rgba(230,57,70,0.15)`,
      borderRadius: '8px',
      padding: '14px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '14px' }}>

        {/* Artwork column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt="Track artwork"
              style={{ width: '96px', height: '96px', borderRadius: '6px', objectFit: 'cover', border: `1px solid ${C.border}` }}
            />
          ) : (
            <div style={{
              width: '96px', height: '96px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.04)',
              border: `1px dashed rgba(230,57,70,0.3)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '4px',
            }}>
              <span style={{ fontSize: '20px', color: 'rgba(230,57,70,0.3)' }}>🎨</span>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>No Art</span>
            </div>
          )}
          <button
            onClick={() => setShowGenerate(v => !v)}
            style={{
              background: showGenerate ? 'rgba(230,57,70,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showGenerate ? 'rgba(230,57,70,0.3)' : C.border}`,
              borderRadius: '5px',
              color: showGenerate ? C.red : C.textDim,
              fontSize: '11px', fontWeight: 600, padding: '5px 4px',
              cursor: 'pointer', width: '96px',
            }}
          >✦ Generate</button>
        </div>

        {/* Metadata fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* Title — full width */}
          <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={form.title} onChange={set('title')} placeholder="Track title" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Artist</label>
            <input style={inputStyle} value={form.artist} onChange={set('artist')} placeholder="Artist name" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Genre</label>
            <input style={inputStyle} value={form.genre} onChange={set('genre')} placeholder="Genre" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Year</label>
            <input style={inputStyle} value={form.year} onChange={set('year')} placeholder="2026" type="number" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Track #</label>
            <input style={inputStyle} value={form.track_number} onChange={set('track_number')} placeholder="1" type="number" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Composer</label>
            <input style={inputStyle} value={form.composer} onChange={set('composer')} placeholder="Composer" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Lyrics By</label>
            <input style={inputStyle} value={form.lyrics_credit} onChange={set('lyrics_credit')} placeholder="Lyricist" />
          </div>
          {bpm !== null && (
            <div style={fieldStyle}>
              <label style={labelStyle}>BPM (auto)</label>
              <input style={{ ...inputStyle, color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }} value={bpm} readOnly />
            </div>
          )}
          {keyStr && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Key (auto)</label>
              <input style={{ ...inputStyle, color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }} value={keyStr} readOnly />
            </div>
          )}
        </div>
      </div>

      {/* Artwork generate panel */}
      {showGenerate && (
        <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(230,57,70,0.06)', borderRadius: '6px', border: `1px solid rgba(230,57,70,0.15)` }}>
          <label style={labelStyle}>Artwork prompt {track.lyrics_id ? '(pre-filled from lyrics)' : ''}</label>
          <textarea
            value={artPrompt}
            onChange={e => setArtPrompt(e.target.value)}
            placeholder="Describe the artwork…"
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />
          {genError && <div style={{ color: C.red, fontSize: '11px', marginTop: '4px' }}>{genError}</div>}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button
              onClick={() => { setShowGenerate(false); setArtPrompt(''); setGenError(null); }}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '5px', color: C.textDim, fontSize: '11px', padding: '5px 10px', cursor: 'pointer' }}
            >Cancel</button>
            <button
              onClick={generateArtwork}
              disabled={generating || !artPrompt.trim()}
              style={{
                background: C.red, border: 'none', borderRadius: '5px', color: '#fff',
                fontSize: '11px', fontWeight: 700, padding: '5px 12px', cursor: 'pointer',
                opacity: (generating || !artPrompt.trim()) ? 0.5 : 1,
              }}
            >{generating ? 'Generating…' : '✦ Generate'}</button>
          </div>
        </div>
      )}

      {/* Save / Cancel */}
      {error && <div style={{ color: C.red, fontSize: '11px', marginTop: '8px' }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '5px', color: C.textDim, fontSize: '12px', padding: '6px 14px', cursor: 'pointer' }}
        >Cancel</button>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: C.red, border: 'none', borderRadius: '5px', color: '#fff',
            fontSize: '12px', fontWeight: 700, padding: '6px 16px', cursor: 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/v4/tracks/TrackEditPanel.tsx
git commit -m "feat: TrackEditPanel — artwork, lyrics pre-fill, Apple Music metadata"
```

---

## Task 10: AlbumTab full implementation

**Files:**
- Modify: `frontend/src/components/v4/workspace/AlbumTab.tsx` (replace placeholder)

- [ ] **Step 1: Write full `AlbumTab.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { Album, MusicGeneration } from '../../../types';

export default function AlbumTab() {
  const { activeProjectId, tracks } = useWorkspace();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [albumTracks, setAlbumTracks] = useState<MusicGeneration[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editor form state
  const [form, setForm] = useState({ title: '', artist: '', year: '', genre: '', label: '' });
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [artPrompt, setArtPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrcIdx = useRef<number | null>(null);

  const selectedAlbum = albums.find(a => a.id === selectedAlbumId) ?? null;

  const loadAlbums = () => {
    if (!activeProjectId) return;
    fetch(`/api/projects/${activeProjectId}/albums`)
      .then(r => r.json())
      .then((list: Album[]) => setAlbums(list))
      .catch(() => {});
  };

  useEffect(loadAlbums, [activeProjectId]);

  const loadAlbumTracks = (albumId: string) => {
    fetch(`/api/projects/${activeProjectId}/albums/${albumId}/tracks`)
      .then(r => r.json())
      .then((list: MusicGeneration[]) => setAlbumTracks(list))
      .catch(() => {});
  };

  const selectAlbum = (album: Album) => {
    setSelectedAlbumId(album.id);
    setForm({
      title: album.title,
      artist: album.artist ?? '',
      year: album.year?.toString() ?? '',
      genre: album.genre ?? '',
      label: album.label ?? '',
    });
    setArtworkUrl(album.artwork_path ? `/api/projects/${activeProjectId}/albums/${album.id}/artwork` : null);
    setShowGenerate(false);
    loadAlbumTracks(album.id);
  };

  const createAlbum = async () => {
    if (!activeProjectId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/albums`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Album' }),
      });
      const album: Album = await res.json();
      setAlbums(prev => [album, ...prev]);
      selectAlbum(album);
    } finally { setCreating(false); }
  };

  const saveAlbum = async () => {
    if (!selectedAlbumId || !activeProjectId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || 'Untitled Album',
          artist: form.artist || null,
          year: form.year ? parseInt(form.year, 10) : null,
          genre: form.genre || null,
          label: form.label || null,
        }),
      });
      const updated: Album = await res.json();
      setAlbums(prev => prev.map(a => a.id === updated.id ? updated : a));
    } finally { setSaving(false); }
  };

  const deleteAlbum = async () => {
    if (!selectedAlbumId || !activeProjectId) return;
    if (!confirm(`Delete album "${selectedAlbum?.title}"? This cannot be undone.`)) return;
    await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}`, { method: 'DELETE' });
    setAlbums(prev => prev.filter(a => a.id !== selectedAlbumId));
    setSelectedAlbumId(null);
    setAlbumTracks([]);
  };

  const addTrack = async (musicId: string) => {
    if (!selectedAlbumId || !activeProjectId) return;
    await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId }),
    });
    loadAlbumTracks(selectedAlbumId);
  };

  const removeTrack = async (musicId: string) => {
    if (!selectedAlbumId || !activeProjectId) return;
    await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}/tracks/${musicId}`, { method: 'DELETE' });
    setAlbumTracks(prev => prev.filter(t => t.id !== musicId));
  };

  const reorder = async (newOrder: MusicGeneration[]) => {
    if (!selectedAlbumId || !activeProjectId) return;
    setAlbumTracks(newOrder);
    await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}/tracks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newOrder.map(t => t.id) }),
    });
  };

  const generateCover = async () => {
    if (!artPrompt.trim() || !activeProjectId || !selectedAlbumId) return;
    setGenerating(true);
    setGenError(null);
    try {
      const genRes = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, prompt: artPrompt.trim(), aspectRatio: '1:1', n: 1 }),
      });
      const genData = await genRes.json();
      if (!genRes.ok || genData.error) { setGenError(genData.error || 'Generation failed'); return; }

      const imageUrl = genData.imageUrls?.[0];
      if (!imageUrl) { setGenError('No image returned'); return; }

      const fetchRes = await fetch(`/api/projects/${activeProjectId}/artwork/fetch-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const fetchData = await fetchRes.json();
      if (!fetchRes.ok || !fetchData.base64) { setGenError('Failed to fetch image'); return; }

      const saveRes = await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}/artwork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: fetchData.base64 }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) { setGenError('Failed to save artwork'); return; }

      setArtworkUrl(saveData.artworkUrl + '?t=' + Date.now());
      setShowGenerate(false);
      setArtPrompt('');
    } catch { setGenError('Network error'); }
    finally { setGenerating(false); }
  };

  const tracksNotInAlbum = tracks.filter(t => !albumTracks.some(at => at.id === t.id));

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
    borderRadius: '5px', padding: '6px 10px', color: C.text, fontSize: '12px',
    outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '3px',
  };

  if (!activeProjectId) {
    return <div data-testid="album-tab" style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div data-testid="album-tab" style={{ display: 'flex', gap: '16px', height: '100%' }}>

      {/* Left: album list */}
      <div style={{ width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          onClick={createAlbum}
          disabled={creating}
          data-testid="create-album-btn"
          style={{
            background: C.red, border: 'none', borderRadius: '7px', color: '#fff',
            fontSize: '12px', fontWeight: 700, padding: '8px', cursor: 'pointer',
            opacity: creating ? 0.5 : 1,
          }}
        >+ New Album</button>

        {albums.length === 0 && (
          <div style={{ color: C.textDim, fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
            No albums yet
          </div>
        )}

        {albums.map(album => (
          <div
            key={album.id}
            role="button"
            tabIndex={0}
            data-testid={`album-item-${album.id}`}
            onClick={() => selectAlbum(album)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && selectAlbum(album)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px', borderRadius: '7px', cursor: 'pointer',
              background: selectedAlbumId === album.id ? 'rgba(230,57,70,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${selectedAlbumId === album.id ? 'rgba(230,57,70,0.3)' : C.border}`,
            }}
          >
            {album.artwork_path ? (
              <img src={`/api/projects/${activeProjectId}/albums/${album.id}/artwork`} alt="" style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>◈</div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.title}</div>
              <div style={{ fontSize: '10px', color: C.textDim }}>{album.track_count ?? 0} tracks</div>
            </div>
          </div>
        ))}
      </div>

      {/* Right: editor */}
      {selectedAlbum ? (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

          {/* Cover + fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {artworkUrl ? (
                <img src={artworkUrl} alt="Album cover" style={{ width: '120px', height: '120px', borderRadius: '8px', objectFit: 'cover', border: `1px solid ${C.border}` }} />
              ) : (
                <div style={{ width: '120px', height: '120px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: `1px dashed ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '28px', color: 'rgba(255,255,255,0.15)' }}>◈</span>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>No Cover</span>
                </div>
              )}
              <button
                onClick={() => setShowGenerate(v => !v)}
                style={{
                  background: showGenerate ? 'rgba(230,57,70,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${showGenerate ? 'rgba(230,57,70,0.3)' : C.border}`,
                  borderRadius: '5px', color: showGenerate ? C.red : C.textDim,
                  fontSize: '11px', fontWeight: 600, padding: '5px', cursor: 'pointer',
                }}
              >✦ Generate Cover</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Album Title</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Album title" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Artist</label>
                  <input style={inputStyle} value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} placeholder="Artist" />
                </div>
                <div>
                  <label style={labelStyle}>Year</label>
                  <input style={inputStyle} value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2026" type="number" />
                </div>
                <div>
                  <label style={labelStyle}>Genre</label>
                  <input style={inputStyle} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="Genre" />
                </div>
                <div>
                  <label style={labelStyle}>Label</label>
                  <input style={inputStyle} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
            </div>
          </div>

          {/* Artwork generate panel */}
          {showGenerate && (
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: '7px' }}>
              <label style={labelStyle}>Cover art prompt</label>
              <textarea
                value={artPrompt}
                onChange={e => setArtPrompt(e.target.value)}
                placeholder="Describe the album cover…"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
              {genError && <div style={{ color: C.red, fontSize: '11px', marginTop: '4px' }}>{genError}</div>}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button onClick={() => { setShowGenerate(false); setArtPrompt(''); setGenError(null); }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '5px', color: C.textDim, fontSize: '11px', padding: '5px 10px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={generateCover} disabled={generating || !artPrompt.trim()} style={{ background: C.red, border: 'none', borderRadius: '5px', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '5px 12px', cursor: 'pointer', opacity: (generating || !artPrompt.trim()) ? 0.5 : 1 }}>{generating ? 'Generating…' : '✦ Generate'}</button>
              </div>
            </div>
          )}

          {/* Tracklist */}
          <div>
            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: '8px' }}>
              Tracklist — drag to reorder
            </div>

            {albumTracks.map((t, idx) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => { dragSrcIdx.current = idx; }}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={() => {
                  setDragOverIdx(null);
                  if (dragSrcIdx.current === null || dragSrcIdx.current === idx) return;
                  const next = [...albumTracks];
                  const [moved] = next.splice(dragSrcIdx.current, 1);
                  next.splice(idx, 0, moved);
                  dragSrcIdx.current = null;
                  reorder(next);
                }}
                onDragEnd={() => { dragSrcIdx.current = null; setDragOverIdx(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 8px', borderRadius: '6px', marginBottom: '4px',
                  background: dragOverIdx === idx ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${dragOverIdx === idx ? 'rgba(230,57,70,0.2)' : C.border}`,
                  cursor: 'grab',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', userSelect: 'none' }}>⠿</span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', width: '16px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: '12px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title || `Track v${t.version}`}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
                  {t.duration_seconds ? `${Math.floor(t.duration_seconds / 60)}:${String(Math.floor(t.duration_seconds % 60)).padStart(2, '0')}` : '—'}
                </span>
                <button
                  onClick={() => removeTrack(t.id)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1 }}
                  onMouseOver={e => (e.currentTarget.style.color = C.red)}
                  onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                >✕</button>
              </div>
            ))}

            {/* Add track dropdown */}
            {tracksNotInAlbum.length > 0 && (
              <select
                onChange={e => { if (e.target.value) { addTrack(e.target.value); e.target.value = ''; } }}
                defaultValue=""
                style={{ ...inputStyle, marginTop: '4px', cursor: 'pointer' }}
              >
                <option value="">+ Add track from project…</option>
                {tracksNotInAlbum.map(t => (
                  <option key={t.id} value={t.id}>{t.title || `Track v${t.version}`}</option>
                ))}
              </select>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
            <button
              onClick={deleteAlbum}
              style={{ background: 'none', border: `1px solid rgba(230,57,70,0.3)`, borderRadius: '6px', color: C.red, fontSize: '12px', padding: '7px 14px', cursor: 'pointer' }}
            >Delete Album</button>
            <button
              onClick={saveAlbum}
              disabled={saving}
              data-testid="save-album-btn"
              style={{ background: C.red, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '7px 20px', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
            >{saving ? 'Saving…' : 'Save Album'}</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontSize: '13px' }}>
          Select an album or create a new one
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/v4/workspace/AlbumTab.tsx
git commit -m "feat: AlbumTab — album list, editor, tracklist drag-reorder, cover art generation"
```

---

## Task 11: Backend integration tests

**Files:**
- Create: `backend/tests/integration/album.test.js`

- [ ] **Step 1: Write `backend/tests/integration/album.test.js`**

```js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const API = 'http://localhost:3000';
let projectId;
let musicId;
let albumId;

before(async () => {
  // Create project
  const p = await fetch(`${API}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'ALBUM_TEST_' + Date.now() }),
  });
  const proj = await p.json();
  projectId = proj.id;

  // Seed a track via test route
  const t = await fetch(`${API}/api/test/seed-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
  const seeded = await t.json();
  musicId = seeded.musicId ?? seeded.tracks?.[0]?.id;
});

after(async () => {
  await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' });
});

describe('PATCH /api/music/:id — metadata fields', () => {
  it('saves artist/genre/year/track_number/composer/lyrics_credit', async () => {
    const res = await fetch(`${API}/api/music/${musicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artist: 'RedInside',
        genre: 'Desi Hip-Hop',
        year: 2026,
        track_number: 1,
        composer: 'Test Composer',
        lyrics_credit: 'Test Lyricist',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.artist, 'RedInside');
    assert.equal(data.genre, 'Desi Hip-Hop');
    assert.equal(data.year, 2026);
    assert.equal(data.track_number, 1);
    assert.equal(data.composer, 'Test Composer');
    assert.equal(data.lyrics_credit, 'Test Lyricist');
  });
});

describe('Album CRUD', () => {
  it('POST /api/projects/:id/albums creates album', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dil Se EP', artist: 'RedInside', year: 2026 }),
    });
    assert.equal(res.status, 201);
    const album = await res.json();
    albumId = album.id;
    assert.equal(album.title, 'Dil Se EP');
    assert.equal(album.artist, 'RedInside');
    assert.equal(album.year, 2026);
  });

  it('GET /api/projects/:id/albums lists albums', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums`);
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    assert.ok(list.some(a => a.id === albumId));
  });

  it('PUT /api/projects/:id/albums/:albumId updates album', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dil Se EP Vol.2', genre: 'Desi Hip-Hop' }),
    });
    assert.equal(res.status, 200);
    const album = await res.json();
    assert.equal(album.title, 'Dil Se EP Vol.2');
    assert.equal(album.genre, 'Desi Hip-Hop');
  });

  it('POST .../tracks adds track to album', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId }),
    });
    assert.equal(res.status, 201);
    const tracks = await res.json();
    assert.ok(Array.isArray(tracks));
    assert.ok(tracks.some(t => t.id === musicId));
  });

  it('GET .../tracks lists album tracks', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks`);
    assert.equal(res.status, 200);
    const tracks = await res.json();
    assert.ok(tracks.some(t => t.id === musicId));
  });

  it('PUT .../tracks/reorder reorders tracks', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: [musicId] }),
    });
    assert.equal(res.status, 200);
  });

  it('DELETE .../tracks/:musicId removes track', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks/${musicId}`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    const tracks = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks`).then(r => r.json());
    assert.ok(!tracks.some((t: { id: string }) => t.id === musicId));
  });

  it('DELETE /api/projects/:id/albums/:albumId deletes album', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    const list = await fetch(`${API}/api/projects/${projectId}/albums`).then(r => r.json());
    assert.ok(!list.some((a: { id: string }) => a.id === albumId));
  });

  it('returns 404 for nonexistent album', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/fake-id`);
    // Not found on GET tracks
    const res2 = await fetch(`${API}/api/projects/${projectId}/albums/fake-id/tracks`);
    assert.equal(res2.status, 404);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd backend && npm test -- --test-name-pattern="Album|metadata"
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/album.test.js
git commit -m "test: album CRUD and metadata PATCH integration tests"
```

---

## Task 12: Frontend E2E tests

**Files:**
- Create: `frontend/tests/e2e/v4-album.spec.ts`

- [ ] **Step 1: Write `frontend/tests/e2e/v4-album.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000';

async function seedProject(request: Parameters<typeof test>[1] extends (args: { request: infer R }) => unknown ? R : never, name = 'ALBUM_E2E') {
  const res = await request.post(`${API}/api/projects`, {
    data: { name: `${name}_${Date.now()}` },
  });
  const proj = await res.json();
  const seedRes = await request.post(`${API}/api/test/seed-project`, {
    data: { projectId: proj.id },
  });
  const seeded = await seedRes.json();
  return { projectId: proj.id, musicId: seeded.musicId ?? seeded.tracks?.[0]?.id };
}

test.describe('Album tab', () => {
  let projectId: string;

  test.beforeEach(async ({ request, page }) => {
    const data = await seedProject(request);
    projectId = data.projectId;
    await page.goto('/');
    await page.locator(`[data-testid="project-item-${projectId}"]`).click();
    await page.locator('[data-testid="tab-album"]').click();
    await expect(page.locator('[data-testid="album-tab"]')).toBeVisible({ timeout: 8000 });
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`${API}/api/projects/${projectId}`);
  });

  test('album tab is visible and shows no albums initially', async ({ page }) => {
    await expect(page.locator('[data-testid="album-tab"]')).toContainText('No albums yet');
  });

  test('can create a new album', async ({ page }) => {
    await page.locator('[data-testid="create-album-btn"]').click();
    await expect(page.locator('[data-testid="save-album-btn"]')).toBeVisible({ timeout: 5000 });
  });

  test('can save album with title and artist', async ({ page }) => {
    await page.locator('[data-testid="create-album-btn"]').click();
    await page.locator('[data-testid="save-album-btn"]').waitFor({ timeout: 5000 });

    // Fill in title
    const titleInput = page.locator('input[placeholder="Album title"]');
    await titleInput.fill('Dil Se EP');

    const artistInput = page.locator('input[placeholder="Artist"]');
    await artistInput.fill('RedInside');

    await page.locator('[data-testid="save-album-btn"]').click();

    // Album should appear in sidebar
    await expect(page.locator('[data-testid="album-tab"]')).toContainText('Dil Se EP', { timeout: 5000 });
  });
});

test.describe('Track inline edit panel', () => {
  let projectId: string;

  test.beforeEach(async ({ request, page }) => {
    const data = await seedProject(request, 'TRACK_EDIT_E2E');
    projectId = data.projectId;
    await page.goto('/');
    await page.locator(`[data-testid="project-item-${projectId}"]`).click();
    await page.locator('[data-testid="tab-sounds"]').click();
    await expect(page.locator('[data-testid="sounds-tab"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="track-list"]')).toBeVisible();
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`${API}/api/projects/${projectId}`);
  });

  test('edit button opens inline panel', async ({ page }) => {
    // Click the ✎ button on first track row
    const editBtn = page.locator('[data-testid="track-list"] button[title="Edit track metadata"]').first();
    await editBtn.click();
    await expect(page.locator('input[placeholder="Artist name"]')).toBeVisible({ timeout: 5000 });
  });

  test('can save artist and genre metadata', async ({ page }) => {
    const editBtn = page.locator('[data-testid="track-list"] button[title="Edit track metadata"]').first();
    await editBtn.click();

    await page.locator('input[placeholder="Artist name"]').fill('RedInside');
    await page.locator('input[placeholder="Genre"]').fill('Desi Hip-Hop');

    await page.locator('button:has-text("Save")').last().click();

    // Panel should close after save
    await expect(page.locator('input[placeholder="Artist name"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('closing edit panel hides it', async ({ page }) => {
    const editBtn = page.locator('[data-testid="track-list"] button[title="Edit track metadata"]').first();
    await editBtn.click();
    await expect(page.locator('input[placeholder="Artist name"]')).toBeVisible({ timeout: 5000 });

    await page.locator('button:has-text("Cancel")').last().click();
    await expect(page.locator('input[placeholder="Artist name"]')).not.toBeVisible({ timeout: 3000 });
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
cd frontend && npx playwright test tests/e2e/v4-album.spec.ts --timeout=30000
```

Expected: all tests pass.

- [ ] **Step 3: Run the full E2E suite to check for regressions**

```bash
cd frontend && npx playwright test --timeout=30000
```

Expected: all tests pass (or pre-existing flakes only).

- [ ] **Step 4: Commit**

```bash
git add frontend/tests/e2e/v4-album.spec.ts
git commit -m "test: E2E tests for album tab and track inline edit panel"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Migration 018 (per-song metadata columns) — Task 1
- ✅ Migration 019/020 (albums + album_tracks) — Task 2
- ✅ PATCH /api/music/:id extended with new fields — Task 3
- ✅ Album CRUD routes — Task 4
- ✅ Album artwork endpoint — Task 5
- ✅ Tab renamed CREATE → ALBUM, V4Tab type updated — Task 6
- ✅ Video moved to Release, Voice moved to Craft — Task 7
- ✅ TrackRow ✎ button — Task 8
- ✅ TrackEditPanel (artwork, lyrics pre-fill, all metadata fields) — Task 9
- ✅ AlbumTab (list, editor, tracklist drag, cover art) — Task 10
- ✅ Backend integration tests — Task 11
- ✅ Frontend E2E tests — Task 12

**Placeholder scan:** None found — every step has actual code.

**Type consistency:**
- `Album` interface defined in Task 6, used in Task 10 — fields match
- `MusicGeneration` new fields defined in Task 6, consumed by TrackEditPanel in Task 9 — field names match (`artist`, `genre`, `year`, `track_number`, `composer`, `lyrics_credit`)
- Backend uses camelCase internally (`trackNumber`, `lyricsCredit`) → snake_case in DB (`track_number`, `lyrics_credit`) — controller maps in Task 3
- `artworkUrl` returned from `/api/projects/:id/artwork` endpoint — already in existing backend, used in Task 9
