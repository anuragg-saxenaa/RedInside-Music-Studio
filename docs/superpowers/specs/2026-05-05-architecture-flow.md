# RedInside Music Studio - Architecture & Flow

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                            │
│  ┌─────────┐    ┌────────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │ React   │───▶│ Lyrics     │───▶│ Music        │───▶│ Process     │  │
│  │ Frontend│    │ Editor     │    │ Player       │    │ (FFmpeg)    │  │
│  └─────────┘    └────────────┘    └──────────────┘    └─────────────┘  │
│       │               │                  │                    │         │
│       │               ▼                  ▼                    ▼         │
│       │        ┌──────────────────────────────────────────────────┐   │
│       │        │              WorkflowStepper                       │   │
│       │        │   ✍️Lyrics ─── 🎵Music ─── 🔧Process              │   │
│       │        └──────────────────────────────────────────────────┘   │
│       │                                                               │
└───────┼───────────────────────────────────────────────────────────────┘
        │ HTTP REST
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Express)                              │
│                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────────┐  │
│  │ API Routes   │   │ Middleware   │   │ Controllers                │  │
│  │ /api/projects│──▶│ errorHandler │──▶│ JobsController             │  │
│  │ /api/jobs    │   │ validation   │   │ MusicController            │  │
│  │ /api/music   │   └──────────────┘   │ LyricsController           │  │
│  │ /api/lyrics  │                       └────────────┬─────────────┘  │
│  └──────┬───────┘                                      │               │
│         │                                              ▼               │
│         │              ┌────────────────────────────────────────────┐  │
│         │              │              Services                      │  │
│         │              │  ┌─────────────┐ ┌─────────────┐ ┌───────┐ │  │
│         │              │  │ MusicService│ │LyricsService│ │FFmpeg │ │  │
│         │              │  └──────┬──────┘ └──────┬──────┘ │Service│ │  │
│         │              │         │               │        └───┬───┘ │  │
│         │              └─────────┼───────────────┼────────────┼─────┘  │
│         │                        │               │          │        │
│         │                        ▼               ▼          ▼        │
│         │              ┌────────────────────────────────────────────┐ │
│         │              │            BullMQ Job Queue                 │ │
│         │              │  ┌─────────────────────────────────────────┐ │ │
│         │              │  │ lyrics-generation │ music-generation   │ │ │
│         │              │  │ ffmpeg-processing │                    │ │ │
│         │              │  └─────────────────────────────────────────┘ │ │
│         │              └────────────────────────────────────────────┘ │
│         │                               │                              │
│         │                               ▼                              │
│         │              ┌────────────────────────────────────────────┐ │
│         │              │            Workers                          │ │
│         │              │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │ │
│         │              │  │ lyrics   │ │ music    │ │ ffmpeg     │  │ │
│         │              │  │.worker.js│ │.worker.js│ │.worker.js  │  │ │
│         │              │  └────┬─────┘ └────┬─────┘ └─────┬──────┘  │ │
│         │              └───────┼───────────┼──────────────┼────────┘  │
│         │                      │           │              │           │
│         │                      ▼           ▼              ▼           │
│         │              ┌────────────────────────────────────────────┐ │
│         │              │              MiniMax API                   │ │
│         │              │         (Lyrics + Music Generation)         │ │
│         │              └────────────────────────────────────────────┘ │
│         │                                                              │
│         │                               │                              │
│         │                               ▼                              │
│         │              ┌────────────────────────────────────────────┐ │
│         │              │              FFmpeg                       │ │
│         │              │         (320kbps MP3 Conversion)           │ │
│         │              └────────────────────────────────────────────┘ │
│         │                                                              │
│         │              ┌────────────────────────────────────────────┐ │
│         │              │          Storage (File System)              │ │
│         │              │  storage/projects/{id}/generations/         │ │
│         │              │    ├── lyrics/v1.json                       │ │
│         │              │    ├── music/v1-original.mp3 (256kbps)       │ │
│         │              │    └── music/v1-processed.mp3 (320kbps)       │ │
│         │              └────────────────────────────────────────────┘ │
│         │                                                              │
│         │              ┌────────────────────────────────────────────┐ │
│         │              │          SQLite Database                    │ │
│         │              │  database/music-studio.sqlite               │ │
│         │              │    ├── projects                             │ │
│         │              │    ├── lyrics_generations                  │ │
│         │              │    ├── music_generations                   │ │
│         │              │    └── jobs                                 │ │
│         │              └────────────────────────────────────────────┘ │
│         │                                                              │
└─────────┼──────────────────────────────────────────────────────────────┘
          │
          │           ┌────────────────────────────────────────────┐
          │           │              Redis                          │
          │           │         (BullMQ Queue Backend)            │
          │           │    Port: 6379 (Docker: redinside-redis)    │
          │           └────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              MiniMax API                                 │
