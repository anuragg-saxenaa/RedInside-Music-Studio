# RedInside Music Studio

Self-hosted desi hip-hop music creation platform using MiniMax AI APIs. Full production workflow: lyrics → music → video, with professional audio mastering, voice design, and medley mixing.

---

## Features

### Core Workflow
| Feature | Description |
|---------|-------------|
| **Lyrics Generation** | AI-powered lyrics with 5 style presets: Hinglish Urban, Punjabi Swagger, Hindi-Urdu Classical, Regional Fusion, Custom |
| **Music Generation** | Convert lyrics to full songs via MiniMax music-2.6 model. Supports instrumental mode and music-cover (voice transfer) |
| **Artwork Generation** | AI-generated cover art via MiniMax image API, per-track or per-project |
| **Video Generation** | Async MiniMax video generation with polling and file retrieval |
| **Voice Design** | Custom AI voice creation and cloning per project |

### Studio Tools
| Feature | Description |
|---------|-------------|
| **Audio Editor** | Inline per-track editor: trim, speed, volume, fade in/out, reverse, normalize, reverb, echo, bass boost, pitch shift |
| **Medley Mixer** | Combine multiple tracks into a single export with crossfade and volume controls |
| **Audio Mastering** | Batch upload + auto-master to Spotify loudness standard (−14 LUFS). ZIP download or save to Music library |
| **History Browser** | View full generation chain per project with version diffing and replay |
| **Viral Toolkit** | Trending topics, hook analysis, structure templates, reference track analysis |

