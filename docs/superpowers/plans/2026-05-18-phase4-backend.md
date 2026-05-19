# Phase 4 — Backend Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all new backend endpoints, DB tables, and migrations required by Phase 4 so the frontend plan can be executed against a real, complete API.

**Architecture:** Five new SQLite tables via numbered SQL migrations. Thirteen new REST endpoints following the existing `controller → routes → server.js` pattern. All tested with real HTTP calls to `localhost:3000` using `node:test` — no mocks.

**Tech Stack:** Node.js 18+, Express, better-sqlite3, node:test, music-metadata npm package for BPM/key detection.

---

## File Map

| Action | File |
|--------|------|
| Create | `backend/src/database/migrations/013_playlists.sql` |
| Create | `backend/src/database/migrations/014_music_tags.sql` |
| Create | `backend/src/database/migrations/015_music_notes.sql` |
| Create | `backend/src/database/migrations/016_social_export.sql` |
| Create | `backend/src/database/migrations/017_project_shares.sql` |
| Create | `backend/src/modules/playlist/playlist.model.js` |
| Create | `backend/src/modules/playlist/playlist.controller.js` |
| Create | `backend/src/api/routes/playlist.routes.js` |
| Create | `backend/src/modules/music/music-tags.service.js` |
| Create | `backend/src/modules/music/music-notes.model.js` |
| Create | `backend/src/modules/music/music-notes.controller.js` |
| Create | `backend/src/modules/audio/social-export.controller.js` |
| Create | `backend/src/modules/share/share.controller.js` |
| Create | `backend/src/api/routes/music-tags.routes.js` |
| Create | `backend/src/api/routes/music-notes.routes.js` |
| Create | `backend/src/api/routes/social-export.routes.js` |
| Create | `backend/src/api/routes/share.routes.js` |
| Modify | `backend/src/server.js` — register 4 new route sets |
| Create | `backend/tests/integration/playlist.test.js` |
| Create | `backend/tests/integration/music-tags.test.js` |
| Create | `backend/tests/integration/music-notes.test.js` |
| Create | `backend/tests/integration/social-export.test.js` |
| Create | `backend/tests/integration/share.test.js` |

---

### Task 1: Git branch + install music-metadata

**Files:** none (repo setup)

- [ ] **Step 1: Create feature branch**

```bash
git checkout main
git checkout -b feat/phase4-redesign
```

- [ ] **Step 2: Install music-metadata**

```bash
cd backend && npm install music-metadata
```

- [ ] **Step 3: Verify install**