│                    (External - Cloud AI Services)                        │
│                                                                         │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────┐ │
│  │ /v1/lyrics_      │  │ /v1/music_        │  │ /v1/video_           │ │
│  │   generation     │  │   generation      │  │   generation (async) │ │
│  │   (sync)         │  │   (sync w/url)    │  │   (poll for status)  │ │
│  └──────────────────┘  └───────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Workflow: Lyrics → Music → 320kbps

```
┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Generate Lyrics                                                 │
└──────────────────────────────────────────────────────────────────────────┘

Client                          Backend                          MiniMax
  │                                 │                                 │
  │  POST /api/lyrics/generate     │                                 │
  │  {projectId, prompt, preset}   │                                 │
  │ ──────────────────────────────▶ │                                 │
  │                                 │                                 │
  │                                 │  1. Create job record           │
  │                                 │  2. addLyricsJob() → BullMQ     │
  │                                 │                                 │
  │                                 │ ───────────────────────────────▶│
  │                                 │        /v1/lyrics_generation    │
  │                                 │                                 │
  │                                 │ ◀────────────────────────────────│
  │                                 │        { data: { lyrics: "..." } }
  │                                 │                                 │
  │                                 │  Save lyrics to storage/        │
  │                                 │  Save record to SQLite          │
  │                                 │  Update job status → completed   │
  │                                 │                                 │
  │  202 { jobId }                  │                                 │
  │ ◀────────────────────────────────                                 │
  │                                 │                                 │
  │  Poll GET /api/jobs/{jobId}     │                                 │
  │ ──────────────────────────────▶ │                                 │
  │                                 │                                 │
  │  { status: "completed" }        │                                 │
  │ ◀────────────────────────────────                                 │

Result: Lyrics saved to storage + DB, job completed

┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Generate Music (URL Format)                                     │
└──────────────────────────────────────────────────────────────────────────┘

Client                          Backend                          MiniMax
  │                                 │                                 │
  │  POST /api/music/generate       │                                 │
  │  {projectId, lyricsId, model}   │                                 │
  │ ──────────────────────────────▶ │                                 │
  │                                 │                                 │
  │                                 │  1. Create job record           │
  │                                 │  2. addMusicJob() → BullMQ       │
  │                                 │                                 │
  │                                 │  MusicService.generateMusic()    │
  │                                 │  requestParams = {              │
  │                                 │    model,                       │
  │                                 │    lyrics: lyricsContent,       │
  │                                 │    output_format: "url"  ← KEY  │
  │                                 │  }                              │
  │                                 │                                 │
  │                                 │ ───────────────────────────────▶│
  │                                 │        /v1/music_generation     │
  │                                 │                                 │
  │                                 │ ◀────────────────────────────────│
  │                                 │   { data: { audio: "https://..." }}
  │                                 │                                 │
  │                                 │  1. axios.get(audioUrl)         │
  │                                 │     → Download MP3 buffer       │
  │                                 │                                 │
  │                                 │  2. storage.saveAudioFile()     │
  │                                 │     → storage/.../v1-original.mp3
  │                                 │                                 │
  │                                 │  3. MusicModel.create()         │
  │                                 │     → Save to SQLite            │
  │                                 │                                 │
  │  202 { jobId }                  │                                 │
  │ ◀────────────────────────────────                                 │
  │                                 │                                 │
  │  Poll GET /api/jobs/{jobId}     │                                 │
  │ ──────────────────────────────▶ │                                 │
  │                                 │                                 │
  │  { status: "completed" }        │                                 │
  │ ◀────────────────────────────────                                 │

Result: Original MP3 (256kbps) saved, record in DB

┌──────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Process to 320kbps (FFmpeg)                                     │
└──────────────────────────────────────────────────────────────────────────┘

Client                          Backend                          FFmpeg
  │                                 │                                 │
  │  POST /api/jobs                 │                                 │
  │  {type: "ffmpeg-process",      │                                 │
  │   musicId, projectId}           │                                 │
  │ ──────────────────────────────▶ │                                 │
  │                                 │                                 │
  │                                 │  1. Create job record           │
  │                                 │  2. addFfmpegJob() → BullMQ      │
  │                                 │                                 │
  │                                 │  FFmpegService.processMusic()   │
  │                                 │  1. Find music record           │
  │                                 │  2. ffmpeg(input, 320kbps, out)  │
  │                                 │                                 │
  │                                 │  ┌─────────────────────────────┐ │
  │                                 │  │ ffmpeg -i v1-original.mp3   │ │
  │                                 │  │   -audioBitrate 320         │ │
  │                                 │  │   -audioCodec libmp3lame    │ │
  │                                 │  │   v1-processed.mp3          │ │
  │                                 │  └─────────────────────────────┘ │
  │                                 │                                 │
  │                                 │  3. Update music.processed_path │
  │                                 │                                 │
  │  202 { jobId }                  │                                 │
  │ ◀────────────────────────────────                                 │
  │                                 │                                 │
  │  Poll GET /api/jobs/{jobId}     │                                 │
  │ ──────────────────────────────▶ │                                 │
  │                                 │                                 │
  │  { status: "completed",        │                                 │
  │    result: { bitrate: 320000 }} │                                 │
  │ ◀────────────────────────────────                                 │

Result: 320kbps MP3 saved as v1-processed.mp3

┌──────────────────────────────────────────────────────────────────────────┐
│  Download Flow                                                           │
└──────────────────────────────────────────────────────────────────────────┘

Client                          Backend                          Storage
  │                                 │                                 │
  │  GET /api/music/{id}/file       │                                 │
  │ ──────────────────────────────▶ │                                 │
  │                                 │                                 │
  │                                 │  1. Find music record           │
  │                                 │  2. Check processed_file_path   │
  │                                 │     → Prefer 320kbps version     │
  │                                 │     → Fall back to original      │
  │                                 │                                 │
  │                                 │  storage.readFile(filePath)      │
  │                                 │ ◀─────────────────────────────── │
  │                                 │                                 │
  │  200 audio/mpeg                 │
  │ ◀────────────────────────────────                                 │
  │                                 │                                 │

Note: Audio player and download link both use same endpoint, served by
      MusicController.getFile()
```

