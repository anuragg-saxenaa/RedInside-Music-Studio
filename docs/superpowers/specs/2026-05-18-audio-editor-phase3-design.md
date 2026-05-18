# Audio Editor Phase 3 — Vocal Removal + Real-Time Preview + UI Redesign

**Date:** 2026-05-18  
**Status:** Approved  
**Phase:** 3

---

## Summary

Three tightly related improvements to the Audio Editor:

1. **Vocal Removal** — AI-powered stem separation (Demucs) with FFmpeg center-channel fallback. Strips vocals from any stereo track and saves the instrumental as a new Music library entry.
2. **Real-Time Preview** — All effects previewed instantly via Web Audio API as sliders move. Export still runs through FFmpeg for precision. Matches how professional DAWs (Ableton, Logic) work.
3. **UI/UX Redesign** — Full rewrite of `AudioEditorPanel`, `ControlsSidebar`, and related components. Neon Dark aesthetic: deep navy/black, glowing red/purple/gold accents, colour-coded effect tiles, dual-stem waveform display.

---

## Feature 1: Vocal Removal

### What it does

Separates a mixed track into instrumental + vocal stems. The instrumental is saved as a new `music` record so it appears immediately in the Music step player. The vocal stem is optionally downloadable.

### Engine selection (graceful degradation)

```
Backend startup:
  1. Check: python3 -m demucs --help  (exit 0 = available)
  2. If available → engine = 'demucs'
  3. If not        → engine = 'ffmpeg'
  4. Expose via GET /health → { demucs: 'available' | 'fallback' }
```

| Engine | Method | Quality | Speed | Dependencies |
|--------|--------|---------|-------|-------------|
| **Demucs** (preferred) | Meta AI `htdemucs` model | ~9.5/10 | 30–90s/track (CPU) | `pip install demucs` (~1.5 GB model first run) |
| **FFmpeg fallback** | `pan` filter center-channel subtraction | ~7/10 | <5s/track | None — FFmpeg already present |

### Backend: VocalRemovalService

**File:** `backend/src/modules/audio/vocal-removal.service.js`

```
detectEngine()
  → spawn python3 -m demucs --help
  → return 'demucs' | 'ffmpeg'

removeVocals(inputPath, outputDir, options)
  → if engine === 'demucs':
       python3 -m demucs --two-stems=vocals -o outputDir inputPath
       returns { instrumentalPath, vocalPath, engine: 'demucs' }
  → if engine === 'ffmpeg':
       ffmpeg pan filter: "stereo|c0=c0-c1|c1=c1-c0"
       returns { instrumentalPath, engine: 'ffmpeg' }
```

### API

```
POST /api/audio/remove-vocals
Body: { musicId, projectId }
Response: { jobId }          ← queued via BullMQ (can take 30–90s)

GET /api/jobs/:jobId          ← poll for completion
Result: { instrumentalMusicId, vocalPath?, engine }
```

`instrumentalMusicId` is a new `music_generations` record with `model = 'vocal-removal'` and `title = originalTitle + ' (Instrumental)'`. It appears in the Music step player immediately on job completion via WebSocket `job.completed` event.

### Progress via WebSocket

Worker broadcasts granular progress:
```
{ event: 'job.progress', jobId, progress: 10, message: 'Starting Demucs...' }
{ event: 'job.progress', jobId, progress: 65, message: 'Separating stems...' }
{ event: 'job.completed', jobId, result: { instrumentalMusicId, engine } }
```

UI shows progress bar in the Vocal Removal card during processing.

---

## Feature 2: Real-Time Preview

### Current state

| Effect | Preview method | Latency |
|--------|---------------|---------|
| Trim, speed, volume, fade, reverse | Web Audio API (already live) | ~0ms |
| Reverb, echo, normalize, bass boost, pitch shift | Requires Export click | 2–10s |

### Target state

All effects previewed instantly in the browser via Web Audio API nodes. No server call needed for preview. Export remains FFmpeg for precision.

### Web Audio API mapping

| Effect | Web Audio implementation |
|--------|--------------------------|
| Reverb | `ConvolverNode` — impulse response generated procedurally (no IR file needed) |
| Echo | `DelayNode` + `GainNode` feedback loop |
| Bass Boost | `BiquadFilterNode` type `lowshelf`, `frequency = 80Hz` |
| Pitch Shift | `AudioBufferSourceNode.playbackRate` × semitone ratio (2^(n/12)) |
| Normalize | Analyze peak → apply `GainNode` compensation |
| All existing | Unchanged (already Web Audio) |