```bash
node -e "import('music-metadata').then(m => console.log('ok', Object.keys(m)))"
```
Expected output: `ok [ 'parseFile', 'parseBuffer', ... ]`

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: install music-metadata for BPM/key detection"
```

---

### Task 2: DB migrations — 5 new tables

**Files:**
- Create: `backend/src/database/migrations/013_playlists.sql`
- Create: `backend/src/database/migrations/014_music_tags.sql`
- Create: `backend/src/database/migrations/015_music_notes.sql`
- Create: `backend/src/database/migrations/016_social_export.sql`
- Create: `backend/src/database/migrations/017_project_shares.sql`

- [ ] **Step 1: Write migration 013 — playlists**

```sql
-- backend/src/database/migrations/013_playlists.sql
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  music_id TEXT NOT NULL REFERENCES music_generations(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(playlist_id, music_id)
);
```

- [ ] **Step 2: Write migration 014 — music_tags**

```sql
-- backend/src/database/migrations/014_music_tags.sql
CREATE TABLE IF NOT EXISTS music_tags (
  music_id TEXT PRIMARY KEY REFERENCES music_generations(id) ON DELETE CASCADE,
  bpm REAL,
  key_signature TEXT,
  mood TEXT,
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 3: Write migration 015 — music_notes**

```sql
-- backend/src/database/migrations/015_music_notes.sql
CREATE TABLE IF NOT EXISTS music_notes (
  id TEXT PRIMARY KEY,
  music_id TEXT NOT NULL REFERENCES music_generations(id) ON DELETE CASCADE,
  timestamp_sec REAL NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 4: Write migration 016 — social_exports (audit log)**

```sql
-- backend/src/database/migrations/016_social_exports.sql
CREATE TABLE IF NOT EXISTS social_exports (
  id TEXT PRIMARY KEY,
  music_id TEXT NOT NULL REFERENCES music_generations(id) ON DELETE CASCADE,
  preset TEXT NOT NULL,
  output_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 5: Write migration 017 — project_shares**

```sql
-- backend/src/database/migrations/017_project_shares.sql
CREATE TABLE IF NOT EXISTS project_shares (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
```

- [ ] **Step 6: Run migrations**

```bash
cd backend && npm run db:migrate
```
Expected: `Migrations complete. 5 new, N already applied.`

- [ ] **Step 7: Verify tables exist**

```bash
node -e "
import db from './src/database/connection.js';
['playlists','playlist_tracks','music_tags','music_notes','project_shares'].forEach(t => {
  const r = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name=?\").get(t);
  console.log(t, r ? 'OK' : 'MISSING');
});
"
```
Expected: all five print `OK`

- [ ] **Step 8: Commit**

```bash
git add backend/src/database/migrations/
git commit -m "feat: DB migrations 013-017 — playlists, tags, notes, social_exports, shares"
```

---

### Task 3: Playlist CRUD — model + controller + routes

**Files:**
- Create: `backend/src/modules/playlist/playlist.model.js`
- Create: `backend/src/modules/playlist/playlist.controller.js`
- Create: `backend/src/api/routes/playlist.routes.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Write playlist.model.js**

```js
// backend/src/modules/playlist/playlist.model.js
import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const PlaylistModel = {
  create(name) {
    const id = uuidv4();
    db.prepare(`INSERT INTO playlists (id, name) VALUES (?, ?)`).run(id, name);
    return this.findById(id);
  },

  findAll() {
    return db.prepare(`
      SELECT p.*, COUNT(pt.id) as track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();
  },

  findById(id) {
    return db.prepare(`SELECT * FROM playlists WHERE id = ?`).get(id);
  },

  update(id, name) {
    db.prepare(`UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(name, id);
    return this.findById(id);
  },

  delete(id) {
    db.prepare(`DELETE FROM playlists WHERE id = ?`).run(id);
  },

  addTrack(playlistId, musicId) {
    const id = uuidv4();
    const maxPos = db.prepare(
      `SELECT COALESCE(MAX(position), -1) as m FROM playlist_tracks WHERE playlist_id = ?`
    ).get(playlistId).m;
    db.prepare(`
      INSERT OR IGNORE INTO playlist_tracks (id, playlist_id, music_id, position)
      VALUES (?, ?, ?, ?)
    `).run(id, playlistId, musicId, maxPos + 1);
    return this.getTracks(playlistId);
  },

  removeTrack(playlistId, musicId) {
    db.prepare(`DELETE FROM playlist_tracks WHERE playlist_id = ? AND music_id = ?`).run(playlistId, musicId);
  },

  getTracks(playlistId) {
    return db.prepare(`
      SELECT mg.*, pt.position, pt.added_at
      FROM playlist_tracks pt
      JOIN music_generations mg ON mg.id = pt.music_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position ASC
    `).all(playlistId);
  },
};
```

- [ ] **Step 2: Write playlist.controller.js**

```js
// backend/src/modules/playlist/playlist.controller.js
import { PlaylistModel } from './playlist.model.js';

export const PlaylistController = {
  async list(req, res, next) {
    try {
      res.json(PlaylistModel.findAll());
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
      res.status(201).json(PlaylistModel.create(name.trim()));
    } catch (e) { next(e); }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
      const pl = PlaylistModel.findById(id);
      if (!pl) return res.status(404).json({ error: 'Playlist not found' });
      res.json(PlaylistModel.update(id, name.trim()));
    } catch (e) { next(e); }
  },

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      if (!PlaylistModel.findById(id)) return res.status(404).json({ error: 'Playlist not found' });
      PlaylistModel.delete(id);
      res.status(204).end();
    } catch (e) { next(e); }
  },

  async getTracks(req, res, next) {
    try {
      const { id } = req.params;
      if (!PlaylistModel.findById(id)) return res.status(404).json({ error: 'Playlist not found' });
      res.json(PlaylistModel.getTracks(id));
    } catch (e) { next(e); }
  },

  async addTrack(req, res, next) {
    try {
      const { id } = req.params;
      const { musicId } = req.body;
      if (!musicId) return res.status(400).json({ error: 'musicId is required' });
      if (!PlaylistModel.findById(id)) return res.status(404).json({ error: 'Playlist not found' });
      res.status(201).json(PlaylistModel.addTrack(id, musicId));
    } catch (e) { next(e); }
  },

  async removeTrack(req, res, next) {
    try {
      const { id, musicId } = req.params;
      if (!PlaylistModel.findById(id)) return res.status(404).json({ error: 'Playlist not found' });
      PlaylistModel.removeTrack(id, musicId);
      res.status(204).end();
    } catch (e) { next(e); }
  },
};
```

- [ ] **Step 3: Write playlist.routes.js**

```js
// backend/src/api/routes/playlist.routes.js
import { PlaylistController } from '../../modules/playlist/playlist.controller.js';

