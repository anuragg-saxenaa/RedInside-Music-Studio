# RedInside Music Studio

Self-hosted desi hip-hop music creation platform using MiniMax AI APIs.

## Architecture & Flow

**Complete system architecture**: [docs/superpowers/specs/2026-05-05-architecture-flow.md](https://github.com/anuragg-saxenaa/RedInside-Music-Studio/blob/main/docs/superpowers/specs/2026-05-05-architecture-flow.md)

Includes: component diagram, workflow (Lyrics → Music → FFmpeg → Download), database schema, file structure, endpoints.

---

## Features

- **Lyrics Generation** - AI-powered lyrics with style presets (Hinglish, Punjabi, Hindi-Urdu, Regional Fusion)
- **Music Generation** - Convert lyrics to music using MiniMax M2/M2-raw models
- **Audio Processing** - FFmpeg 320kbps MP3 conversion
- **Version History** - Track all generations per project
- **Job Queue** - BullMQ async processing with Redis

## Tech Stack

- **Backend**: Node.js, Express, SQLite, BullMQ, Redis
- **Frontend**: React, TypeScript, Vite
- **Storage**: Local filesystem + SQLite metadata

## Quick Start

### Prerequisites

- Node.js 18+
- Redis (or Docker)
- MiniMax API key

### Local Development

```bash
# Clone and install
cd backend && npm install
cd ../frontend && npm install

# Setup environment
cp config/.env.example config/.env
# Edit config/.env with your MiniMax API key

# Run database migrations
cd backend && npm run db:migrate

# Start backend (terminal 1)
cd backend && npm run dev

# Start frontend (terminal 2)
cd frontend && npm run dev
```

### Docker

```bash
docker-compose up -d
```

## Project Structure

```
redinside-music-studio/
├── backend/
│   ├── src/
│   │   ├── modules/          # Feature modules (lyrics, music, ffmpeg, queue)
│   │   ├── database/         # SQLite connection, models, migrations
│   │   ├── api/              # Routes and middleware
│   │   ├── queue/            # BullMQ workers
│   │   └── utils/            # MiniMax client, storage, logger
│   └── tests/
├── frontend/
│   └── src/
│       ├── pages/            # Studio.tsx
│       ├── components/       # LyricsEditor, MusicPlayer, WorkflowStepper
│       └── services/        # API client
├── storage/                  # Generated content (git-ignored)
└── database/                 # SQLite DB (git-ignored)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/projects | Create project |
| GET | /api/projects | List projects |
| GET | /api/projects/:id | Get project |
| POST | /api/lyrics/generate | Generate lyrics |
| GET | /api/projects/:id/lyrics | Get project lyrics |
| POST | /api/music/generate | Generate music |
| GET | /api/projects/:id/music | Get project music |
| POST | /api/jobs | Create job |
| GET | /api/jobs/:id | Get job status |

## Commands

```bash
# Backend
cd backend
npm run dev          # Watch mode
npm run db:migrate   # Run migrations
npm test             # Run tests

# Frontend
cd frontend
npm run dev          # Vite dev server
npm run build        # Production build

```

## License

MIT
