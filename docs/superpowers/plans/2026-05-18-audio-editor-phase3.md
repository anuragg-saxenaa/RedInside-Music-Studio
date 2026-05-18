# Audio Editor Phase 3 + YouTube Downloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vocal removal (Demucs AI + FFmpeg fallback), real-time Web Audio preview, full Neon Dark UI redesign for the Audio Editor, and a YouTube audio downloader that saves tracks to the Music library.

**Architecture:** Vocal removal runs as a BullMQ job (30–90s); progress broadcast via WebSocket. Real-time preview uses a `useRealtimeAudio` hook rebuilding a Web Audio node graph on every operations change (50ms debounced); FFmpeg is used only for final export. YouTube download calls `yt-dlp` as a child process, saves MP3 to project storage, and creates a `music_generations` DB record.

**Tech Stack:** Node.js + BullMQ + WebSocket (backend); React + Web Audio API (frontend); Python `demucs` (optional, auto-detected); `yt-dlp` CLI (must be installed); FFmpeg (existing).

---

## File Map

### New backend files
| File | Responsibility |
|------|---------------|
| `backend/src/modules/audio/vocal-removal.service.js` | Engine detection (demucs vs ffmpeg), `removeVocals()` |
| `backend/src/queue/workers/vocal-removal.worker.js` | BullMQ worker — calls service, saves music record, broadcasts WS |
| `backend/src/modules/downloader/downloader.service.js` | `yt-dlp` child process, saves file to project storage |
| `backend/src/modules/downloader/downloader.controller.js` | HTTP handler for download + status polling |
| `backend/src/api/routes/downloader.routes.js` | Route registration |
| `backend/tests/integration/vocal-removal.test.js` | Backend integration tests |
| `backend/tests/integration/downloader.test.js` | Backend integration tests |

### Modified backend files
| File | Change |
|------|--------|
| `backend/src/modules/audio/audio.controller.js` | Add `removeVocals` handler |
| `backend/src/api/routes/audio.routes.js` | Add `POST /api/audio/remove-vocals` |
| `backend/src/queue/queue.config.js` | Add `vocal-removal` queue |
| `backend/src/server.js` | Import vocal-removal worker + downloader routes; expose `demucs` in `/health` |

### New frontend files
| File | Responsibility |
|------|---------------|
| `frontend/src/hooks/useRealtimeAudio.ts` | Web Audio node graph, 50ms-debounced rebuild |
| `frontend/src/components/AudioEditor/VocalRemovalCard.tsx` | Toggle, engine badge, progress bar, completion link |
| `frontend/src/components/AudioEditor/EffectTile.tsx` | Reusable effect card (toggle + slider + value readout) |
| `frontend/src/components/Downloader/YoutubeDownloader.tsx` | URL input, progress, save-to-music |

### Modified frontend files
| File | Change |
|------|--------|
| `frontend/src/components/AudioEditor/ControlsSidebar.tsx` | Add `vocalRemoval*` fields to `AudioOperations` type; replace slider list with `EffectTile` grid |
| `frontend/src/components/AudioEditor/AudioEditorPanel.tsx` | Full rewrite — Neon Dark layout, `useRealtimeAudio`, `VocalRemovalCard` |
| `frontend/src/components/AudioEditor/TrackLane.tsx` | Dual-stem waveform mode |
| `frontend/src/pages/Studio.tsx` | Add downloader tab or entry point |

---

## Task 1: VocalRemovalService

**Files:**
- Create: `backend/src/modules/audio/vocal-removal.service.js`
- Test: `backend/tests/integration/vocal-removal.test.js` (partial — detectEngine only)

- [ ] **Step 1: Write failing test for detectEngine**

```javascript
// backend/tests/integration/vocal-removal.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VocalRemovalService } from '../../src/modules/audio/vocal-removal.service.js';

describe('VocalRemovalService.detectEngine', () => {
  it('returns "demucs" or "ffmpeg"', async () => {
    const engine = await VocalRemovalService.detectEngine();
    assert.ok(['demucs', 'ffmpeg'].includes(engine), `expected demucs or ffmpeg, got ${engine}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && node --test tests/integration/vocal-removal.test.js
```
Expected: `ERR_MODULE_NOT_FOUND` — module doesn't exist yet.

- [ ] **Step 3: Implement VocalRemovalService**

```javascript
// backend/src/modules/audio/vocal-removal.service.js
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger.js';