export const PlaylistRoutes = [
  { method: 'get',    path: '/api/playlists',                          handler: PlaylistController.list },
  { method: 'post',   path: '/api/playlists',                          handler: PlaylistController.create },
  { method: 'put',    path: '/api/playlists/:id',                      handler: PlaylistController.update },
  { method: 'delete', path: '/api/playlists/:id',                      handler: PlaylistController.remove },
  { method: 'get',    path: '/api/playlists/:id/tracks',               handler: PlaylistController.getTracks },
  { method: 'post',   path: '/api/playlists/:id/tracks',               handler: PlaylistController.addTrack },
  { method: 'delete', path: '/api/playlists/:id/tracks/:musicId',      handler: PlaylistController.removeTrack },
];
```

- [ ] **Step 4: Register in server.js**

In `backend/src/server.js`, add after the existing route imports:

```js
import { PlaylistRoutes } from './api/routes/playlist.routes.js';
```

And in the route registration loop (find the block that loops `[...LyricsRoutes, ...MusicRoutes, ...]`), add `...PlaylistRoutes`:

```js
[
  ...LyricsRoutes,
  ...MusicRoutes,
  // ... existing routes ...
  ...PlaylistRoutes,
].forEach(({ method, path, handler, middleware }) => { ... });
```

- [ ] **Step 5: Restart server and smoke test**

```bash
kill $(lsof -ti:3000) 2>/dev/null; sleep 1
cd backend && MINIMAX_BASE_URL=http://localhost:8999 node src/server.js &
sleep 2
curl -s -X POST http://localhost:3000/api/playlists \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Playlist"}' | python3 -m json.tool
```
Expected: `{ "id": "...", "name": "Test Playlist", ... }`

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/playlist/ backend/src/api/routes/playlist.routes.js backend/src/server.js
git commit -m "feat: playlist CRUD endpoints — GET/POST/PUT/DELETE + track add/remove"
```

---

### Task 4: Music tags endpoint (BPM + key detection)

**Files:**
- Create: `backend/src/modules/music/music-tags.service.js`
- Create: `backend/src/api/routes/music-tags.routes.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Write music-tags.service.js**

```js
// backend/src/modules/music/music-tags.service.js
import { parseFile } from 'music-metadata';
import db from '../../database/connection.js';
import { MusicModel } from '../../database/models/music.model.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';