**Preview vs Export gap:** Small. Procedural convolution reverb ≈ real reverb. Bass boost filter ≈ FFmpeg `bass` filter. Pitch via playbackRate ≈ FFmpeg `rubberband`. Not sample-exact, but perceptually identical for mixing decisions. UI makes this explicit: badge reads "Preview ≈ / Export exact".

### Implementation: `useRealtimeAudio` hook

**File:** `frontend/src/hooks/useRealtimeAudio.ts`

Encapsulates the Web Audio node graph. Rebuilt whenever `operations` change (debounced 50ms to avoid rapid rebuilds during slider drag).

```
AudioContext
  └── BufferSource (trimmed slice, speed, reverse)
        └── BiquadFilter (bassBoost)
              └── ConvolverNode (reverb)
                    └── DelayNode + GainNode (echo)
                          └── GainNode (volume + fade envelope)
                                └── destination
```

Pitch shift applied by setting `source.playbackRate.value`.

---

## Feature 3: UI Redesign

### Aesthetic

**Neon Dark** — deep navy/black (`#07071a`), red glows (`#E63946`), gold accents (`#FFB800`), purple for pitch/stems (`#a78bfa`). Matches existing Studio dark theme.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ● AUDIO EDITOR          [LIVE ●]      3:42 / 4:18  │  ← header
├─────────────────────────────────────────────────────┤
│  WAVEFORM   [INSTRUMENTAL ▮]  [VOCALS (removed) ▮]  │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ████ waveform ██ (red=instrumental, ░=vocal)    │ │  ← dual-stem TrackLane
│  └─────────────────────────────────────────────────┘ │
├──────────────────────────────┬──────────────────────┤
│  🎤 VOCAL REMOVAL            │  TRANSPORT           │
│  ┌──────────────────────┐   │  ⏹  ▶  ⏭            │
│  │ toggle + progress    │   │                      │
│  └──────────────────────┘   │  [Web Audio · LIVE]  │
│                              │                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ │  ┌────────────────┐  │
│  │REVERB│ │ ECHO │ │ BASS │ │  │ Export 320K MP3 │  │
│  │  32% │ │ OFF  │ │ +6dB │ │  │ exact FFmpeg   │  │
│  └──────┘ └──────┘ └──────┘ │  └────────────────┘  │
│  ┌──────┐ ┌──────┐ ┌──────┐ │  ┌────────────────┐  │
│  │PITCH │ │ NORM │ │SPEED │ │  │   WAV / FLAC   │  │
│  │ +2st │ │ OFF  │ │ 1.0x │ │  └────────────────┘  │
│  └──────┘ └──────┘ └──────┘ │                      │
└──────────────────────────────┴──────────────────────┘
```

### Components to rewrite

| Component | Change |
|-----------|--------|
| `AudioEditorPanel.tsx` | Full rewrite — new layout, integrate `useRealtimeAudio`, vocal removal state |
| `ControlsSidebar.tsx` | Replace with effect tile grid (6 tiles: reverb, echo, bass, pitch, norm, speed) |
| `TrackLane.tsx` | Add dual-stem mode: shows instrumental (red) + vocal (purple) layers when vocals removed |
| `ControlsSidebar.tsx` → `AudioOperations` type | Add `vocalRemovalEnabled`, `vocalRemovalJobId`, `vocalRemovalEngine` |

### New component: `VocalRemovalCard.tsx`

Standalone card rendered above the effect grid:
- Toggle switch (on/off)
- Engine badge: `AI MODEL` (green, Demucs) or `FAST MODE` (yellow, FFmpeg)
- Progress bar + status text during job (polls via `useWebSocket`)
- On completion: shows "Instrumental saved to Music library" with link

### Effect tile design

Each effect tile (`EffectTile.tsx`):
- Toggle on/off (top-right pill switch)
- Big monospace value readout
- Inline range slider (coloured track when active)
- Color coding: red=reverb/echo (space effects), gold=bass boost (dynamics), purple=pitch (tonal), green=normalize

---

## Backend Changes

### New files

| File | Purpose |
|------|---------|
| `backend/src/modules/audio/vocal-removal.service.js` | Engine detection + Demucs/FFmpeg separation logic |
| `backend/src/modules/audio/vocal-removal.worker.js` | BullMQ worker for long-running separation jobs |

### Modified files

| File | Change |
|------|--------|
| `backend/src/modules/audio/audio.controller.js` | Add `POST /api/audio/remove-vocals` handler |
| `backend/src/api/routes/audio.routes.js` | Register new route |
| `backend/src/server.js` | Run `VocalRemovalService.detectEngine()` on startup, expose in `/health` |
| `backend/src/queue/queue.config.js` | Add `vocal-removal` queue |

### Health endpoint update

```json
GET /health
{
  "status": "ok",
  "minimax": "real",
  "demucs": "available"   ← new field: "available" | "fallback"
}
```

---

## Frontend Changes

### New files

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useRealtimeAudio.ts` | Web Audio node graph, rebuilt on ops change |
| `frontend/src/components/AudioEditor/VocalRemovalCard.tsx` | Vocal removal UI card |
| `frontend/src/components/AudioEditor/EffectTile.tsx` | Single reusable effect tile |