export const VocalRemovalService = {
  _engine: null,

  async detectEngine() {
    if (this._engine) return this._engine;
    try {
      execSync('python3 -m demucs --help', { stdio: 'ignore', timeout: 5000 });
      this._engine = 'demucs';
    } catch {
      this._engine = 'ffmpeg';
    }
    logger.info('VocalRemovalService engine detected', { engine: this._engine });
    return this._engine;
  },

  async removeVocals(inputPath, outputDir, { onProgress } = {}) {
    const engine = await this.detectEngine();
    fs.mkdirSync(outputDir, { recursive: true });

    if (engine === 'demucs') {
      return this._runDemucs(inputPath, outputDir, onProgress);
    }
    return this._runFfmpeg(inputPath, outputDir, onProgress);
  },

  _runDemucs(inputPath, outputDir, onProgress) {
    return new Promise((resolve, reject) => {
      onProgress?.(10, 'Starting Demucs...');
      const proc = spawn('python3', [
        '-m', 'demucs',
        '--two-stems=vocals',
        '-o', outputDir,
        inputPath,
      ]);

      let stderr = '';
      proc.stderr.on('data', d => {
        stderr += d.toString();
        if (stderr.includes('Separating')) onProgress?.(40, 'Separating stems...');
        if (stderr.includes('vocals.wav')) onProgress?.(80, 'Finalising stems...');
      });

      proc.on('close', code => {
        if (code !== 0) return reject(new Error(`Demucs exited ${code}: ${stderr.slice(-200)}`));
        // Demucs writes: outputDir/htdemucs/<basename>/no_vocals.wav and vocals.wav
        const basename = path.basename(inputPath, path.extname(inputPath));
        const htDir = path.join(outputDir, 'htdemucs', basename);
        const instrumentalPath = path.join(htDir, 'no_vocals.wav');
        const vocalPath = path.join(htDir, 'vocals.wav');
        if (!fs.existsSync(instrumentalPath)) {
          return reject(new Error(`Demucs output not found at ${instrumentalPath}`));
        }
        onProgress?.(100, 'Done');
        resolve({ instrumentalPath, vocalPath: fs.existsSync(vocalPath) ? vocalPath : null, engine: 'demucs' });
      });
    });
  },

  _runFfmpeg(inputPath, outputDir, onProgress) {
    return new Promise((resolve, reject) => {
      onProgress?.(20, 'Applying center-channel subtraction...');
      const outFile = path.join(outputDir, `instrumental_${Date.now()}.mp3`);
      const proc = spawn('ffmpeg', [
        '-i', inputPath,
        '-af', 'pan=stereo|c0=c0-c1|c1=c1-c0',
        '-q:a', '0',
        outFile,
        '-y',
      ]);
      proc.on('close', code => {
        if (code !== 0) return reject(new Error(`FFmpeg vocal removal exited ${code}`));
        onProgress?.(100, 'Done');
        resolve({ instrumentalPath: outFile, vocalPath: null, engine: 'ffmpeg' });
      });
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && node --test tests/integration/vocal-removal.test.js
```
Expected: PASS (engine will be 'ffmpeg' unless Demucs is installed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/audio/vocal-removal.service.js backend/tests/integration/vocal-removal.test.js
git commit -m "feat: add VocalRemovalService with Demucs/FFmpeg engine detection"
```

---

## Task 2: Add vocal-removal queue + worker

**Files:**
- Modify: `backend/src/queue/queue.config.js`
- Create: `backend/src/queue/workers/vocal-removal.worker.js`

- [ ] **Step 1: Add queue to queue.config.js**

Add this block inside the `queues` object after the `video` entry:

```javascript
  vocalRemoval: new Queue('vocal-removal', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 50,
      removeOnFail: 200,
    },
  }),
```

Add to `queueEvents`:
```javascript
  vocalRemoval: new QueueEvents('vocal-removal', { connection: getRedisConnection() }),
```

- [ ] **Step 2: Create vocal-removal.worker.js**

```javascript
// backend/src/queue/workers/vocal-removal.worker.js
import { Worker } from 'bullmq';
import path from 'path';
import os from 'os';
import { getRedisConnection } from '../queue.config.js';
import { VocalRemovalService } from '../../modules/audio/vocal-removal.service.js';
import { MusicModel } from '../../database/models/music.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import { broadcast } from '../../utils/ws.server.js';
import logger from '../../utils/logger.js';

new Worker('vocal-removal', async (job) => {
  const { musicId, projectId, inputPath, originalTitle } = job.data;

  const outputDir = path.join(os.tmpdir(), `vocal-removal-${job.id}`);

  const result = await VocalRemovalService.removeVocals(inputPath, outputDir, {
    onProgress: (progress, message) => {
      job.updateProgress(progress);
      broadcast({ event: 'job.progress', jobId: job.id, progress, message });
    },
  });

  // Save instrumental to music library
  const title = `${originalTitle} (Instrumental)`;
  const instrumental = MusicModel.create({
    projectId,
    title,
    model: 'vocal-removal',
    originalFilePath: result.instrumentalPath,
    processedFilePath: null,
    status: 'completed',
  });

  ProjectModel.incrementVersion(projectId, 'music');

  broadcast({
    event: 'job.completed',
    jobId: job.id,
    result: {
      instrumentalMusicId: instrumental.id,
      vocalPath: result.vocalPath,
      engine: result.engine,
    },
  });

  logger.info('Vocal removal job completed', { jobId: job.id, engine: result.engine });
  return { instrumentalMusicId: instrumental.id, engine: result.engine };
}, {
  connection: getRedisConnection(),
  concurrency: 1,
});
```

- [ ] **Step 3: Verify no import errors by starting server**

```bash
cd backend && node --input-type=module <<'EOF'
import './src/queue/workers/vocal-removal.worker.js';
console.log('worker imports OK');
EOF
```
Expected: prints `worker imports OK` (or Redis connect message — no crash).

- [ ] **Step 4: Commit**

```bash
git add backend/src/queue/queue.config.js backend/src/queue/workers/vocal-removal.worker.js
git commit -m "feat: add vocal-removal BullMQ queue and worker"
```

---

## Task 3: Audio controller + routes for vocal removal

**Files:**
- Modify: `backend/src/modules/audio/audio.controller.js`
- Modify: `backend/src/api/routes/audio.routes.js`
- Test: `backend/tests/integration/vocal-removal.test.js` (extend)

- [ ] **Step 1: Add failing integration test**

Append to `backend/tests/integration/vocal-removal.test.js`:

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3001';

describe('POST /api/audio/remove-vocals', () => {
  it('returns 400 when musicId missing', async () => {
    const res = await fetch(`${BASE}/api/audio/remove-vocals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-1' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
cd backend && node --test tests/integration/vocal-removal.test.js
```
Expected: FAIL with `ECONNREFUSED` (server not running) or 404.

- [ ] **Step 3: Add removeVocals handler to AudioController**

At the bottom of the `AudioController` export object in `audio.controller.js`, add:

```javascript
  async removeVocals(req, res, next) {
    try {
      const { musicId, projectId } = req.body;
      if (!musicId || !projectId) {
        return res.status(400).json({ error: 'musicId and projectId are required' });
      }

      const { MusicModel } = await import('../../database/models/music.model.js');
      const music = MusicModel.findById(musicId);
      if (!music) return res.status(404).json({ error: 'Music not found' });

      const inputPath = music.processed_file_path || music.original_file_path;
      if (!inputPath || !fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Audio file not found on disk' });
      }

      const { queues } = await import('../../queue/queue.config.js');
      const job = await queues.vocalRemoval.add('remove-vocals', {
        musicId,
        projectId,
        inputPath,
        originalTitle: music.title,
      });

      res.status(202).json({ jobId: job.id });
    } catch (err) {
      next(err);
    }
  },
```

- [ ] **Step 4: Register route in audio.routes.js**

Add entry at end of the `AudioRoutes` array:

```javascript
  {
    method: 'post',
    path: '/api/audio/remove-vocals',
    handler: AudioController.removeVocals,
  },
```

- [ ] **Step 5: Start test server and run tests**

```bash
cd backend && npm run dev &
sleep 3
node --test tests/integration/vocal-removal.test.js
```
Expected: detectEngine PASS + 400 validation PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/audio/audio.controller.js backend/src/api/routes/audio.routes.js backend/tests/integration/vocal-removal.test.js
git commit -m "feat: add POST /api/audio/remove-vocals route"
```

---

## Task 4: Expose demucs in /health endpoint + import worker in server.js

**Files:**
- Modify: `backend/src/server.js`

- [ ] **Step 1: Import vocal-removal worker and detect engine at startup**

In `server.js`:

1. Add import after existing worker imports:
```javascript
import './queue/workers/vocal-removal.worker.js';
```

2. Replace the existing `/health` handler with:
```javascript
app.get('/health', async (req, res) => {
  const minimaxBase = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io';
  const { VocalRemovalService } = await import('./modules/audio/vocal-removal.service.js');
  const demucsEngine = await VocalRemovalService.detectEngine();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    minimax: minimaxBase.includes('localhost') ? 'mock' : 'real',
    minimaxHost: new URL(minimaxBase).host,
    demucs: demucsEngine === 'demucs' ? 'available' : 'fallback',
  });
});
```

- [ ] **Step 2: Verify health endpoint**

```bash
curl -s http://localhost:3001/health | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log(j.demucs);"
```
Expected: prints `available` or `fallback`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.js
git commit -m "feat: expose demucs engine status in /health endpoint"
```

---

## Task 5: YouTube Downloader — backend service + routes

**Files:**
- Create: `backend/src/modules/downloader/downloader.service.js`
- Create: `backend/src/modules/downloader/downloader.controller.js`
- Create: `backend/src/api/routes/downloader.routes.js`
- Test: `backend/tests/integration/downloader.test.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Write failing test**

```javascript
// backend/tests/integration/downloader.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3001';

describe('POST /api/downloader/youtube', () => {
  it('returns 400 when url missing', async () => {
    const res = await fetch(`${BASE}/api/downloader/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-1' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('returns 400 when projectId missing', async () => {
    const res = await fetch(`${BASE}/api/downloader/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=abc123' }),
    });
    assert.equal(res.status, 400);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
cd backend && node --test tests/integration/downloader.test.js
```
Expected: FAIL (404 — route not registered).

- [ ] **Step 3: Implement DownloaderService**

```javascript
// backend/src/modules/downloader/downloader.service.js
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger.js';

export const DownloaderService = {
  /**
   * Check if yt-dlp is available
   */
  isAvailable() {
    try {
      const { execSync } = await import('child_process');
      execSync('yt-dlp --version', { stdio: 'ignore', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Download audio from YouTube URL as MP3, save to outputDir.
   * Returns { filePath, title, duration }.
   */
  download(url, outputDir, { onProgress } = {}) {
    return new Promise((resolve, reject) => {
      fs.mkdirSync(outputDir, { recursive: true });

      // Output template: outputDir/%(title)s.%(ext)s
      const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

      const args = [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--print-json',
        '--no-playlist',
        '-o', outputTemplate,
        url,
      ];

      const proc = spawn('yt-dlp', args);
      let jsonOutput = '';
      let stderr = '';

      proc.stdout.on('data', d => { jsonOutput += d.toString(); });
      proc.stderr.on('data', d => {
        stderr += d.toString();
        // Parse progress lines like: [download]  45.2% of ...
        const m = stderr.match(/\[download\]\s+([\d.]+)%/);
        if (m) onProgress?.(Math.min(90, parseFloat(m[1])), `Downloading ${m[1]}%`);
      });

      proc.on('close', code => {
        if (code !== 0) {
          return reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-300)}`));
        }
        try {
          // jsonOutput may have multiple lines; take last non-empty JSON
          const lines = jsonOutput.trim().split('\n').filter(Boolean);
          const info = JSON.parse(lines[lines.length - 1]);
          const title = info.title || 'Unknown';
          const duration = info.duration || 0;
          // yt-dlp with --print-json prints BEFORE conversion; actual file uses .mp3 extension
          const rawPath = info.filename || info._filename || '';
          // Replace extension with .mp3
          const filePath = rawPath.replace(/\.[^.]+$/, '.mp3');
          if (!fs.existsSync(filePath)) {
            // fallback: find the mp3 in outputDir
            const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.mp3'));
            if (!files.length) return reject(new Error('Downloaded file not found'));
            return resolve({ filePath: path.join(outputDir, files[0]), title, duration });
          }
          resolve({ filePath, title, duration });
        } catch (e) {
          reject(new Error(`Failed to parse yt-dlp output: ${e.message}`));
        }
      });
    });
  },
};
```

- [ ] **Step 4: Implement DownloaderController**

```javascript
// backend/src/modules/downloader/downloader.controller.js
import path from 'path';
import fs from 'fs';
import { DownloaderService } from './downloader.service.js';
import { MusicModel } from '../../database/models/music.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import logger from '../../utils/logger.js';
import { broadcast } from '../../utils/ws.server.js';

export const DownloaderController = {
  async youtube(req, res, next) {
    try {
      const { url, projectId } = req.body;
      if (!url) return res.status(400).json({ error: 'url is required' });
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      // Validate URL
      const validHosts = ['youtube.com', 'youtu.be', 'www.youtube.com', 'music.youtube.com'];
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL' });
      }
      if (!validHosts.some(h => parsedUrl.hostname === h)) {
        return res.status(400).json({ error: 'Only YouTube URLs are supported' });
      }

      // Generate a download ID for polling
      const downloadId = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const outputDir = path.join(storage.getProjectDir(projectId), 'downloads', downloadId);

      // Respond immediately with downloadId (fire-and-forget the actual download)
      res.status(202).json({ downloadId });

      // Run download in background
      (async () => {
        try {
          broadcast({ event: 'download.progress', downloadId, progress: 5, message: 'Starting download...' });

          const { filePath, title, duration } = await DownloaderService.download(url, outputDir, {
            onProgress: (progress, message) => {
              broadcast({ event: 'download.progress', downloadId, progress, message });
            },
          });

          // Copy to project music storage
          const musicDir = path.join(storage.getProjectDir(projectId), 'generations', 'music');
          fs.mkdirSync(musicDir, { recursive: true });
          const destFile = path.join(musicDir, `${downloadId}.mp3`);
          fs.copyFileSync(filePath, destFile);

          // Save to music library
          const music = MusicModel.create({
            projectId,
            title,
            model: 'youtube-download',
            originalFilePath: destFile,
            processedFilePath: null,
            status: 'completed',
            durationSeconds: duration,
          });

          ProjectModel.incrementVersion(projectId, 'music');

          broadcast({
            event: 'download.completed',
            downloadId,
            result: { musicId: music.id, title, duration },
          });
          logger.info('YouTube download completed', { downloadId, musicId: music.id, title });
        } catch (err) {
          logger.error('YouTube download failed', { downloadId, error: err.message });
          broadcast({ event: 'download.failed', downloadId, error: err.message });
        }
      })();
    } catch (err) {
      next(err);
    }
  },
};
```

- [ ] **Step 5: Create routes file**

```javascript
// backend/src/api/routes/downloader.routes.js
import { DownloaderController } from '../../modules/downloader/downloader.controller.js';

export const DownloaderRoutes = [
  {
    method: 'post',
    path: '/api/downloader/youtube',
    handler: DownloaderController.youtube,
  },
];
```

- [ ] **Step 6: Register in server.js**

Add import near other route imports:
```javascript
import { DownloaderRoutes } from './api/routes/downloader.routes.js';
```

Add route registration in the route-registration loop (find the block that calls `app[method]` for each route array and add `DownloaderRoutes`):
```javascript
[...DownloaderRoutes].forEach(({ method, path, handler }) => {
  app[method](path, handler);
});
```

- [ ] **Step 7: Run tests**

```bash
cd backend && node --test tests/integration/downloader.test.js
```
Expected: 2x PASS (400 validation).

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/downloader/ backend/src/api/routes/downloader.routes.js backend/src/server.js backend/tests/integration/downloader.test.js
git commit -m "feat: add YouTube downloader service, controller, and /api/downloader/youtube route"
```

---

## Task 6: useRealtimeAudio hook

**Files:**
- Create: `frontend/src/hooks/useRealtimeAudio.ts`

- [ ] **Step 1: Create the hook**

```typescript
// frontend/src/hooks/useRealtimeAudio.ts
import { useEffect, useRef, useCallback } from 'react';
import { AudioOperations } from '../components/AudioEditor/ControlsSidebar';

interface UseRealtimeAudioOptions {
  audioUrl: string;
  operations: AudioOperations;
  isPlaying: boolean;
  currentTime: number;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
}

export function useRealtimeAudio({
  audioUrl,
  operations,
  isPlaying,
  currentTime,
  onEnded,
  onTimeUpdate,
}: UseRealtimeAudioOptions) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const startedAtRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load audio buffer once per audioUrl
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;

    (async () => {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      try {
        const resp = await fetch(audioUrl);
        const arrayBuf = await resp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        if (!cancelled) bufferRef.current = decoded;
      } catch (e) {
        console.error('useRealtimeAudio: failed to decode audio', e);
      }
    })();

    return () => {
      cancelled = true;
      ctxRef.current?.close();
      ctxRef.current = null;
      bufferRef.current = null;
    };
  }, [audioUrl]);

  const buildGraph = useCallback(() => {
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;

    // Stop previous source
    sourceRef.current?.stop();
    cancelAnimationFrame(rafRef.current);

    const ops = operations;

    // Build node chain
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Speed + pitch-via-playbackRate
    const speedFactor = ops.speed || 1.0;
    const pitchRatio = ops.pitchShiftEnabled
      ? Math.pow(2, (ops.pitchShiftSemitones || 0) / 12)
      : 1.0;
    source.playbackRate.value = speedFactor * pitchRatio;

    // Reverse: create reversed buffer copy
    if (ops.reverse) {
      const rev = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch).slice().reverse();
        rev.copyToChannel(data, ch);
      }
      source.buffer = rev;
    }

    let node: AudioNode = source;

    // Bass boost — BiquadFilter lowshelf 80Hz
    if (ops.bassBoostEnabled) {
      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 80;
      bass.gain.value = ops.bassBoostGainDb || 6;
      node.connect(bass);
      node = bass;
    }

    // Reverb — ConvolverNode with procedural impulse
    if (ops.reverbEnabled) {
      const convolver = ctx.createConvolver();
      convolver.buffer = buildImpulse(ctx, ops.reverbRoomScale / 100, ops.reverbDamping / 100);
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      dryGain.gain.value = 1 - (ops.reverbWetLevel || 0.3);
      wetGain.gain.value = ops.reverbWetLevel || 0.3;
      const merger = ctx.createGain();
      node.connect(dryGain);
      node.connect(convolver);
      convolver.connect(wetGain);
      dryGain.connect(merger);
      wetGain.connect(merger);
      node = merger;
    }

    // Echo — DelayNode + feedback GainNode
    if (ops.echoEnabled) {
      const delay = ctx.createDelay(3.0);
      delay.delayTime.value = ops.echoDelay || 0.3;
      const feedback = ctx.createGain();
      feedback.gain.value = ops.echoDecay || 0.5;
      const dryGain = ctx.createGain();
      dryGain.gain.value = 1;
      node.connect(dryGain);
      node.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(ctx.destination);
      node = dryGain;
    }

    // Volume
    const gainNode = ctx.createGain();
    gainNode.gain.value = ops.volume || 1.0;
    node.connect(gainNode);
    node = gainNode;

    node.connect(ctx.destination);

    sourceRef.current = source;

    if (isPlaying) {
      const offset = Math.max(0, startOffsetRef.current);
      const duration = buffer.duration / speedFactor;
      source.start(0, offset);
      startedAtRef.current = ctx.currentTime - offset;

      const tick = () => {
        const elapsed = ctx.currentTime - startedAtRef.current;
        onTimeUpdate?.(elapsed * speedFactor);
        if (elapsed < duration) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          onEnded?.();
        }
      };
      rafRef.current = requestAnimationFrame(tick);

      source.onended = () => { cancelAnimationFrame(rafRef.current); };
    }
  }, [operations, isPlaying, onEnded, onTimeUpdate]);

  // Debounced rebuild when ops change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(buildGraph, 50);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [buildGraph]);

  // Play/pause without full rebuild
  useEffect(() => {
    if (!isPlaying) {
      sourceRef.current?.stop();
      cancelAnimationFrame(rafRef.current);
      const ctx = ctxRef.current;
      if (ctx) {
        const elapsed = ctx.currentTime - startedAtRef.current;
        startOffsetRef.current = elapsed * (operations.speed || 1.0);
      }
    } else {
      buildGraph();
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    startOffsetRef.current = time;
    if (isPlaying) buildGraph();
  }, [isPlaying, buildGraph]);

  return { seek };
}

function buildImpulse(ctx: AudioContext, roomScale: number, damping: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * (0.5 + roomScale * 3)));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, damping * 10 + 1);
    }
  }
  return impulse;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useRealtimeAudio.ts
git commit -m "feat: add useRealtimeAudio hook for Web Audio real-time preview"
```

---

## Task 7: EffectTile component

**Files:**
- Create: `frontend/src/components/AudioEditor/EffectTile.tsx`

- [ ] **Step 1: Create EffectTile**

```typescript
// frontend/src/components/AudioEditor/EffectTile.tsx
import React from 'react';

export interface EffectTileProps {
  label: string;
  color: string;       // hex accent color
  enabled: boolean;
  value: string;       // display value e.g. "32%" or "+2st" or "OFF"
  onToggle: () => void;
  children?: React.ReactNode; // slider rendered by parent
}

export default function EffectTile({ label, color, enabled, value, onToggle, children }: EffectTileProps) {
  return (
    <div
      style={{
        background: enabled ? `${color}14` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${enabled ? color + '40' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: '0.12em', fontFamily: 'monospace' }}>
          {label}
        </span>
        {/* Toggle pill */}
        <button
          onClick={onToggle}
          style={{
            width: 28,
            height: 16,
            borderRadius: 8,
            border: 'none',
            background: enabled ? color : 'rgba(255,255,255,0.15)',
            cursor: 'pointer',
            position: 'relative',
            padding: 0,
            transition: 'background 0.15s',
            flexShrink: 0,
            boxShadow: enabled ? `0 0 6px ${color}80` : 'none',
          }}
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: enabled ? 14 : 2,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.15s',
            }}
          />
        </button>
      </div>

      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: enabled ? color : 'rgba(255,255,255,0.25)',
          lineHeight: 1,
          minHeight: 24,
        }}
      >
        {value}
      </div>

      {enabled && children && (
        <div style={{ marginTop: 2 }}>
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AudioEditor/EffectTile.tsx
git commit -m "feat: add EffectTile component for Neon Dark audio editor"
```

---

## Task 8: VocalRemovalCard component

**Files:**
- Create: `frontend/src/components/AudioEditor/VocalRemovalCard.tsx`

- [ ] **Step 1: Create VocalRemovalCard**

```typescript
// frontend/src/components/AudioEditor/VocalRemovalCard.tsx
import { useState, useEffect } from 'react';

interface VocalRemovalCardProps {
  musicId: string;
  projectId: string;
  onCompleted: (instrumentalMusicId: string) => void;
}

type JobState = 'idle' | 'running' | 'done' | 'error';

export default function VocalRemovalCard({ musicId, projectId, onCompleted }: VocalRemovalCardProps) {
  const [jobState, setJobState] = useState<JobState>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [engine, setEngine] = useState<'demucs' | 'ffmpeg' | null>(null);
  const [healthDemucs, setHealthDemucs] = useState<'available' | 'fallback' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [instrumentalId, setInstrumentalId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health').then(r => r.json()).then(d => setHealthDemucs(d.demucs)).catch(() => {});
  }, []);

  // Listen to WebSocket messages (assumes global ws on window or context)
  useEffect(() => {
    if (!jobId) return;
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.jobId !== jobId) return;
        if (data.event === 'job.progress') {
          setProgress(data.progress);
          setMessage(data.message);
        } else if (data.event === 'job.completed') {
          setJobState('done');
          setEngine(data.result.engine);
          setInstrumentalId(data.result.instrumentalMusicId);
          onCompleted(data.result.instrumentalMusicId);
        }
      } catch {}
    };
    // Attach to whichever global WS the app exposes
    const ws = (window as any).__studioWs;
    ws?.addEventListener('message', handler);
    return () => ws?.removeEventListener('message', handler);
  }, [jobId, onCompleted]);

  const handleStart = async () => {
    setJobState('running');
    setProgress(5);
    setMessage('Queuing job...');
    setError(null);
    try {
      const res = await fetch('/api/audio/remove-vocals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicId, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start job');
      setJobId(data.jobId);
    } catch (e: any) {
      setError(e.message);
      setJobState('error');
    }
  };

  const engineBadgeStyle = (e: 'demucs' | 'ffmpeg' | null) => ({
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '2px 8px',
    borderRadius: 20,
    background: e === 'demucs' ? 'rgba(0,210,106,0.15)' : 'rgba(255,184,0,0.15)',
    color: e === 'demucs' ? '#00D26A' : '#FFB800',
    border: `1px solid ${e === 'demucs' ? '#00D26A40' : '#FFB80040'}`,
  });

  return (
    <div style={{
      background: 'rgba(230,57,70,0.07)',
      border: '1px solid rgba(230,57,70,0.25)',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#E63946', letterSpacing: '0.1em' }}>
          🎤 VOCAL REMOVAL
        </span>
        {healthDemucs && (
          <span style={engineBadgeStyle(healthDemucs === 'available' ? 'demucs' : 'ffmpeg')}>
            {healthDemucs === 'available' ? 'AI MODEL' : 'FAST MODE'}
          </span>
        )}
      </div>

      {jobState === 'idle' && (
        <button
          onClick={handleStart}
          style={{
            background: 'linear-gradient(135deg,#E63946,#c0392b)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontWeight: 700,
            fontSize: 11,
            padding: '7px 16px',
            cursor: 'pointer',
            boxShadow: '0 0 12px rgba(230,57,70,0.3)',
          }}
        >
          Remove Vocals → Instrumental
        </button>
      )}

      {jobState === 'running' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{message}</span>
            <span style={{ color: '#E63946', fontSize: 11, fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg,#E63946,#c0392b)',
              borderRadius: 2,
              transition: 'width 0.3s',
              boxShadow: '0 0 8px rgba(230,57,70,0.5)',
            }} />
          </div>
        </div>
      )}

      {jobState === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#00D26A', fontSize: 11 }}>✓ Instrumental saved to Music library</span>
          {engine && <span style={engineBadgeStyle(engine)}>{engine === 'demucs' ? 'AI DEMUCS' : 'FFMPEG'}</span>}
        </div>
      )}

      {jobState === 'error' && (
        <div style={{ color: '#E63946', fontSize: 11 }}>{error}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AudioEditor/VocalRemovalCard.tsx
git commit -m "feat: add VocalRemovalCard component with progress bar and engine badge"
```

---

## Task 9: Update AudioOperations type + ControlsSidebar rewrite

**Files:**
- Modify: `frontend/src/components/AudioEditor/ControlsSidebar.tsx`

- [ ] **Step 1: Add vocal removal fields to AudioOperations interface**

In `ControlsSidebar.tsx`, extend the `AudioOperations` interface:

```typescript
export interface AudioOperations {
  trimStart: number
  trimEnd: number
  speed: number
  volume: number
  fadeInEnabled: boolean
  fadeInDuration: number
  fadeOutEnabled: boolean
  fadeOutDuration: number
  reverse: boolean
  normalizeEnabled: boolean
  normalizeTargetLUFS: number
  reverbEnabled: boolean
  reverbRoomScale: number
  reverbDamping: number
  reverbWetLevel: number
  echoEnabled: boolean
  echoDelay: number
  echoDecay: number
  bassBoostEnabled: boolean
  bassBoostGainDb: number
  pitchShiftEnabled: boolean
  pitchShiftSemitones: number
  // Vocal removal state
  vocalRemovalEnabled: boolean
  vocalRemovalJobId: string | null
  vocalRemovalEngine: 'demucs' | 'ffmpeg' | null
  vocalRemovalInstrumentalId: string | null
}
```

- [ ] **Step 2: Replace ControlsSidebar render with EffectTile grid**

Replace the entire component body (keep only the interface + helper functions at the top) with:

```typescript
import EffectTile from './EffectTile';

const NEON_STYLE = {
  container: {
    background: '#07071a',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    overflowY: 'auto' as const,
    height: '100%',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  slider: (color: string) => ({
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    width: '100%',
    height: 4,
    borderRadius: 2,
    background: `linear-gradient(90deg, ${color} var(--val), rgba(255,255,255,0.1) var(--val))`,
    outline: 'none',
    cursor: 'pointer',
  }),
};

function ColorSlider({ value, min, max, step = 0.01, color, onChange }: {
  value: number; min: number; max: number; step?: number; color: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min) * 100).toFixed(1) + '%';
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      style={{ ...NEON_STYLE.slider(color), ['--val' as any]: pct }}
    />
  );
}

export default function ControlsSidebar({ duration, operations: ops, onChange, onExport, isExporting }: ControlsSidebarProps) {
  const set = (patch: Partial<AudioOperations>) => onChange({ ...ops, ...patch });

  return (
    <div style={NEON_STYLE.container}>
      {/* Transport / Trim */}
      <div>
        <div style={NEON_STYLE.sectionLabel}>Trim & Time</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginBottom: 2 }}>START</div>
            <input
              type="number" min={0} max={duration} step={0.1}
              value={ops.trimStart.toFixed(1)}
              onChange={e => set({ trimStart: parseFloat(e.target.value) || 0 })}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 12, padding: '4px 8px', width: '100%', fontFamily: 'monospace' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginBottom: 2 }}>END</div>
            <input
              type="number" min={0} max={duration} step={0.1}
              value={(ops.trimEnd || duration).toFixed(1)}
              onChange={e => set({ trimEnd: parseFloat(e.target.value) || duration })}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 12, padding: '4px 8px', width: '100%', fontFamily: 'monospace' }}
            />
          </div>
        </div>
      </div>

      {/* Effect tile grid */}
      <div>
        <div style={NEON_STYLE.sectionLabel}>Effects</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

          <EffectTile label="REVERB" color="#E63946" enabled={ops.reverbEnabled}
            value={ops.reverbEnabled ? `${Math.round(ops.reverbWetLevel * 100)}%` : 'OFF'}
            onToggle={() => set({ reverbEnabled: !ops.reverbEnabled })}>
            <ColorSlider value={ops.reverbWetLevel} min={0} max={1} color="#E63946"
              onChange={v => set({ reverbWetLevel: v })} />
          </EffectTile>

          <EffectTile label="ECHO" color="#E63946" enabled={ops.echoEnabled}
            value={ops.echoEnabled ? `${ops.echoDelay.toFixed(1)}s` : 'OFF'}
            onToggle={() => set({ echoEnabled: !ops.echoEnabled })}>
            <ColorSlider value={ops.echoDelay} min={0.05} max={1.5} color="#E63946"
              onChange={v => set({ echoDelay: v })} />
          </EffectTile>

          <EffectTile label="BASS" color="#FFB800" enabled={ops.bassBoostEnabled}
            value={ops.bassBoostEnabled ? `+${ops.bassBoostGainDb}dB` : 'OFF'}
            onToggle={() => set({ bassBoostEnabled: !ops.bassBoostEnabled })}>
            <ColorSlider value={ops.bassBoostGainDb} min={0} max={15} step={1} color="#FFB800"
              onChange={v => set({ bassBoostGainDb: v })} />
          </EffectTile>

          <EffectTile label="PITCH" color="#a78bfa" enabled={ops.pitchShiftEnabled}
            value={ops.pitchShiftEnabled ? `${ops.pitchShiftSemitones > 0 ? '+' : ''}${ops.pitchShiftSemitones}st` : 'OFF'}
            onToggle={() => set({ pitchShiftEnabled: !ops.pitchShiftEnabled })}>
            <ColorSlider value={ops.pitchShiftSemitones} min={-12} max={12} step={1} color="#a78bfa"
              onChange={v => set({ pitchShiftSemitones: v })} />
          </EffectTile>

          <EffectTile label="NORMALIZE" color="#00D26A" enabled={ops.normalizeEnabled}
            value={ops.normalizeEnabled ? `${ops.normalizeTargetLUFS}L` : 'OFF'}
            onToggle={() => set({ normalizeEnabled: !ops.normalizeEnabled })}>
            <ColorSlider value={ops.normalizeTargetLUFS} min={-24} max={-6} step={1} color="#00D26A"
              onChange={v => set({ normalizeTargetLUFS: v })} />
          </EffectTile>

          <EffectTile label="SPEED" color="#60a5fa" enabled={ops.speed !== 1.0}
            value={`${ops.speed.toFixed(2)}x`}
            onToggle={() => set({ speed: ops.speed === 1.0 ? 1.25 : 1.0 })}>
            <ColorSlider value={ops.speed} min={0.5} max={2.0} step={0.05} color="#60a5fa"
              onChange={v => set({ speed: v })} />
          </EffectTile>

        </div>
      </div>

      {/* Volume */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={NEON_STYLE.sectionLabel}>VOLUME</div>
          <span style={{ color: '#fff', fontSize: 11, fontFamily: 'monospace' }}>{volumeToDb(ops.volume)}</span>
        </div>
        <ColorSlider value={ops.volume} min={0} max={2} color="#fff"
          onChange={v => set({ volume: v })} />
      </div>

      {/* Fades */}
      <div style={{ display: 'flex', gap: 8 }}>
        <EffectTile label="FADE IN" color="#60a5fa" enabled={ops.fadeInEnabled}
          value={ops.fadeInEnabled ? `${ops.fadeInDuration.toFixed(1)}s` : 'OFF'}
          onToggle={() => set({ fadeInEnabled: !ops.fadeInEnabled })}>
          <ColorSlider value={ops.fadeInDuration} min={0.1} max={10} step={0.1} color="#60a5fa"
            onChange={v => set({ fadeInDuration: v })} />
        </EffectTile>
        <EffectTile label="FADE OUT" color="#60a5fa" enabled={ops.fadeOutEnabled}
          value={ops.fadeOutEnabled ? `${ops.fadeOutDuration.toFixed(1)}s` : 'OFF'}
          onToggle={() => set({ fadeOutEnabled: !ops.fadeOutEnabled })}>
          <ColorSlider value={ops.fadeOutDuration} min={0.1} max={10} step={0.1} color="#60a5fa"
            onChange={v => set({ fadeOutDuration: v })} />
        </EffectTile>
      </div>

      {/* Reverse toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: ops.reverse ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${ops.reverse ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8 }}>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: '0.12em', fontFamily: 'monospace' }}>REVERSE</span>
        <button onClick={() => set({ reverse: !ops.reverse })} style={{ width: 28, height: 16, borderRadius: 8, border: 'none', background: ops.reverse ? '#a78bfa' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', padding: 0, transition: 'background 0.15s' }}>
          <span style={{ position: 'absolute', top: 2, left: ops.reverse ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
        </button>
      </div>

      {/* Export buttons */}
      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', marginBottom: 4 }}>
          Preview ≈ / Export exact
        </div>
        {(['mp3-320', 'wav', 'flac'] as const).map(fmt => (
          <button key={fmt} onClick={() => onExport(fmt)} disabled={isExporting}
            style={{ background: fmt === 'mp3-320' ? 'linear-gradient(135deg,#E63946,#c0392b)' : 'rgba(255,255,255,0.05)', border: fmt === 'mp3-320' ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: fmt === 'mp3-320' ? 700 : 400, padding: '8px 16px', cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.5 : 1, boxShadow: fmt === 'mp3-320' ? '0 0 12px rgba(230,57,70,0.3)' : 'none' }}>
            {isExporting ? 'Exporting...' : fmt === 'mp3-320' ? 'Export 320K MP3' : fmt === 'wav' ? 'Export WAV' : 'Export FLAC'}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AudioEditor/ControlsSidebar.tsx
git commit -m "feat: rewrite ControlsSidebar with EffectTile grid, Neon Dark, and vocalRemoval ops"
```

---

## Task 10: AudioEditorPanel full rewrite

**Files:**
- Modify: `frontend/src/components/AudioEditor/AudioEditorPanel.tsx`

- [ ] **Step 1: Rewrite AudioEditorPanel**

Replace the entire file content:

```typescript
// frontend/src/components/AudioEditor/AudioEditorPanel.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import TrackLane from './TrackLane';
import ControlsSidebar, { AudioOperations } from './ControlsSidebar';
import VocalRemovalCard from './VocalRemovalCard';
import { useRealtimeAudio } from '../../hooks/useRealtimeAudio';
import { useSharedAudio } from '../../contexts/SharedAudioContext';

export interface AudioEditorPanelProps {
  projectId: string
  audioUrl: string
  trackId: string
  musicId?: string
  mode?: 'single' | 'medley'
  tracks?: any[]
  onExport?: (result: { filePath: string, duration: number }) => void
}

const defaultOperations: AudioOperations = {
  trimStart: 0,
  trimEnd: 0,
  speed: 1.0,
  volume: 1.0,
  fadeInEnabled: false,
  fadeInDuration: 1.0,
  fadeOutEnabled: false,
  fadeOutDuration: 1.0,
  reverse: false,
  normalizeEnabled: false,
  normalizeTargetLUFS: -14,
  reverbEnabled: false,
  reverbRoomScale: 50,
  reverbDamping: 50,
  reverbWetLevel: 0.3,
  echoEnabled: false,
  echoDelay: 0.3,
  echoDecay: 0.5,
  bassBoostEnabled: false,
  bassBoostGainDb: 6,
  pitchShiftEnabled: false,
  pitchShiftSemitones: 0,
  vocalRemovalEnabled: false,
  vocalRemovalJobId: null,
  vocalRemovalEngine: null,
  vocalRemovalInstrumentalId: null,
};

export default function AudioEditorPanel({
  audioUrl,
  trackId,
  musicId,
  projectId,
  mode = 'single',
  onExport,
}: AudioEditorPanelProps) {
  const [duration, setDuration] = useState(0);
  const [operations, setOperations] = useState<AudioOperations>({ ...defaultOperations });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error' | 'processing'; text: string } | null>(null);
  const { stopAll } = useSharedAudio();

  const handleTimeUpdate = useCallback((t: number) => setCurrentTime(t), []);
  const handleEnded = useCallback(() => { setIsPlaying(false); setCurrentTime(0); }, []);

  const { seek } = useRealtimeAudio({
    audioUrl,
    operations,
    isPlaying,
    currentTime,
    onTimeUpdate: handleTimeUpdate,
    onEnded: handleEnded,
  });

  const handlePlayPause = () => {
    if (!isPlaying) stopAll();
    setIsPlaying(p => !p);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleExport = async (format: 'mp3-320' | 'wav' | 'flac') => {
    setIsExporting(true);
    setExportMessage({ type: 'processing', text: 'Exporting…' });
    try {
      const outputFormat = format === 'mp3-320' ? 'mp3' : format;
      const body: any = { audioUrl, operations, options: { format: outputFormat, bitrate: format === 'mp3-320' ? '320k' : undefined } };
      if (musicId) body.musicId = musicId;

      const res = await fetch('/api/audio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputPath: audioUrl, operations: buildOpsArray(operations), options: { format: outputFormat } }),
      });

      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${Date.now()}.${outputFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMessage({ type: 'success', text: `Exported as ${format.toUpperCase()}` });
      onExport?.({ filePath: '', duration });
    } catch (e: any) {
      setExportMessage({ type: 'error', text: e.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#07071a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E63946', boxShadow: '0 0 8px #E63946' }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.9)' }}>AUDIO EDITOR</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#00D26A', letterSpacing: '0.1em', background: 'rgba(0,210,106,0.1)', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(0,210,106,0.2)' }}>
            ● LIVE
          </span>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Waveform / TrackLane */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <TrackLane
          audioUrl={audioUrl}
          trackId={trackId}
          trimStart={operations.trimStart}
          trimEnd={operations.trimEnd || duration}
          duration={duration}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onSeek={seek}
          onTrimChange={(s, e) => setOperations(o => ({ ...o, trimStart: s, trimEnd: e }))}
          onPlayPause={handlePlayPause}
          onDurationDetected={setDuration}
          vocalRemovalActive={!!operations.vocalRemovalInstrumentalId}
        />
      </div>

      {/* Main body: controls + sidebar */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Left: Vocal Removal card + transport */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

          {musicId && (
            <VocalRemovalCard
              musicId={musicId}
              projectId={projectId}
              onCompleted={id => setOperations(o => ({ ...o, vocalRemovalEnabled: true, vocalRemovalInstrumentalId: id }))}
            />
          )}

          {/* Transport */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <button onClick={() => { seek(0); setCurrentTime(0); }} style={transportBtn}>⏮</button>
            <button onClick={handlePlayPause} style={{ ...transportBtn, background: 'linear-gradient(135deg,#E63946,#c0392b)', boxShadow: '0 0 12px rgba(230,57,70,0.4)', width: 44, height: 44, fontSize: 16 }}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={() => { setIsPlaying(false); seek(0); setCurrentTime(0); }} style={transportBtn}>⏹</button>
          </div>

          {exportMessage && (
            <div style={{ fontSize: 11, color: exportMessage.type === 'success' ? '#00D26A' : exportMessage.type === 'error' ? '#E63946' : 'rgba(255,255,255,0.5)', marginTop: 8 }}>
              {exportMessage.text}
            </div>
          )}
        </div>

        {/* Right: ControlsSidebar (effects + export) */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <ControlsSidebar
            duration={duration}
            operations={operations}
            onChange={setOperations}
            onPreview={() => {}}
            onExport={handleExport}
            isExporting={isExporting}
          />
        </div>
      </div>
    </div>
  );
}

const transportBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function buildOpsArray(ops: AudioOperations) {
  const arr: any[] = [];
  if (ops.trimStart > 0 || ops.trimEnd > 0) arr.push({ type: 'trim', start: ops.trimStart, end: ops.trimEnd });
  if (ops.speed !== 1.0) arr.push({ type: 'speed', factor: ops.speed });
  if (ops.volume !== 1.0) arr.push({ type: 'volume', factor: ops.volume });
  if (ops.fadeInEnabled) arr.push({ type: 'fadeIn', duration: ops.fadeInDuration });
  if (ops.fadeOutEnabled) arr.push({ type: 'fadeOut', duration: ops.fadeOutDuration });
  if (ops.reverse) arr.push({ type: 'reverse' });
  if (ops.normalizeEnabled) arr.push({ type: 'normalize', targetLUFS: ops.normalizeTargetLUFS });
  if (ops.reverbEnabled) arr.push({ type: 'reverb', roomScale: ops.reverbRoomScale, damping: ops.reverbDamping, wetLevel: ops.reverbWetLevel });
  if (ops.echoEnabled) arr.push({ type: 'echo', delay: ops.echoDelay, decay: ops.echoDecay });
  if (ops.bassBoostEnabled) arr.push({ type: 'bassBoost', gainDb: ops.bassBoostGainDb });
  if (ops.pitchShiftEnabled) arr.push({ type: 'pitchShift', semitones: ops.pitchShiftSemitones });
  return arr;
}
```

- [ ] **Step 2: Add `onDurationDetected` prop to TrackLane**

In `TrackLane.tsx`, add to `TrackLaneProps`:
```typescript
  onDurationDetected?: (duration: number) => void
  vocalRemovalActive?: boolean
```

In the TrackLane component, when the audio element fires `loadedmetadata`, call `onDurationDetected`:
```typescript
  // Find where duration is set internally and add:
  onDurationDetected?.(audioEl.duration);
```

For `vocalRemovalActive`, add a subtle purple tint to the waveform container when true:
```typescript
  style={{ 
    border: `1px solid ${vocalRemovalActive ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
    // ... rest of styles
  }}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 new errors (fix any prop mismatches surfaced).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AudioEditor/AudioEditorPanel.tsx frontend/src/components/AudioEditor/TrackLane.tsx
git commit -m "feat: rewrite AudioEditorPanel with Neon Dark layout and useRealtimeAudio integration"
```

---

## Task 11: YouTube Downloader frontend component

**Files:**
- Create: `frontend/src/components/Downloader/YoutubeDownloader.tsx`
- Modify: `frontend/src/pages/Studio.tsx` (add downloader entry point)

- [ ] **Step 1: Create YoutubeDownloader component**

```typescript
// frontend/src/components/Downloader/YoutubeDownloader.tsx
import { useState, useEffect } from 'react';

interface YoutubeDownloaderProps {
  projectId: string;
  onDownloaded?: (musicId: string, title: string) => void;
}

type DlState = 'idle' | 'running' | 'done' | 'error';

export default function YoutubeDownloader({ projectId, onDownloaded }: YoutubeDownloaderProps) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<DlState>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [result, setResult] = useState<{ musicId: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen to WebSocket for download events
  useEffect(() => {
    if (!downloadId) return;
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.downloadId !== downloadId) return;
        if (data.event === 'download.progress') {
          setProgress(data.progress);
          setMessage(data.message);
        } else if (data.event === 'download.completed') {
          setState('done');
          setResult({ musicId: data.result.musicId, title: data.result.title });
          onDownloaded?.(data.result.musicId, data.result.title);
        } else if (data.event === 'download.failed') {
          setState('error');
          setError(data.error);
        }
      } catch {}
    };
    const ws = (window as any).__studioWs;
    ws?.addEventListener('message', handler);
    return () => ws?.removeEventListener('message', handler);
  }, [downloadId, onDownloaded]);

  const handleDownload = async () => {
    if (!url.trim()) return;
    setState('running');
    setProgress(2);
    setMessage('Submitting...');
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/downloader/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Download failed');
      setDownloadId(data.downloadId);
    } catch (e: any) {
      setState('error');
      setError(e.message);
    }
  };

  const reset = () => { setState('idle'); setUrl(''); setProgress(0); setDownloadId(null); setResult(null); setError(null); };

  return (
    <div style={{ background: '#0d0d23', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>▶</span>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', color: '#fff' }}>YouTube → Music Library</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>yt-dlp · MP3 320K</span>
      </div>

      {state === 'idle' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDownload()}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '9px 14px', outline: 'none' }}
          />
          <button
            onClick={handleDownload}
            disabled={!url.trim()}
            style={{ background: 'linear-gradient(135deg,#E63946,#c0392b)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, padding: '9px 20px', cursor: url.trim() ? 'pointer' : 'not-allowed', opacity: url.trim() ? 1 : 0.4, boxShadow: '0 0 12px rgba(230,57,70,0.3)' }}
          >
            Download
          </button>
        </div>
      )}

      {state === 'running' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{message}</span>
            <span style={{ color: '#E63946', fontWeight: 700, fontSize: 12 }}>{progress}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#E63946,#FFB800)', borderRadius: 3, transition: 'width 0.3s', boxShadow: '0 0 8px rgba(230,57,70,0.4)' }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{url}</div>
        </div>
      )}

      {state === 'done' && result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, color: '#00D26A' }}>✓</span>
          <div>
            <div style={{ color: '#00D26A', fontSize: 12, fontWeight: 700 }}>Saved to Music Library</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{result.title}</div>
          </div>
          <button onClick={reset} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: '4px 12px', cursor: 'pointer' }}>
            New
          </button>
        </div>
      )}

      {state === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#E63946', fontSize: 12 }}>✗ {error}</span>
          <button onClick={reset} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: '4px 12px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add downloader entry point in Studio.tsx**

Find the music step section in `Studio.tsx` (where MusicPlayer renders) and add `YoutubeDownloader` nearby. The exact location depends on the current Studio layout — find a `// Music step` comment or the `MusicPlayer` JSX block and add before it:

```typescript
import YoutubeDownloader from '../components/Downloader/YoutubeDownloader';

// Inside the music step section:
<YoutubeDownloader
  projectId={currentProject.id}
  onDownloaded={(musicId, title) => {
    // Refresh music list — trigger existing reload mechanism
    loadMusic?.();
  }}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Downloader/YoutubeDownloader.tsx frontend/src/pages/Studio.tsx
git commit -m "feat: add YouTubeDownloader component with progress bar, save to Music Library"
```

---

## Task 12: Backend integration tests (full vocal removal flow)

**Files:**
- Modify: `backend/tests/integration/vocal-removal.test.js`

- [ ] **Step 1: Add full job-flow test**

Append to the test file (this test requires the mock server running and a real music record):

```javascript
describe('Vocal removal job flow (FFmpeg fallback)', () => {
  let musicId;
  let projectId;

  before(async () => {
    // Create a project
    const projRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'vocal-test-project' }),
    });
    const proj = await projRes.json();
    projectId = proj.id;

    // Seed a music record pointing to a real test WAV
    const musicRes = await fetch(`${BASE}/api/music/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        title: 'Test Track',
        filePath: 'tests/fixtures/output-mastering/test_spotify_master.wav',
      }),
    });
    const music = await musicRes.json();
    musicId = music.id;
  });

  it('queues job and returns jobId', async () => {
    const res = await fetch(`${BASE}/api/audio/remove-vocals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId, projectId }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.ok(body.jobId, 'expected jobId in response');
  });
});
```

- [ ] **Step 2: Run all vocal removal tests**

```bash
cd backend && npm run dev &
sleep 3
node --test tests/integration/vocal-removal.test.js
```
Expected: detectEngine PASS, 400 validation PASS, 202 job PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/vocal-removal.test.js
git commit -m "test: add vocal removal integration tests"
```

---

## Task 13: Run full test suite + verify

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npm test 2>&1 | tail -30
```
Expected: all passing (no new failures vs baseline).

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Start full stack and smoke-test**

```bash
cd backend && npm run dev &
cd frontend && npm run dev &
sleep 5
open http://localhost:5173
```

Manual checks:
- Audio Editor renders with Neon Dark theme
- Drag reverb slider → audio restarts with reverb applied (no export needed)
- Vocal Removal card visible when musicId prop is provided
- YouTube downloader visible in Music step
- `/health` → `{ demucs: 'available'|'fallback' }`

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: Audio Editor Phase 3 complete — vocal removal, real-time preview, Neon Dark UI, YouTube downloader"
```

---

## Summary

| Feature | Backend | Frontend |
|---------|---------|----------|
| Vocal removal (Demucs/FFmpeg) | `vocal-removal.service.js` + worker + route | `VocalRemovalCard.tsx` |
| Real-time preview | — (Web Audio only) | `useRealtimeAudio.ts` |
| Neon Dark UI | — | `EffectTile.tsx` + rewritten `ControlsSidebar` + `AudioEditorPanel` |
| YouTube downloader | `downloader.service.js` + controller + route | `YoutubeDownloader.tsx` |
| Dual-stem waveform | — | `TrackLane.tsx` `vocalRemovalActive` prop |