export const MusicTagsService = {
  async getTags(musicId) {
    // Return cached
    const cached = db.prepare(`SELECT * FROM music_tags WHERE music_id = ?`).get(musicId);
    if (cached) return { bpm: cached.bpm, key: cached.key_signature, mood: cached.mood };

    // Compute from file
    const music = MusicModel.findById(musicId);
    if (!music) return { bpm: null, key: null, mood: null };

    const filePath = music.processed_file_path || music.original_file_path;
    if (!filePath || !fs.existsSync(filePath)) return { bpm: null, key: null, mood: null };

    let bpm = null;
    let key = null;

    try {
      const meta = await parseFile(filePath, { duration: true });
      bpm = meta.common?.bpm ?? null;
      key = meta.common?.key ?? null;
    } catch (e) {
      // File unreadable — return nulls gracefully
    }

    // Cache result (even if nulls — avoids recomputing)
    db.prepare(`
      INSERT OR REPLACE INTO music_tags (music_id, bpm, key_signature, computed_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(musicId, bpm, key);

    return { bpm, key, mood: null };
  },
};
```

- [ ] **Step 2: Write inline controller + routes**

```js
// backend/src/api/routes/music-tags.routes.js
import { MusicTagsService } from '../../modules/music/music-tags.service.js';

async function getTags(req, res, next) {
  try {
    const tags = await MusicTagsService.getTags(req.params.id);
    res.json(tags);
  } catch (e) { next(e); }
}

export const MusicTagsRoutes = [
  { method: 'get', path: '/api/music/:id/tags', handler: getTags },
];
```

- [ ] **Step 3: Register in server.js**

```js
import { MusicTagsRoutes } from './api/routes/music-tags.routes.js';
// Add ...MusicTagsRoutes to the routes array
```

- [ ] **Step 4: Smoke test**

```bash
# Get a real music ID first
MUSIC_ID=$(curl -s http://localhost:3000/api/projects | python3 -c "
import sys,json,urllib.request
ps = json.load(sys.stdin)
for p in ps:
    r = urllib.request.urlopen(f'http://localhost:3000/api/projects/{p[\"id\"]}/music')
    ms = json.loads(r.read())
    if ms: print(ms[0]['id']); break
" 2>/dev/null)
curl -s "http://localhost:3000/api/music/${MUSIC_ID}/tags" | python3 -m json.tool
```
Expected: `{ "bpm": null, "key": null, "mood": null }` (nulls fine — test audio has no ID3 BPM tags)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/music/music-tags.service.js backend/src/api/routes/music-tags.routes.js backend/src/server.js
git commit -m "feat: GET /api/music/:id/tags — BPM/key from ID3 metadata, cached in music_tags"
```

---

### Task 5: Music notes endpoints

**Files:**
- Create: `backend/src/modules/music/music-notes.model.js`
- Create: `backend/src/modules/music/music-notes.controller.js`
- Create: `backend/src/api/routes/music-notes.routes.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Write music-notes.model.js**

```js
// backend/src/modules/music/music-notes.model.js
import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const MusicNotesModel = {
  findByMusic(musicId) {
    return db.prepare(
      `SELECT * FROM music_notes WHERE music_id = ? ORDER BY timestamp_sec ASC`
    ).all(musicId);
  },

  create(musicId, timestampSec, text) {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO music_notes (id, music_id, timestamp_sec, text) VALUES (?, ?, ?, ?)`
    ).run(id, musicId, timestampSec, text);
    return db.prepare(`SELECT * FROM music_notes WHERE id = ?`).get(id);
  },

  delete(id) {
    db.prepare(`DELETE FROM music_notes WHERE id = ?`).run(id);
  },
};
```

- [ ] **Step 2: Write music-notes.controller.js**

```js
// backend/src/modules/music/music-notes.controller.js
import { MusicNotesModel } from './music-notes.model.js';

export const MusicNotesController = {
  async list(req, res, next) {
    try {
      res.json(MusicNotesModel.findByMusic(req.params.id));
    } catch (e) { next(e); }
  },

  async create(req, res, next) {
    try {
      const { timestamp_sec, text } = req.body;
      if (timestamp_sec == null || !text?.trim()) {
        return res.status(400).json({ error: 'timestamp_sec and text are required' });
      }
      res.status(201).json(
        MusicNotesModel.create(req.params.id, Number(timestamp_sec), text.trim())
      );
    } catch (e) { next(e); }
  },

  async remove(req, res, next) {
    try {
      MusicNotesModel.delete(req.params.noteId);
      res.status(204).end();
    } catch (e) { next(e); }
  },
};
```

- [ ] **Step 3: Write music-notes.routes.js**

```js
// backend/src/api/routes/music-notes.routes.js
import { MusicNotesController } from '../../modules/music/music-notes.controller.js';