---

## Database Schema

```
┌─────────────────────┐       ┌──────────────────────┐
│     projects        │       │  lyrics_generations  │
├─────────────────────┤       ├──────────────────────┤
│ id                  │──┐    │ id                   │
│ name                │  │    │ project_id          │◀─┐
│ workflow_mode       │  │    │ version              │  │
│ current_lyrics_ver  │  │    │ content             │  │
│ current_music_ver  │  │    │ style_preset        │  │
│ created_at         │  └───▶│ created_at           │  │
└─────────────────────┘       └──────────────────────┘  │
                                                      │
┌─────────────────────┐       ┌──────────────────────┐
│  music_generations  │       │       jobs           │
├─────────────────────┤       ├──────────────────────┤
│ id                  │       │ id                   │
│ project_id         │◀─┐    │ project_id          │◀─┐
│ lyrics_id          │  │    │ type                 │  │
│ version            │  │    │ status (queued/      │  │
│ model              │  │    │   active/completed/  │  │
│ original_file_path │  │    │   failed)            │  │
│ processed_file_path│  │    │ progress             │  │
│ duration_seconds   │  │    │ input_params (JSON)  │  │
│ bitrate            │  │    │ result (JSON)         │  │
│ created_at         │  │    │ error_message        │  │
└─────────────────────┘  │    │ created_at          │  │
                         │    │ started_at          │  │
                         │    │ completed_at        │  │
                         └────┘└──────────────────────┘

Note: jobs.type = 'generate-lyrics' | 'generate-music' | 'ffmpeg-process'
      jobs.input_params = { lyricsId } or { musicId } or { musicId }
```

---

## File Storage Structure

```
storage/
└── projects/
    └── {projectId}/
        └── generations/
            ├── lyrics/
            │   ├── v1.json     # Lyrics content
            │   └── v2.json
            ├── music/
            │   ├── v1-original.mp3    # From MiniMax (256kbps)
            │   ├── v1-processed.mp3   # FFmpeg 320kbps version
            │   ├── v2-original.mp3
            │   └── v2-processed.mp3
            ├── video/          # Future (Phase 2)
            └── temp/           # Intermediate files
```

---

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/projects | Create project |
| GET | /api/projects | List projects |
| GET | /api/projects/:id | Get project |
| GET | /api/projects/:id/lyrics | Project lyrics history |
| GET | /api/projects/:id/music | Project music history |
| POST | /api/lyrics/generate | Generate lyrics (async) |
| POST | /api/music/generate | Generate music (async) |
| GET | /api/music/:id | Get music record |
| GET | /api/music/:id/file | Download audio file (prefers 320kbps) |
| POST | /api/jobs | Create job (ffmpeg-process triggers queue) |
| GET | /api/jobs/:id | Get job status |
| GET | /api/lyrics/presets | Get style presets |

---

## Configuration (Environment Variables)

```bash
# Backend (.env - gitignored)
PORT=3000
MINIMAX_API_KEY=your_key_here
REDIS_HOST=localhost
REDIS_PORT=6379
STORAGE_PATH=./storage

# Frontend (.env - gitignored)
VITE_API_URL=http://localhost:3000
```

---

## Dependencies

```json
{
  "backend": {
    "express": "HTTP server",
    "bullmq": "Job queue (Redis backend)",
    "ioredis": "Redis client",
    "axios": "HTTP client (MiniMax API)",
    "fluent-ffmpeg": "Audio processing",
    "better-sqlite3": "SQLite",
    "nanoid": "ID generation"
  },
  "frontend": {
    "react": "UI framework",
    "vite": "Build tool",
    "typescript": "Type safety"
  },
  "infra": {
    "redis": "BullMQ queue backend",
    "ffmpeg": "Audio conversion CLI"
  }
}
```