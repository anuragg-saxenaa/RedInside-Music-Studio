# RedInside Music Studio — Architecture & Complete Flow

**Last updated:** 2026-05-18

---

## High-Level System Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (Browser)                               │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    React + TypeScript (Vite)                        │ │
│  │                                                                     │ │
│  │  App.tsx ──► ProjectSelector ──► Studio (8-step workflow)          │ │
│  │                                     │                              │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │             WorkflowStepper (step nav bar)                   │  │ │
│  │  │  Lyrics │ Music │ Artwork │ Video │ Voice │ Medley │ Export  │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │          │        │        │       │       │        │       │       │ │
│  │  LyricsEditor  MusicPlayer  ArtworkGen  VideoPreview  VoiceDesign  │ │
│  │                  │            MedleyMixer  MasteringPanel          │ │
│  │                  └─ AudioEditor (inline per-track)                 │ │
│  │                                                                     │ │
│  │  Other pages: History │ ViralToolkit │ Settings                    │ │
│  │                                                                     │ │
│  │  Shared: useWebSocket (WS job events) │ useSharedAudio (playback)  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                       │ HTTP REST + WebSocket                             │
└───────────────────────┼───────────────────────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────────────────────┐
│                         BACKEND (Node.js / Express)                       │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     API Routes (registered in server.js)           │ │
│  │  /api/projects   /api/lyrics    /api/music    /api/audio           │ │
│  │  /api/video      /api/image     /api/voice    /api/mastering        │ │
│  │  /api/medley     /api/history   /api/viral    /api/jobs             │ │
│  │  /api/upload     /api/settings  /api/ffmpeg   /health              │ │
│  └──────────────────────────────┬──────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼──────────────────────────────────────┐ │
│  │                          Controllers                                │ │
│  │  LyricsController  MusicController  AudioController  VideoController│ │
│  │  ImageController   VoiceController  MasteringController             │ │
│  │  MedleyController  HistoryController  ViralController               │ │
│  │  JobsController    SettingsController  UploadController             │ │
│  └──────────────────────────────┬──────────────────────────────────────┘ │
│                                  │                                       │
│  ┌───────────────────────────────▼──────────────────────────────────────┐ │
│  │                           Services                                  │ │
│  │  LyricsService    MusicService     AudioService     FFmpegService   │ │
│  │  VideoService     ImageService     VoiceService                     │ │
│  │  MasteringService MedleyService    HistoryService   ViralService    │ │
│  │  AudioMasteringService (Spotify LUFS normalization)                 │ │
│  └─────────┬──────────────────────┬───────────────────────────────────┘ │
│            │                      │                                      │
│  ┌─────────▼──────────┐  ┌────────▼─────────────────────────────────┐  │
│  │   BullMQ Queues    │  │         External integrations             │  │
│  │  lyrics-generation │  │  MiniMax API  (minimax.client.js)        │  │
│  │  music-generation  │  │  FFmpeg CLI   (fluent-ffmpeg)            │  │
│  │  video-generation  │  │  Redis        (ioredis)                  │  │
│  │  ffmpeg-processing │  └─────────────────────────────────────────┘  │
│  └─────────┬──────────┘                                                │
│            │                                                            │
│  ┌─────────▼──────────────────────────────────────────────────────────┐ │
│  │                      BullMQ Workers                                │ │
│  │  lyrics.worker.js  music.worker.js  video.worker.js  ffmpeg.worker │ │
│  │  (each worker fires WS broadcast on job.started / completed/failed)│ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌──────────────────────┐   ┌───────────────────────────────────────┐   │
│  │    SQLite Database   │   │         File Storage                  │   │
│  │  music-studio.sqlite │   │  storage/projects/{id}/               │   │
│  │  (better-sqlite3)    │   │  (path configurable via STORAGE_PATH) │   │
│  └──────────────────────┘   └───────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │  WebSocket Server (ws://localhost:3000)  — ws.server.js             ││
│  │  Broadcasts: job.started │ job.completed │ job.failed               ││
│  └──────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────┘
          │                        │
  ┌───────▼──────┐       ┌─────────▼────────┐
  │  Redis :6379 │       │   MiniMax API    │
  │  (BullMQ     │       │  api.minimax.io  │
  │   backend)   │       │  lyrics/music/   │
  └──────────────┘       │  image/video/    │
                         │  voice           │
                         └──────────────────┘
```

---

## 8-Step Studio Workflow

```
 ✍️ Lyrics → 🎵 Music → 🖼️ Artwork → 🎬 Video → 🎤 Voice → 🎛️ Medley → 📦 Export
    [1]          [2]         [3]          [4]         [5]         [6]         [7]
```

All steps always accessible (no prerequisite gating). Each step is an independent panel that reads/writes data for the selected project.

---

## Complete Data Flow: Music Generation

```
User                     Studio.tsx              Backend                MiniMax
  │                           │                      │                      │
  │  click Generate Music     │                      │                      │
  │──────────────────────────▶│                      │                      │
  │                           │  POST /api/music/generate                   │
  │                           │  { projectId, lyricsId, model, settings }   │
  │                           │─────────────────────▶│                      │
  │                           │                      │                      │
  │                           │                      │  addMusicJob(BullMQ) │
  │                           │                      │─ ─ ─ ─ ─ ─ ─ ─ ─ ─▶│
  │                           │  202 { jobId }        │                      │
  │                           │◀─────────────────────│                      │
  │                           │                      │                      │
  │  (useWebSocket listening) │   [worker picks up job]                     │
  │                           │                      │ POST /v1/music_generation
  │                           │                      │─────────────────────▶│
  │                           │                      │                      │
  │                           │                      │◀─────────────────────│
  │                           │                      │  { data: { audio: "https://..." },
  │                           │                      │    extra_info: { music_duration,
  │                           │                      │                  music_sample_rate,
  │                           │                      │                  bitrate } }
  │                           │                      │                      │
  │                           │                      │  1. Download audio buffer
  │                           │                      │  2. AudioMasteringService.masterToSpotify()
  │                           │                      │     → FFmpeg loudnorm (-14 LUFS, -1 dBTP)
  │                           │                      │  3. storage.saveAudioFile()
  │                           │                      │     → storage/projects/{id}/generations/music/
  │                           │                      │  4. MusicModel.create() → SQLite
  │                           │                      │  5. ProjectModel.incrementVersion()
  │                           │                      │  6. HistoryService.linkGeneration()
  │                           │                      │     → generation_chains table
  │                           │                      │  7. ws.broadcast({ event: 'job.completed',
  │                           │                      │                    jobId, result })
  │                           │                      │
  │  WS: job.completed event  │                      │
  │◀─────────────────────────│                      │
  │                           │                      │
  │  (MusicPlayer reloads    │                      │
  │   track list via API)     │                      │
```

---

## Audio Processing Chain

```
Original MP3 (from MiniMax URL)
        │
        ▼
AudioMasteringService.masterToSpotify()  [auto on every generation]
  └─ FFmpeg loudnorm filter
     -14 LUFS integrated loudness
     -1 dBTP true peak
     Output: {id}_spotify_master.wav
        │
        ▼
Stored as processed_file_path in music_generations
        │
        ├─── GET /api/music/:id/file  →  streams processed (falls back to original)
        │
        ├─── AudioEditor operations (on demand):
        │      trim / speed / volume / fade in+out / reverse
        │      normalize / reverb / echo / bass boost / pitch shift
        │      POST /api/audio/process  →  FFmpeg effects chain
        │
        └─── Medley export:
               MedleyProcessor.exportMedley()
               → FFmpeg concat filter → merged MP3
               → POST /api/medley/:id/save-to-music → MusicModel.create()
```

---

## Mastering Flow (Batch)

```
Upload panel (Export step)
        │
        ▼
POST /api/mastering/upload/:projectId
        │ multipart file upload
        ▼
storage/projects/{id}/uploads/{fileId}.mp3
        │
        ▼
POST /api/mastering/process  { projectId, fileId }
        │
        ▼
AudioMasteringService.masterToSpotify()
  └─ FFmpeg loudnorm → {fileId}_spotify_master.wav
     storage/projects/{id}/masters/
        │
        ├─── GET /api/mastering/zip  →  JSZip → download all mastered files
        │
        └─── POST /api/mastering/save-to-music  { projectId, fileIds }
               → MusicModel.create() per file
               → ProjectModel.incrementVersion('music')
               → appears in Music step player
```

---

## Medley Flow

```
Medley step (MedleyPanel)
        │
        ▼
POST /api/medley  { projectId, name }  →  MedleyModel.create()
        │
        ▼
Add tracks:
POST /api/medley/:id/tracks  { musicId }
  └─ MedleyController resolves musicId → filesystem path
     or accepts sourceFilePath directly
        │
        ▼
Reorder / configure per track (volume, fade, trim, speed)
PUT /api/medley/:id/tracks  { orders: [...] }
        │
        ▼
POST /api/medley/:id/export  { format: 'mp3', bitrate: 320 }
  └─ MedleyProcessor.exportMedley()
     → resolves all track paths
     → FFmpeg concat filter with crossfade
     → output: storage/projects/{id}/medley-{id}.mp3
     → MedleyModel.update({ outputFilePath, totalDuration })
     → returns { filePath, duration, downloadUrl: '/api/medley/:id/file' }
        │
        ├─── GET /api/medley/:id/file  →  streams MP3 for download
        │
        └─── POST /api/medley/:id/save-to-music
               → MusicModel.create({ title: medley.name, model: 'medley' })
               → ProjectModel.incrementVersion('music')
               → appears in Music step player
```

---

## Generation Chain Linking

```
Lyrics generated
        │
        ▼
LyricsModel.create()  →  lyrics_id = "abc"
        │
        ▼
Music generated from lyrics_id
        │
        ▼
MusicModel.create()  →  music_id = "xyz", lyrics_id = "abc"
HistoryService.linkGeneration(lyricsId, musicId)
        │
        ▼
generation_chains table:
  parent_id = "abc"  (lyrics)
  child_id  = "xyz"  (music)
  chain_type = "lyrics->music"
        │
        ▼
GET /api/history/chain/:id
  └─ accepts either the chain ID or any member generation ID
  └─ returns full chain: lyrics → music → video linkage
```

---

## WebSocket Real-Time Updates

```
Backend ws.server.js (ws://localhost:3000)
        │
        ├─── Client connects on Studio load (useWebSocket hook)
        │
        ├─── Worker fires on job.started:
        │      ws.broadcast({ event: 'job.started', jobId, type })
        │
        ├─── Worker fires on job.completed:
        │      ws.broadcast({ event: 'job.completed', jobId, type, result })
        │
        └─── Worker fires on job.failed:
               ws.broadcast({ event: 'job.failed', jobId, type, error })

Frontend useWebSocket:
  │  subscribes to all events
  ├─ music completion → MusicPlayer reloads track list
  ├─ video completion → VideoPreview reloads
  └─ all events → JobsPanel updates status indicators
```

---

## Database Schema

```
projects
  id, name, description, workflow_mode
  current_lyrics_version, current_music_version
  current_video_version
  created_at, updated_at

lyrics_generations
  id, project_id, version, title, content
  style_preset, prompt, model
  file_path, created_at

music_generations
  id, project_id, lyrics_id, version, title
  model, style, settings (JSON)
  original_file_path, processed_file_path
  artwork_path
  duration_seconds, sample_rate, bitrate
  created_at

video_generations
  id, project_id, music_id, version
  model, prompt, settings (JSON)
  file_path, status, job_id
  created_at

jobs
  id, project_id, type, status
  progress, input_params (JSON), result (JSON)
  error_message
  created_at, started_at, completed_at

generation_chains
  id, parent_id, child_id, chain_type
  created_at

medleys
  id, project_id, name, description
  output_file_path, total_duration, track_count
  created_at, updated_at

medley_tracks
  id, medley_id, source_file_path, track_order
  trim_start, trim_end, speed, volume
  fade_in, fade_out, duration_seconds
  created_at

settings
  id (always 1), api_key, default_model
  auto_mastering (0/1), updated_at

ffmpeg_operations
  id, music_id, operation_type
  input_path, output_path, params (JSON)
  status, error, created_at
```

---

## File Storage Layout

```
storage/
└── projects/
    └── {projectId}/
        ├── generations/
        │   ├── lyrics/
        │   │   ├── v1.json
        │   │   └── v2.json
        │   ├── music/
        │   │   ├── v1-original.mp3          # MiniMax output (256kbps URL download)
        │   │   ├── v1_spotify_master.wav    # Auto-mastered (-14 LUFS)
        │   │   ├── v2-original.mp3
        │   │   └── v2_spotify_master.wav
        │   └── video/
        │       └── v1.mp4
        ├── uploads/
        │   └── {fileId}.mp3                 # Batch mastering uploads
        ├── masters/
        │   └── {fileId}_spotify_master.wav  # Batch mastered outputs
        ├── artwork/
        │   └── {timestamp}.png              # Generated artwork images
        └── medley-{medleyId}.mp3            # Exported medley files
```

---

## Complete API Surface

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects` | Create project |
| GET | `/api/projects` | List all |
| GET | `/api/projects/:id` | Get project |
| PUT | `/api/projects/:id` | Update |
| DELETE | `/api/projects/:id` | Delete |
| GET | `/api/projects/:id/history` | Generation history |
| GET | `/api/projects/:id/artwork` | Project artwork |
| POST | `/api/projects/:id/artwork` | Save artwork |
| GET | `/api/projects/:id/lyrics` | Lyrics list |
| GET | `/api/projects/:id/music` | Music list |
| GET | `/api/projects/:id/medleys` | Medley list |

### Lyrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lyrics/generate` | Generate (sync, no queue) |
| POST | `/api/lyrics/edit/:id` | Edit existing lyrics |
| GET | `/api/lyrics/:id` | Get by ID |
| GET | `/api/lyrics/presets` | Style preset options |

### Music
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/music/generate` | Queue music generation |
| POST | `/api/music/cover` | Queue cover/voice-transfer job |
| GET | `/api/music/:id` | Get record |
| GET | `/api/music/:id/file` | Stream audio (prefers 320kbps) |
| GET | `/api/music/:id/download` | Download audio |
| POST | `/api/music/:id/convert` | Convert to 320kbps MP3 |
| DELETE | `/api/music/:id` | Delete |
| GET | `/api/music/settings` | Audio settings options |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/:id` | Get job status + result |
| POST | `/api/jobs/:id/cancel` | Cancel queued job |
| GET | `/api/jobs/project/:projectId` | All jobs for project |

### Audio / FFmpeg
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audio/process` | Apply effects chain |
| POST | `/api/audio/trim` | Trim audio |
| GET | `/api/audio/:id/metadata` | Audio metadata |
| POST | `/api/ffmpeg/convert-bitrate` | Bitrate conversion |
| POST | `/api/ffmpeg/merge` | Merge audio files |

### Mastering
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mastering/upload/:projectId` | Upload files |
| POST | `/api/mastering/process` | Master to Spotify standard |
| POST | `/api/mastering/save-to-music` | Save mastered to Music library |
| GET | `/api/mastering/zip` | Download ZIP of mastered files |
| GET | `/api/mastering/files/:projectId` | List mastering files |

### Medley
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/medley` | Create medley |
| GET | `/api/medley/:id` | Get with tracks |
| PUT | `/api/medley/:id` | Update |
| DELETE | `/api/medley/:id` | Delete |
| POST | `/api/medley/:id/tracks` | Add track (musicId or path) |
| PUT | `/api/medley/:id/tracks` | Reorder tracks |
| DELETE | `/api/medley/:id/tracks/:trackId` | Remove track |
| POST | `/api/medley/:id/export` | Export merged MP3 |
| GET | `/api/medley/:id/file` | Stream exported file |
| POST | `/api/medley/:id/save-to-music` | Save export to Music library |
| GET | `/api/medley/:id/duration` | Total duration |

### Video
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/video/generate` | Queue video generation |
| GET | `/api/video/:id` | Get record |
| GET | `/api/video/:id/status` | Poll status |
| GET | `/api/video/:id/file` | Stream video |
| GET | `/api/video/:id/download` | Download video |

### Image / Artwork
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/image/generate` | Generate artwork |
| GET | `/api/projects/:projectId/images` | List project images |

### Voice
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/design` | Design custom voice |
| POST | `/api/voice/clone` | Clone from audio sample |
| GET | `/api/voices` | List available voices |

### History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history/:projectId` | Full project history |
| GET | `/api/history/chain/:id` | Generation chain (accepts any member ID) |
| POST | `/api/history/replay/:id` | Replay version |
| POST | `/api/history/compare` | Diff two versions |
| GET | `/api/history/export/:projectId` | Export history JSON |
| DELETE | `/api/history/:id` | Delete version |

### Viral Toolkit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/viral/trends` | Trending topics |
| POST | `/api/viral/analyze-hook` | Hook quality score |
| GET | `/api/viral/templates` | Structure templates |
| POST | `/api/viral/analyze-reference` | Analyze reference track |
| POST | `/api/viral/optimize` | Apply optimizations |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/audio` | Upload audio file (multipart) |
| POST | `/api/upload/url` | Import audio from URL |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get current settings |
| PATCH | `/api/settings` | Update (API key, model, mastering) |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Status + minimax mode (real/mock) |

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| `output_format: 'url'` for music | MiniMax times out on >30s songs with buffer format |
| Auto-mastering on every music generation | Spotify-standard output by default; no manual step |
| BullMQ + Redis for music/video | AI calls take 30–120s; async prevents HTTP timeout |
| Lyrics generation is synchronous | Fast enough (<5s); no queue needed |
| `canAccessStep` always returns `true` | Iterative creation; users shouldn't be gated |
| `data-testid` on all interactive elements | Playwright tests bind to stable selectors, not text |
| Mock MiniMax server on port 8999 | E2E tests run without API credits; `MINIMAX_BASE_URL` override |
| URL path guard in `findByProject` | `http://` paths from mock server would fail `fs.existsSync` |
| Generation chain in `generation_chains` table | Enables history traversal without coupling models |