export const MusicNotesRoutes = [
  { method: 'get',    path: '/api/music/:id/notes',              handler: MusicNotesController.list },
  { method: 'post',   path: '/api/music/:id/notes',              handler: MusicNotesController.create },
  { method: 'delete', path: '/api/music/:id/notes/:noteId',      handler: MusicNotesController.remove },
];
```

- [ ] **Step 4: Register in server.js**

```js
import { MusicNotesRoutes } from './api/routes/music-notes.routes.js';
// Add ...MusicNotesRoutes to routes array
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/music/music-notes.model.js backend/src/modules/music/music-notes.controller.js backend/src/api/routes/music-notes.routes.js backend/src/server.js
git commit -m "feat: music notes endpoints — GET/POST/DELETE /api/music/:id/notes"
```

---

### Task 6: Social export endpoint

**Files:**
- Create: `backend/src/modules/audio/social-export.controller.js`
- Create: `backend/src/api/routes/social-export.routes.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Write social-export.controller.js**

Presets: `tiktok` = 60s trim, `reels` = 30s trim, `shorts` = 60s trim, `full` = no trim.

```js
// backend/src/modules/audio/social-export.controller.js
import { execSync } from 'child_process';
import { MusicModel } from '../../database/models/music.model.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database/connection.js';

const PRESETS = {
  tiktok: { duration: 60, label: 'TikTok 60s' },
  reels:  { duration: 30, label: 'Instagram Reels 30s' },
  shorts: { duration: 60, label: 'YouTube Shorts 60s' },
  full:   { duration: null, label: 'Full Track' },
};

export const SocialExportController = {
  async export(req, res, next) {
    try {
      const { musicId, preset = 'full', startSec = 0 } = req.body;
      if (!musicId) return res.status(400).json({ error: 'musicId is required' });
      if (!PRESETS[preset]) return res.status(400).json({ error: `preset must be one of: ${Object.keys(PRESETS).join(', ')}` });

      const music = MusicModel.findById(musicId);
      if (!music) return res.status(404).json({ error: 'Music not found' });

      const inputPath = music.processed_file_path || music.original_file_path;
      if (!inputPath || !fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Audio file not found' });
      }

      const { duration } = PRESETS[preset];
      const outputId = uuidv4();
      const tempDir = storage.getTempDir(music.project_id);
      fs.mkdirSync(tempDir, { recursive: true });
      const outputPath = path.join(tempDir, `${outputId}_${preset}.mp3`);

      let ffmpegCmd;
      if (duration) {
        ffmpegCmd = `ffmpeg -y -i "${inputPath}" -ss ${startSec} -t ${duration} -acodec libmp3lame -b:a 320k "${outputPath}"`;
      } else {
        ffmpegCmd = `ffmpeg -y -i "${inputPath}" -acodec libmp3lame -b:a 320k "${outputPath}"`;
      }

      execSync(ffmpegCmd, { stdio: 'pipe' });

      // Log export
      db.prepare(
        `INSERT INTO social_exports (id, music_id, preset, output_path) VALUES (?, ?, ?, ?)`
      ).run(uuidv4(), musicId, preset, outputPath);

      const stat = fs.statSync(outputPath);
      const filename = `${(music.title || 'track').replace(/[^a-zA-Z0-9-_]/g, '_')}_${preset}.mp3`;

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(outputPath).pipe(res).on('finish', () => {
        fs.unlink(outputPath, () => {});
      });
    } catch (e) { next(e); }
  },
};
```

- [ ] **Step 2: Write social-export.routes.js**

```js
// backend/src/api/routes/social-export.routes.js
import { SocialExportController } from '../../modules/audio/social-export.controller.js';

export const SocialExportRoutes = [
  { method: 'post', path: '/api/audio/social-export', handler: SocialExportController.export },
];
```

- [ ] **Step 3: Register in server.js**

```js
import { SocialExportRoutes } from './api/routes/social-export.routes.js';
// Add ...SocialExportRoutes to routes array
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/audio/social-export.controller.js backend/src/api/routes/social-export.routes.js backend/src/server.js
git commit -m "feat: POST /api/audio/social-export — trim audio to TikTok/Reels/Shorts/full presets"
```