### Modified files

| File | Change |
|------|--------|
| `AudioEditorPanel.tsx` | Full rewrite — new layout, `useRealtimeAudio`, vocal removal |
| `ControlsSidebar.tsx` | Replace slider list with `EffectTile` grid |
| `TrackLane.tsx` | Dual-stem waveform rendering |
| `AudioOperations` type | Add vocal removal fields |

---

## Data Flow: Vocal Removal

```
User toggles Vocal Removal ON
        │
        ▼
VocalRemovalCard calls POST /api/audio/remove-vocals
  { musicId, projectId }
        │
        ▼
AudioController queues vocal-removal job → BullMQ
  → 202 { jobId }
        │
        ▼
VocalRemovalWorker picks up job:
  1. VocalRemovalService.detectEngine()
  2. If demucs: python3 -m demucs --two-stems=vocals -o tmpDir inputPath
     If ffmpeg:  ffmpeg pan filter → instrumentalPath
  3. MusicModel.create({ title: '...Instrumental', model: 'vocal-removal' })
  4. ProjectModel.incrementVersion('music')
  5. ws.broadcast({ event: 'job.completed', jobId, result: { instrumentalMusicId, engine } })
        │
        ▼
Frontend useWebSocket receives job.completed
  → VocalRemovalCard shows "Saved to Music library"
  → MusicPlayer reloads track list (sees new instrumental)
```

---

## Data Flow: Real-Time Preview

```
User drags reverb slider to 45%
        │
        ▼ (50ms debounce)
useRealtimeAudio rebuilds node graph:
  source → bassBoost filter → convolver (reverb=45%) → delay → gain → destination
        │
        ▼
If playing: stops current source, restarts from currentTime with new graph
  → user hears reverb change in ~50ms
        │
No server call. No spinner.
        │
User clicks Export 320K
        │
        ▼
POST /api/audio/process { operations: [...], inputPath }
  → FFmpeg builds exact filter graph → output file → download
```

---

## Portability

| Environment | Vocal Removal | Real-time Preview | Export |
|-------------|---------------|-------------------|--------|
| Local dev | Demucs (after `pip install demucs`) or FFmpeg fallback | ✓ Web Audio | ✓ FFmpeg |
| VPS / Docker | Demucs (install in Dockerfile) or FFmpeg fallback | ✓ Web Audio | ✓ FFmpeg |
| Serverless (Vercel) | ✗ Not supported (no FFmpeg/Python) | ✓ Web Audio | ✗ Not supported |

The app never crashes on Vercel — vocal removal button is hidden when backend unavailable, export shows "not available in this deployment".

---

## Testing

### Backend integration tests (Node test runner)

- `POST /api/audio/remove-vocals` → 202 + jobId
- `GET /api/jobs/:id` → polls to `completed`; result has `instrumentalMusicId`
- `GET /api/music/:instrumentalMusicId` → record exists, `model = 'vocal-removal'`
- FFmpeg fallback: mock `demucs` as unavailable, verify fallback runs
- `/health` → exposes `demucs` field

### Frontend E2E (Playwright)

- Vocal Removal card visible in Audio Editor
- Toggle on → progress bar appears → job completes → "Saved to Music library" shown
- Engine badge shows correct value
- Real-time: drag reverb slider → audio restarts without clicking anything (no export needed)
- Export after vocal removal → downloads instrumental

---

## Phase 3 feature list update

Add to `docs/superpowers/IMPLEMENTATION_STATUS.md`:

```
| Vocal removal (Demucs AI + FFmpeg fallback) | ✅ | ✅ |
| Real-time effect preview (Web Audio API)    | ✅ | ✅ |
| Audio Editor UI redesign (Neon Dark)        | ✅ | ✅ |
```