### Infrastructure
- **BullMQ job queue** with Redis — all AI generation is async, non-blocking
- **WebSocket** real-time job status updates (ws://localhost:3000)
- **SQLite** database with full version tracking per project
- **Structured logging** with Winston
- **Settings** persistence (API key, default models, auto-mastering toggle)
- **Test mode banner** — yellow warning bar when backend is running against mock API

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js 18+, Express, SQLite (better-sqlite3), BullMQ |
| Queue | Redis |
| Audio | FFmpeg (320kbps conversion, trim, effects) |
| Frontend | React 18, TypeScript, Vite |
| Testing | Node test runner (backend), Playwright (E2E) |
| AI APIs | MiniMax (lyrics, music, image, video, voice) |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Redis (`redis-server` or Docker)
- FFmpeg (`brew install ffmpeg` / `apt install ffmpeg`)
- MiniMax API key ([platform.minimax.io](https://platform.minimax.io))

### Local Development

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Configure environment
cp config/.env.example config/.env
# Edit config/.env — set MINIMAX_API_KEY

# Run database migrations
cd backend && npm run db:migrate

# Start Redis (if not running)
redis-server --daemonize yes

# Start backend (terminal 1)
cd backend && npm run dev

# Start frontend (terminal 2)
cd frontend && npm run dev
```

Open http://localhost:5173.

### Docker

```bash
docker-compose up -d
```

---

## Running Tests

```bash
# Backend integration tests (175 tests, real HTTP, real FFmpeg, real SQLite)
cd backend && npm test

# Frontend E2E tests (368 tests, real browser, Playwright)
# Automatically starts mock MiniMax server — no API credits used
cd frontend && npx playwright test
```

> **Note:** E2E tests auto-start a MiniMax mock server on port 8999. If your backend is already running against the real API, the test suite will block with instructions to restart in mock mode (`npm run dev:mock`).

---

## Architecture

```
backend/src/
├── modules/          # Feature modules
│   ├── lyrics/       # Lyrics generation + edit + presets
│   ├── music/        # Music generation (BullMQ queued)
│   ├── audio/        # Per-track editing (trim, effects, chain)
│   ├── ffmpeg/       # Bitrate conversion, file merge
│   ├── mastering/    # Batch upload + Spotify mastering + ZIP
│   ├── medley/       # Multi-track concat and export
│   ├── video/        # Video generation (async poll)
│   ├── image/        # Artwork generation
│   ├── voice/        # Voice design + cloning
│   ├── viral/        # Trends, hook analysis, templates
│   ├── history/      # Generation chain, versioning, replay
│   └── upload/       # Audio file upload (multipart)
├── queue/
│   ├── workers/      # BullMQ workers (lyrics, music, video, ffmpeg)
│   └── queue.config.js
├── database/
│   ├── models/       # project, lyrics, music, video, job, settings
│   └── migrate.js    # Schema migrations
├── utils/
│   ├── minimax.client.js   # MiniMax API wrapper with error mapping
│   ├── storage.util.js     # File management (path traversal protected)
│   ├── ws.server.js        # WebSocket broadcast server
│   └── logger.js
└── config/
    └── env.config.js       # Environment validation

frontend/src/
├── pages/
│   ├── Studio.tsx          # Main workspace (7-step workflow)
│   ├── History.tsx         # Generation history browser
│   ├── ViralToolkit.tsx    # Viral content tools
│   └── Settings.tsx        # API key + preferences
├── components/
│   ├── LyricsEditor/       # Generate, version history, edit mode
│   ├── MusicPlayer/        # Track list, inline audio editor, playback bar
│   ├── ArtworkGenerator/   # Image generation + upload
│   ├── VideoPreview/       # Video generation + preview
│   ├── VoiceDesign/        # Voice design + cloning
│   ├── Mastering/          # Batch mastering panel
│   ├── Medley/             # Medley mixer panel
│   ├── WorkflowControl/    # Step navigation bar
│   └── AudioEditor/        # Standalone audio editor
└── hooks/
    ├── useWebSocket.ts     # Real-time job event subscription
    └── useSharedAudio.ts   # Global audio playback context
```

---

## API Reference

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects` | Create project |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/history` | Project generation history |
| GET | `/api/projects/:id/artwork` | Project artwork |
| POST | `/api/projects/:id/artwork` | Save artwork |

### Lyrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lyrics/generate` | Generate lyrics (synchronous) |
| POST | `/api/lyrics/edit/:id` | Edit existing lyrics |
| GET | `/api/lyrics/:id` | Get lyrics by ID |
| GET | `/api/lyrics/presets` | Get style presets |
| GET | `/api/projects/:projectId/lyrics` | List project lyrics |

### Music
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/music/generate` | Queue music generation job |
| POST | `/api/music/cover` | Queue cover generation job |
| GET | `/api/music/:id` | Get music record |
| GET | `/api/music/:id/file` | Stream audio file |
| GET | `/api/music/:id/download` | Download audio file |
| POST | `/api/music/:id/convert` | Convert to 320kbps MP3 |
| DELETE | `/api/music/:id` | Delete music |
| GET | `/api/music/settings` | Audio settings options |
| GET | `/api/projects/:projectId/music` | List project music |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/:id` | Get job status |
| POST | `/api/jobs/:id/cancel` | Cancel job |
| GET | `/api/jobs/project/:projectId` | All jobs for project |

### Audio / FFmpeg
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audio/process` | Apply effects chain (trim, speed, volume, fade, etc.) |
| POST | `/api/audio/trim` | Trim audio |
| GET | `/api/audio/:id/metadata` | Get audio metadata |
| POST | `/api/ffmpeg/convert-bitrate` | Convert bitrate |
| POST | `/api/ffmpeg/merge` | Merge audio files |

### Mastering
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mastering/upload/:projectId` | Upload files for mastering |
| POST | `/api/mastering/process` | Master file to Spotify standard |
| POST | `/api/mastering/save-to-music` | Save mastered file to Music library |
| GET | `/api/mastering/zip` | Download mastered files as ZIP |
| GET | `/api/mastering/files/:projectId` | List project mastering files |

### Medley
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/medley` | Create medley |
| GET | `/api/projects/:projectId/medleys` | List project medleys |
| GET | `/api/medley/:id` | Get medley with tracks |
| PUT | `/api/medley/:id` | Update medley |
| DELETE | `/api/medley/:id` | Delete medley |
| POST | `/api/medley/:id/tracks` | Add track |
| PUT | `/api/medley/:id/tracks` | Reorder tracks |
| DELETE | `/api/medley/:id/tracks/:trackId` | Remove track |
| POST | `/api/medley/:id/export` | Export merged audio |

### Video
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/video/generate` | Queue video generation |
| GET | `/api/video/:id` | Get video record |
| GET | `/api/video/:id/status` | Check status |
| GET | `/api/video/:id/file` | Stream video |
| GET | `/api/video/:id/download` | Download video |

### History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history/:projectId` | Project history |
| GET | `/api/history/chain/:id` | Generation chain |
| POST | `/api/history/replay/:id` | Replay version |
| POST | `/api/history/compare` | Compare versions |
| GET | `/api/history/export/:projectId` | Export history |
| DELETE | `/api/history/:id` | Delete version |

### Viral Toolkit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/viral/trends` | Trending topics |
| POST | `/api/viral/analyze-hook` | Hook quality analysis |
| GET | `/api/viral/templates` | Structure templates |
| POST | `/api/viral/analyze-reference` | Analyze reference track |
| POST | `/api/viral/optimize` | Apply optimizations |

### Voice & Image
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/design` | Design custom voice |
| GET | `/api/voices` | List available voices |
| POST | `/api/image/generate` | Generate artwork image |
| GET | `/api/projects/:projectId/images` | List project images |

---

## Environment Variables

```bash
# config/.env
MINIMAX_API_KEY=your_key_here
MINIMAX_BASE_URL=https://api.minimax.io   # Override for mock: http://localhost:8999
PORT=3000
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
STORAGE_PATH=./storage                    # Can be absolute path
DATABASE_PATH=music-studio.sqlite
```

---

## npm Scripts

```bash
# Backend
npm run dev          # Watch mode with auto-reload (real API)
npm run dev:mock     # Watch mode against mock MiniMax server
npm run mock:minimax # Start mock MiniMax server only (port 8999)
npm start            # Production start
npm test             # Run all integration tests
npm run db:migrate   # Initialize / migrate database

# Frontend
npm run dev          # Vite dev server
npm run build        # Production build
npx playwright test  # Run E2E tests (auto-starts mock stack)
```

---

## License

MIT