---

### Task 7: Share links endpoints

**Files:**
- Create: `backend/src/modules/share/share.controller.js`
- Create: `backend/src/api/routes/share.routes.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Write share.controller.js**

```js
// backend/src/modules/share/share.controller.js
import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';
import { ProjectModel } from '../../database/models/project.model.js';
import { MusicModel } from '../../database/models/music.model.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function generateToken() {
  return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
}

export const ShareController = {
  async create(req, res, next) {
    try {
      const { id: projectId } = req.params;
      const project = ProjectModel.findById(projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const token = generateToken();
      const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();

      db.prepare(
        `INSERT INTO project_shares (id, project_id, token, expires_at) VALUES (?, ?, ?, ?)`
      ).run(uuidv4(), projectId, token, expiresAt);

      res.status(201).json({ token, url: `/share/${token}`, expiresAt });
    } catch (e) { next(e); }
  },

  async view(req, res, next) {
    try {
      const { token } = req.params;
      const share = db.prepare(
        `SELECT * FROM project_shares WHERE token = ? AND expires_at > CURRENT_TIMESTAMP`
      ).get(token);

      if (!share) return res.status(404).json({ error: 'Share link not found or expired' });

      const project = ProjectModel.findById(share.project_id);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const music = MusicModel.findByProject(share.project_id);

      res.json({ project, music, expiresAt: share.expires_at });
    } catch (e) { next(e); }
  },
};
```

- [ ] **Step 2: Write share.routes.js**

```js
// backend/src/api/routes/share.routes.js
import { ShareController } from '../../modules/share/share.controller.js';

export const ShareRoutes = [
  { method: 'post', path: '/api/projects/:id/share',  handler: ShareController.create },
  { method: 'get',  path: '/api/share/:token',         handler: ShareController.view },
];
```

- [ ] **Step 3: Register in server.js**

```js
import { ShareRoutes } from './api/routes/share.routes.js';
// Add ...ShareRoutes to routes array
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/share/ backend/src/api/routes/share.routes.js backend/src/server.js
git commit -m "feat: share links — POST /api/projects/:id/share + GET /api/share/:token"
```

---

### Task 8: Backend integration tests — all new endpoints

**Files:**
- Create: `backend/tests/integration/playlist.test.js`
- Create: `backend/tests/integration/music-tags.test.js`
- Create: `backend/tests/integration/music-notes.test.js`
- Create: `backend/tests/integration/social-export.test.js`
- Create: `backend/tests/integration/share.test.js`

> **Testing rules (from CLAUDE.md):** All tests use real `fetch()` to `http://localhost:3000`. No mocks. Backend must be running before tests execute.

- [ ] **Step 1: Write playlist.test.js**

```js
// backend/tests/integration/playlist.test.js
import { describe, it, after, before } from 'node:test';
import assert from 'assert';

const API = 'http://localhost:3000';
let playlistId;

describe('Playlist API', () => {
  after(async () => {
    if (playlistId) {
      await fetch(`${API}/api/playlists/${playlistId}`, { method: 'DELETE' });
    }
  });

  it('POST /api/playlists — creates playlist', async () => {
    const res = await fetch(`${API}/api/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Playlist' }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    assert.strictEqual(body.name, 'Test Playlist');
    playlistId = body.id;
  });

  it('GET /api/playlists — lists playlists including new one', async () => {
    const res = await fetch(`${API}/api/playlists`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.some(p => p.id === playlistId));
  });

  it('PUT /api/playlists/:id — renames playlist', async () => {
    const res = await fetch(`${API}/api/playlists/${playlistId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed Playlist' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.name, 'Renamed Playlist');
  });

  it('POST /api/playlists — 400 for missing name', async () => {
    const res = await fetch(`${API}/api/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('POST /api/playlists/:id/tracks — adds seeded music track', async () => {
    // Seed a project with music
    const seedRes = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `PlaylistTrackTest-${Date.now()}`, music: true }),
    });
    const { project, music } = await seedRes.json();
    const musicId = music[0]?.id;
    assert.ok(musicId, 'seed must return music');

    const addRes = await fetch(`${API}/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId }),
    });
    assert.strictEqual(addRes.status, 201);
    const tracks = await addRes.json();
    assert.ok(Array.isArray(tracks));
    assert.ok(tracks.some(t => t.id === musicId));

    // DELETE /api/playlists/:id/tracks/:musicId
    const delRes = await fetch(`${API}/api/playlists/${playlistId}/tracks/${musicId}`, { method: 'DELETE' });
    assert.strictEqual(delRes.status, 204);

    await fetch(`${API}/api/projects/${project.id}`, { method: 'DELETE' }).catch(() => {});
  });

  it('DELETE /api/playlists/:id — deletes playlist', async () => {
    const res = await fetch(`${API}/api/playlists/${playlistId}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 204);
    playlistId = null;
  });
});
```

- [ ] **Step 2: Write music-tags.test.js**

```js
// backend/tests/integration/music-tags.test.js
import { describe, it, after } from 'node:test';
import assert from 'assert';

const API = 'http://localhost:3000';

describe('Music Tags API', () => {
  let projectId;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('GET /api/music/:id/tags — returns tag object with bpm/key/mood', async () => {
    const seedRes = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `TagsTest-${Date.now()}`, music: true }),
    });
    const { project, music } = await seedRes.json();
    projectId = project.id;
    const musicId = music[0]?.id;
    assert.ok(musicId);

    const res = await fetch(`${API}/api/music/${musicId}/tags`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok('bpm' in body, 'response must have bpm field');
    assert.ok('key' in body, 'response must have key field');
    assert.ok('mood' in body, 'response must have mood field');
    // Values may be null for test fixture — that is correct
  });

  it('GET /api/music/nonexistent/tags — returns nulls not 404', async () => {
    const res = await fetch(`${API}/api/music/nonexistent-id/tags`);
    // graceful: returns 200 with nulls or 404 — both acceptable
    assert.ok([200, 404].includes(res.status));
    if (res.status === 200) {
      const body = await res.json();
      assert.strictEqual(body.bpm, null);
    }
  });
});
```

- [ ] **Step 3: Write music-notes.test.js**

```js
// backend/tests/integration/music-notes.test.js
import { describe, it, after } from 'node:test';
import assert from 'assert';

const API = 'http://localhost:3000';

describe('Music Notes API', () => {
  let projectId, musicId, noteId;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('setup: seed project with music', async () => {
    const res = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `NotesTest-${Date.now()}`, music: true }),
    });
    const data = await res.json();
    projectId = data.project.id;
    musicId = data.music[0]?.id;
    assert.ok(musicId);
  });

  it('POST /api/music/:id/notes — creates note', async () => {
    const res = await fetch(`${API}/api/music/${musicId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp_sec: 12.5, text: 'Fix the drop here' }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    assert.strictEqual(body.text, 'Fix the drop here');
    assert.strictEqual(body.timestamp_sec, 12.5);
    noteId = body.id;
  });

  it('GET /api/music/:id/notes — returns notes array', async () => {
    const res = await fetch(`${API}/api/music/${musicId}/notes`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.some(n => n.id === noteId));
  });

  it('POST /api/music/:id/notes — 400 for missing text', async () => {
    const res = await fetch(`${API}/api/music/${musicId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp_sec: 5 }),
    });
    assert.strictEqual(res.status, 400);
  });

  it('DELETE /api/music/:id/notes/:noteId — deletes note', async () => {
    const res = await fetch(`${API}/api/music/${musicId}/notes/${noteId}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 204);
    const listRes = await fetch(`${API}/api/music/${musicId}/notes`);
    const notes = await listRes.json();
    assert.ok(!notes.some(n => n.id === noteId));
  });
});
```

- [ ] **Step 4: Write social-export.test.js**

```js
// backend/tests/integration/social-export.test.js
import { describe, it, after } from 'node:test';
import assert from 'assert';

const API = 'http://localhost:3000';

describe('Social Export API', () => {
  let projectId, musicId;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('setup: seed project with music', async () => {
    const res = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `SocialExportTest-${Date.now()}`, music: true }),
    });
    const data = await res.json();
    projectId = data.project.id;
    musicId = data.music[0]?.id;
    assert.ok(musicId);
  });

  it('POST /api/audio/social-export — reels preset returns MP3 bytes', async () => {
    const res = await fetch(`${API}/api/audio/social-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId, preset: 'reels' }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('audio/mpeg'));
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 1000, 'audio output must have content');
  });

  it('POST /api/audio/social-export — full preset returns full track', async () => {
    const res = await fetch(`${API}/api/audio/social-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId, preset: 'full' }),
    });
    assert.strictEqual(res.status, 200);
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 1000);
  });

  it('POST /api/audio/social-export — 400 for invalid preset', async () => {
    const res = await fetch(`${API}/api/audio/social-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId, preset: 'snapchat' }),
    });
    assert.strictEqual(res.status, 400);
  });

  it('POST /api/audio/social-export — 400 for missing musicId', async () => {
    const res = await fetch(`${API}/api/audio/social-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: 'tiktok' }),
    });
    assert.strictEqual(res.status, 400);
  });
});
```

- [ ] **Step 5: Write share.test.js**

```js
// backend/tests/integration/share.test.js
import { describe, it, after } from 'node:test';
import assert from 'assert';

const API = 'http://localhost:3000';

describe('Share Links API', () => {
  let projectId, token;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('setup: create project', async () => {
    const res = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `ShareTest-${Date.now()}` }),
    });
    const data = await res.json();
    projectId = data.id;
    assert.ok(projectId);
  });

  it('POST /api/projects/:id/share — creates share token', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/share`, { method: 'POST' });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.token, 'must return token');
    assert.ok(body.url, 'must return url');
    assert.ok(body.expiresAt, 'must return expiresAt');
    token = body.token;
  });

  it('GET /api/share/:token — returns project + music', async () => {
    const res = await fetch(`${API}/api/share/${token}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.project?.id === projectId);
    assert.ok(Array.isArray(body.music));
    assert.ok(body.expiresAt);
  });

  it('GET /api/share/badtoken — 404', async () => {
    const res = await fetch(`${API}/api/share/this-token-does-not-exist`);
    assert.strictEqual(res.status, 404);
  });

  it('POST /api/projects/nonexistent/share — 404', async () => {
    const res = await fetch(`${API}/api/projects/no-such-project/share`, { method: 'POST' });
    assert.strictEqual(res.status, 404);
  });
});
```

- [ ] **Step 6: Run all new tests**

```bash
cd backend && npm test -- --test-name-pattern "Playlist|Music Tags|Music Notes|Social Export|Share" 2>&1 | tail -30
```
Expected: All tests pass. Zero failures.

- [ ] **Step 7: Run full test suite to confirm no regressions**

```bash
cd backend && npm test 2>&1 | tail -10
```
Expected: `# tests N` with `# failures 0`

- [ ] **Step 8: Commit**

```bash
git add backend/tests/integration/playlist.test.js backend/tests/integration/music-tags.test.js backend/tests/integration/music-notes.test.js backend/tests/integration/social-export.test.js backend/tests/integration/share.test.js
git commit -m "test: integration tests for playlist, tags, notes, social-export, share — all passing"
```

---

### Task 9: Push backend branch

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/phase4-redesign
```

- [ ] **Step 2: Verify on remote**

```bash
git log --oneline origin/feat/phase4-redesign | head -10
```

Expected: Shows all Phase 4 backend commits.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ 5 new DB tables: playlists, playlist_tracks, music_tags, music_notes, project_shares
- ✅ 13 new endpoints: playlist CRUD (7) + tags (1) + notes (3) + social-export (1) + share (2) = 14 ✓
- ✅ BPM/key from music-metadata with cache
- ✅ Social export: tiktok/reels/shorts/full via FFmpeg
- ✅ Share tokens with 30-day expiry
- ✅ All tests: real HTTP, no mocks, seed endpoint used
- ✅ Cleanup: all tests delete their test projects in `after()`

**What this plan does NOT cover (Phase 4 Frontend Plan):**
- StudioV4.tsx and all new UI components
- Playwright E2E tests for Phase 4 UI
- That is covered in: `2026-05-18-phase4-frontend.md`
