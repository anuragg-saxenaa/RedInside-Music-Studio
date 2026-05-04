# RedInside Music Studio - Design Specification

**Date**: 2026-05-03  
**Version**: 1.0  
**Author**: Design collaboration with user

## Executive Summary

RedInside Music Studio is an open-source, self-hosted web application for creating viral desi hip-hop songs using MiniMax AI APIs. The system orchestrates a complete music production workflow: lyrics generation → music generation → video generation, with comprehensive FFmpeg audio processing, version history tracking, and viral optimization features.

**Target Users**: Independent artists, music producers, content creators  
**Deployment**: Self-hosted local machine, single MiniMax API key setup  
**Tech Stack**: Node.js, Express, React, SQLite, BullMQ, FFmpeg

---

## 1. Architecture Overview

### 1.1 High-Level Design

**Pattern**: Modular Monolith  
**Why**: Simple deployment for self-hosted use case, clean module boundaries for open-source contributions, can evolve to microservices if needed.

```
┌────────────────────────────────────────────────────────┐
│                RedInside Music Studio                  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │           Node.js/Express Backend                │ │
│  │                                                  │ │
│  │  ├── Lyrics Module      ├── Music Module        │ │
│  │  ├── Video Module       ├── FFmpeg Module       │ │
│  │  ├── History Module     ├── Viral Toolkit       │ │
│  │                                                  │ │
│  │  └── BullMQ Job Queue (Redis-backed)            │ │
│  └──────────────────────────────────────────────────┘ │
│                         ↕                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │              React Frontend (SPA)                │ │
│  │                                                  │ │
│  │  • Studio Page (creation workflow)              │ │
│  │  • History Browser (versions & replay)          │ │
│  │  • FFmpeg Panel (audio processing)              │ │
│  │  • Settings (API key, preferences)              │ │
│  └──────────────────────────────────────────────────┘ │
│                         ↕                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │         Data Layer                               │ │
│  │  • SQLite Database (metadata, history)          │ │
│  │  • File Storage (audio, video, temp files)      │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 1.2 Directory Structure

```
redinside-music-studio/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── lyrics/
│   │   │   │   ├── lyrics.service.js
│   │   │   │   ├── lyrics.controller.js
│   │   │   │   ├── lyrics.model.js
│   │   │   │   └── presets/           # Style presets (Hinglish, Hindi, etc)
│   │   │   ├── music/
│   │   │   │   ├── music.service.js
│   │   │   │   ├── music.controller.js
│   │   │   │   └── music.model.js
│   │   │   ├── video/
│   │   │   │   ├── video.service.js
│   │   │   │   ├── video.controller.js
│   │   │   │   └── video.model.js
│   │   │   ├── ffmpeg/
│   │   │   │   ├── ffmpeg.service.js
│   │   │   │   ├── ffmpeg.controller.js
│   │   │   │   └── processors/        # Individual processing functions
│   │   │   ├── history/
│   │   │   │   ├── history.service.js
│   │   │   │   ├── history.controller.js
│   │   │   │   └── history.model.js
│   │   │   └── viral/
│   │   │       ├── viral.service.js
│   │   │       ├── trends-scraper.js
│   │   │       ├── hook-analyzer.js
│   │   │       ├── structure-templates.js
│   │   │       └── reference-analyzer.js
│   │   ├── queue/
│   │   │   ├── queue.config.js
│   │   │   ├── workers/
│   │   │   │   ├── lyrics.worker.js
│   │   │   │   ├── music.worker.js
│   │   │   │   ├── video.worker.js
│   │   │   │   └── ffmpeg.worker.js
│   │   │   └── jobs.service.js
│   │   ├── database/
│   │   │   ├── connection.js
│   │   │   ├── migrations/
│   │   │   └── models/
│   │   │       ├── project.model.js
│   │   │       ├── generation.model.js
│   │   │       └── job.model.js
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── lyrics.routes.js
│   │   │   │   ├── music.routes.js
│   │   │   │   ├── video.routes.js
│   │   │   │   ├── ffmpeg.routes.js
│   │   │   │   ├── history.routes.js
│   │   │   │   ├── viral.routes.js
│   │   │   │   ├── projects.routes.js
│   │   │   │   └── jobs.routes.js
│   │   │   └── middleware/
│   │   │       ├── auth.middleware.js
│   │   │       ├── error.middleware.js
│   │   │       └── validation.middleware.js
│   │   ├── utils/
│   │   │   ├── minimax.client.js      # MiniMax API wrapper
│   │   │   ├── storage.util.js
│   │   │   └── logger.js
│   │   └── config/
│   │       └── env.config.js
│   ├── tests/
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Studio.tsx             # Main creation workflow
│   │   │   ├── History.tsx            # Version browser
│   │   │   ├── Settings.tsx           # Configuration
│   │   │   └── Project.tsx            # Project management
│   │   ├── components/
│   │   │   ├── LyricsEditor/
│   │   │   │   ├── LyricsEditor.tsx
│   │   │   │   ├── StylePresetSelector.tsx
│   │   │   │   └── StructureViewer.tsx
│   │   │   ├── MusicPlayer/
│   │   │   │   ├── MusicPlayer.tsx
│   │   │   │   ├── Waveform.tsx
│   │   │   │   └── AudioControls.tsx
│   │   │   ├── VideoPreview/
│   │   │   │   └── VideoPreview.tsx
│   │   │   ├── FFmpegPanel/
│   │   │   │   ├── FFmpegPanel.tsx
│   │   │   │   ├── BitrateConverter.tsx
│   │   │   │   ├── AudioTrimmer.tsx
│   │   │   │   ├── FormatConverter.tsx
│   │   │   │   └── EffectsPanel.tsx
│   │   │   ├── HistoryBrowser/
│   │   │   │   ├── HistoryBrowser.tsx
│   │   │   │   ├── VersionTimeline.tsx
│   │   │   │   └── CompareVersions.tsx
│   │   │   ├── ViralToolkit/
│   │   │   │   ├── TrendingTopics.tsx
│   │   │   │   ├── HookOptimizer.tsx
│   │   │   │   ├── StructureTemplates.tsx
│   │   │   │   └── ReferenceAnalyzer.tsx
│   │   │   └── WorkflowControl/
│   │   │       ├── WorkflowStepper.tsx
│   │   │       ├── AutoManualToggle.tsx
│   │   │       └── ProgressTracker.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts        # Real-time job updates
│   │   │   ├── useProject.ts
│   │   │   └── useHistory.ts
│   │   ├── services/
│   │   │   └── api.service.ts
│   │   ├── store/
│   │   │   └── store.ts               # State management (Zustand/Redux)
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
│
├── storage/                           # Git-ignored
│   ├── projects/
│   │   └── {project-id}/
│   │       ├── generations/
│   │       │   ├── lyrics/
│   │       │   │   └── v{n}.json
│   │       │   ├── music/
│   │       │   │   └── v{n}.mp3
│   │       │   └── video/
│   │       │       └── v{n}.mp4
│   │       └── temp/
│   └── cache/
│
├── config/
│   ├── .env.example
│   └── .env                           # MiniMax API key
│
├── database/
│   └── music-studio.sqlite
│
├── docs/
│   ├── README.md
│   ├── SETUP.md
│   ├── API.md
│   └── superpowers/
│       └── specs/
│           └── 2026-05-03-redinside-music-studio-design.md
│
├── docker-compose.yml                 # Redis + App (optional)
├── Dockerfile
├── package.json                       # Root workspace
└── README.md
```

---

## 2. Module Specifications

### 2.1 Lyrics Module

**Purpose**: Generate and manage song lyrics using MiniMax Lyrics API

**Responsibilities**:
- Call MiniMax `/v1/lyrics_generation` endpoint
- Apply language/style presets (Hinglish, Hindi-Urdu, Punjabi-English, Regional)
- Inject trending topics when viral optimization enabled
- Parse and validate structure tags
- Save generated lyrics to history with version tracking

**API Surface**:
```javascript
class LyricsService {
  async generateLyrics(options) {
    // options: { prompt, mode, stylePreset, injectTrends, projectId }
    // Returns: { lyricsId, content, title, styleTags, version }
  }
  
  async editLyrics(lyricsId, edits) {
    // Use MiniMax edit mode to refine existing lyrics
  }
  
  async getStylePresets() {
    // Returns available style presets with sample prompts
  }
}
```

**Style Presets**:
1. **Hinglish Urban** - Hindi-English mix, modern trap/drill beats
2. **Hindi-Urdu Classical** - Ghazal-inspired, poetic, soulful
3. **Punjabi Swagger** - Bhangra influence, Sidhu Moose Wala style
4. **Regional Fusion** - Multi-language (Tamil, Telugu, Bengali + English)
5. **Custom** - User-defined prompt

**Data Model**:
```sql
CREATE TABLE lyrics_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  prompt TEXT,
  mode TEXT CHECK(mode IN ('write_full_song', 'edit')),
  style_preset TEXT,
  content TEXT NOT NULL,
  title TEXT,
  style_tags TEXT,
  structure_tags JSON,  -- Parsed tags like [Verse], [Chorus]
  trends_injected JSON, -- Trending topics used
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### 2.2 Music Module

**Purpose**: Generate music from lyrics using MiniMax Music API

**Responsibilities**:
- Call MiniMax `/v1/music_generation` endpoint
- Auto-pass lyrics from Lyrics Module (or accept manual input)
- Configure audio settings (sample rate, bitrate, format)
- Handle streaming responses for large files
- Download and store generated audio
- Trigger FFmpeg post-processing (bitrate conversion to 320kbps)

**API Surface**:
```javascript
class MusicService {
  async generateMusic(options) {
    // options: { lyricsId, prompt, model, audioSettings, isInstrumental, projectId }
    // Returns: { musicId, audioUrl, duration, version }
  }
  
  async generateCover(options) {
    // Generate cover version from reference audio
    // options: { lyricsId, audioUrl/base64, model, projectId }
  }
  
  async getAudioSettings() {
    // Returns available sample rates, bitrates, formats
  }
}
```

**Audio Settings**:
- **Sample Rate**: 16000, 24000, 32000, 44100 Hz
- **Bitrate**: 32000, 64000, 128000, 256000 bps (API limit)
  - Post-process to 320000 bps using FFmpeg
- **Format**: mp3, wav, pcm

**MiniMax Models**:
- `music-2.6` - Text-to-music (Token Plan, higher RPM)
- `music-cover` - Cover generation (Token Plan)
- `music-2.6-free` - Free tier (lower RPM)
- `music-cover-free` - Free cover generation

**MiniMax API Response Format**:
```javascript
{
  "data": {
    "status": 2,              // 2 = completed, 0-1 = processing
    "audio": "<hex-encoded audio data>"
  },
  "extra_info": {
    "music_duration": 25364,   // duration in seconds
    "music_sample_rate": 44100,
    "bitrate": 256000,
    "music_size": 813651
  },
  "base_resp": {
    "status_code": 0,          // 0 = success
    "status_msg": "success"
  }
}
```
- Audio is returned as hex-encoded data in `data.audio`, NOT via file download
- Convert hex to buffer and save directly: `Buffer.from(data.audio, 'hex')`

**Data Model**:
```sql
CREATE TABLE music_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lyrics_id TEXT,
  version INTEGER NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  audio_settings JSON,
  is_instrumental BOOLEAN DEFAULT 0,
  original_file_path TEXT,      -- Downloaded from MiniMax (256kbps)
  processed_file_path TEXT,     -- After FFmpeg (320kbps)
  duration_seconds REAL,
  sample_rate INTEGER,
  bitrate INTEGER,
  format TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (lyrics_id) REFERENCES lyrics_generations(id)
);
```

### 2.3 Video Module

**Purpose**: Generate music videos using MiniMax Video API

**Responsibilities**:
- Call MiniMax `/v1/video_generation` endpoint (async)
- Poll `/v1/query/video_generation` for completion status
- Download video using `/v1/files/retrieve`
- Support text-to-video mode (music video from description)
- Link video to corresponding music track

**API Surface**:
```javascript
class VideoService {
  async generateVideo(options) {
    // options: { musicId, prompt, model, duration, resolution, projectId }
    // Returns: { videoId, taskId, status }
    // Queues async polling job
  }
  
  async pollVideoStatus(taskId) {
    // Check video generation status
    // Returns: { status, progress, fileId }
  }
  
  async downloadVideo(fileId, videoId) {
    // Retrieve and save generated video
  }
}
```

**Video Models**:
- `MiniMax-Hailuo-2.3` - Text-to-video, image-to-video
- `MiniMax-Hailuo-02` - First-and-last-frame
- `S2V-01` - Subject reference (consistent face)

**Parameters**:
- **Duration**: 6 seconds (typical for music video clips)
- **Resolution**: 1080P
- **Prompt**: Music video scene description

**Data Model**:
```sql
CREATE TABLE video_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  music_id TEXT,
  version INTEGER NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  duration INTEGER,
  resolution TEXT,
  task_id TEXT,              -- MiniMax async task ID
  status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  file_id TEXT,              -- MiniMax file ID
  file_path TEXT,            -- Local saved video
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (music_id) REFERENCES music_generations(id)
);
```

### 2.4 FFmpeg Module

**Purpose**: Comprehensive audio processing utilities using FFmpeg

**Responsibilities**:
- Bitrate conversion (256kbps → 320kbps)
- Trimming, splitting, merging audio
- Format conversion (mp3, wav, flac, aac)
- Audio normalization and compression
- Effects (fade, reverb, echo, bass boost)
- Volume, tempo, pitch adjustment
- Metadata editing
- Multi-track mixing

**API Surface**:
```javascript
class FFmpegService {
  // Conversion
  async convertBitrate(inputPath, outputPath, bitrate)
  async convertFormat(inputPath, outputPath, format)
  
  // Editing
  async trim(inputPath, outputPath, startTime, endTime)
  async split(inputPath, outputDir, segmentDuration)
  async merge(inputPaths, outputPath)
  
  // Effects
  async normalize(inputPath, outputPath, targetLevel)
  async fadeInOut(inputPath, outputPath, fadeInSec, fadeOutSec)
  async addReverb(inputPath, outputPath, roomSize, wetness)
  async addEcho(inputPath, outputPath, delay, decay)
  async bassBoost(inputPath, outputPath, gain)
  
  // Adjustments
  async changeVolume(inputPath, outputPath, volumeDb)
  async changeTempo(inputPath, outputPath, tempo)
  async changePitch(inputPath, outputPath, semitones)
  
  // Metadata
  async editMetadata(inputPath, outputPath, metadata)
  async extractMetadata(inputPath)
  
  // Utility
  async getAudioInfo(inputPath)
}
```

**Implementation**: Uses `fluent-ffmpeg` library for Node.js

**Data Model** (Processing History):
```sql
CREATE TABLE ffmpeg_operations (
  id TEXT PRIMARY KEY,
  music_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  parameters JSON,
  input_file_path TEXT,
  output_file_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (music_id) REFERENCES music_generations(id)
);
```

### 2.5 History Module

**Purpose**: Track all generations with version control

**Responsibilities**:
- Version numbering for each generation type (lyrics v1, v2, ...)
- Link lyrics → music → video chains
- Enable replay/regeneration of past versions
- Export history as JSON
- Compare versions side-by-side
- Delete old versions (cleanup)

**API Surface**:
```javascript
class HistoryService {
  async getProjectHistory(projectId) {
    // Returns all generations for a project, grouped by type
  }
  
  async getVersionChain(generationId) {
    // Get linked generations: lyrics → music → video
  }
  
  async replayVersion(generationId) {
    // Load version settings and prepare for regeneration
  }
  
  async compareVersions(id1, id2, type) {
    // Compare two versions (diff for lyrics, waveform for music)
  }
  
  async exportHistory(projectId, format) {
    // Export as JSON or ZIP with all files
  }
  
  async deleteVersion(generationId) {
    // Soft delete (mark as deleted, cleanup files)
  }
}
```

**Data Model**:
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  current_lyrics_version INTEGER DEFAULT 0,
  current_music_version INTEGER DEFAULT 0,
  current_video_version INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generation_chains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lyrics_id TEXT,
  music_id TEXT,
  video_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (lyrics_id) REFERENCES lyrics_generations(id),
  FOREIGN KEY (music_id) REFERENCES music_generations(id),
  FOREIGN KEY (video_id) REFERENCES video_generations(id)
);
```

### 2.6 Viral Toolkit Module

**Purpose**: Features to optimize for viral success

**Components**:

#### 2.6.1 Trending Topics Scraper
- Scrape trending hashtags/topics from Twitter, Instagram APIs
- Filter by relevance to desi hip-hop / Indian music scene
- Inject into lyrics prompts when enabled

#### 2.6.2 Hook Analyzer
- Analyze generated lyrics for hook quality
- Check repetition patterns (catchy hooks repeat)
- Score hook placement (ideal: after first verse, before chorus)
- Suggest improvements

#### 2.6.3 Structure Templates
- Pre-defined viral song structures:
  - **Hook-First**: [Hook] → [Verse] → [Chorus] → [Verse] → [Chorus] → [Hook] → [Outro]
  - **Build-Up**: [Intro] → [Verse] → [Pre-Chorus] → [Chorus] → [Drop] → [Verse] → [Chorus] → [Outro]
  - **Traditional**: [Intro] → [Verse] → [Chorus] → [Verse] → [Chorus] → [Bridge] → [Chorus] → [Outro]

#### 2.6.4 Reference Track Analyzer
- Accept URL to viral song (YouTube, Spotify)
- Use audio analysis to extract:
  - BPM (beats per minute)
  - Key/scale
  - Structure (verse/chorus timing)
  - Hook repetition count
- Apply patterns to new generation

**API Surface**:
```javascript
class ViralToolkitService {
  async getTrendingTopics(limit = 10)
  async analyzeHook(lyrics)
  async getStructureTemplates()
  async analyzeReferenceTrack(url)
  async applyViralOptimization(lyricsId, optimizations)
}
```

**Data Model**:
```sql
CREATE TABLE viral_optimizations (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  trends_used JSON,
  hook_score REAL,
  structure_template TEXT,
  reference_track_url TEXT,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Data Flow

### 3.1 Hybrid Workflow (Default Auto with Manual Pause)

```
User Input
    ↓
[Create Project] → Project ID
    ↓
┌─────────────────────────────────────────────┐
│           AUTO MODE (default)               │
│                                             │
│  User Prompt → Queue Lyrics Job             │
│       ↓                                     │
│  Lyrics Worker → MiniMax API                │
│       ↓                                     │
│  Save Lyrics v1 → Queue Music Job           │
│       ↓                                     │
│  Music Worker → MiniMax API                 │
│       ↓                                     │
│  Save Music v1 → FFmpeg (320kbps)           │
│       ↓                                     │
│  Queue Video Job                            │
│       ↓                                     │
│  Video Worker → MiniMax API (async)         │
│       ↓                                     │
│  Poll Status → Download Video → Save v1     │
│       ↓                                     │
│  Workflow Complete ✓                        │
└─────────────────────────────────────────────┘
         ↕
[PAUSE/EDIT Option at each step]
         ↓
┌─────────────────────────────────────────────┐
│         MANUAL MODE (on pause)              │
│                                             │
│  User Reviews Lyrics                        │
│       ↓                                     │
│  [Edit] → Save as v2 → Continue             │
│       ↓                                     │
│  OR [Regenerate] → Queue new job            │
│       ↓                                     │
│  OR [Approve] → Continue to next step       │
└─────────────────────────────────────────────┘
```

### 3.2 Job Queue Flow

```
API Request
    ↓
Controller validates & creates Job
    ↓
Add to BullMQ Queue
    ↓
┌──────────────────────┐
│   Job Worker Pool    │
│                      │
│  • Lyrics Worker     │
│  • Music Worker      │
│  • Video Worker      │
│  • FFmpeg Worker     │
└──────────────────────┘
    ↓
Process Job (call MiniMax / FFmpeg)
    ↓
Update Job Status (progress %, ETA)
    ↓
WebSocket → Frontend (real-time update)
    ↓
Save Result to DB + Files
    ↓
Mark Job Complete
    ↓
Trigger Next Step (if auto mode)
```

### 3.3 WebSocket Events

Real-time updates from backend to frontend:

```javascript
// Events emitted:
{
  type: 'job.started',
  jobId: 'job-123',
  jobType: 'generate-music',
  projectId: 'proj-1'
}

{
  type: 'job.progress',
  jobId: 'job-123',
  progress: 45,          // 0-100
  eta: 30                // seconds remaining
}

{
  type: 'job.completed',
  jobId: 'job-123',
  result: { musicId: 'music-v1', ... }
}

{
  type: 'job.failed',
  jobId: 'job-123',
  error: 'Rate limit exceeded'
}
```

---

## 4. API Endpoints

### 4.1 Projects

```
POST   /api/projects                    # Create new project
GET    /api/projects                    # List all projects
GET    /api/projects/:id                # Get project details
PUT    /api/projects/:id                # Update project
DELETE /api/projects/:id                # Delete project
GET    /api/projects/:id/history        # Full generation history
```

### 4.2 Lyrics

```
POST   /api/lyrics/generate             # Generate lyrics
POST   /api/lyrics/edit                 # Edit existing lyrics
GET    /api/lyrics/:id                  # Get lyrics by ID
GET    /api/lyrics/presets              # Get style presets
```

### 4.3 Music

```
POST   /api/music/generate              # Generate music
POST   /api/music/cover                 # Generate cover
GET    /api/music/:id                   # Get music by ID
GET    /api/music/:id/download          # Download audio file
GET    /api/music/settings              # Audio settings options
```

### 4.4 Video

```
POST   /api/video/generate              # Start video generation
GET    /api/video/:id                   # Get video by ID
GET    /api/video/:id/status            # Check generation status
GET    /api/video/:id/download          # Download video file
```

### 4.5 FFmpeg

```
POST   /api/ffmpeg/convert-bitrate      # Convert bitrate
POST   /api/ffmpeg/trim                 # Trim audio
POST   /api/ffmpeg/merge                # Merge audio files
POST   /api/ffmpeg/effects              # Apply effects
POST   /api/ffmpeg/metadata             # Edit metadata
GET    /api/ffmpeg/info/:musicId        # Get audio info
```

### 4.6 History

```
GET    /api/history/:projectId          # Get project history
GET    /api/history/chain/:id           # Get generation chain
POST   /api/history/replay/:id          # Replay version
POST   /api/history/compare             # Compare versions
POST   /api/history/export/:projectId   # Export history
DELETE /api/history/:id                 # Delete version
```

### 4.7 Viral Toolkit

```
GET    /api/viral/trends                # Get trending topics
POST   /api/viral/analyze-hook          # Analyze hook quality
GET    /api/viral/templates             # Structure templates
POST   /api/viral/analyze-reference     # Analyze reference track
POST   /api/viral/optimize              # Apply optimizations
```

### 4.8 Jobs

```
GET    /api/jobs/:id                    # Get job status
POST   /api/jobs/:id/cancel             # Cancel job
GET    /api/jobs/project/:projectId     # All jobs for project
```

---

## 5. Database Schema

### 5.1 Core Tables

```sql
-- Projects: Top-level container
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  current_lyrics_version INTEGER DEFAULT 0,
  current_music_version INTEGER DEFAULT 0,
  current_video_version INTEGER DEFAULT 0,
  workflow_mode TEXT CHECK(workflow_mode IN ('auto', 'manual', 'hybrid')) DEFAULT 'hybrid',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lyrics generations
CREATE TABLE lyrics_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  prompt TEXT,
  mode TEXT CHECK(mode IN ('write_full_song', 'edit')) DEFAULT 'write_full_song',
  style_preset TEXT,
  content TEXT NOT NULL,
  title TEXT,
  style_tags TEXT,
  structure_tags JSON,
  trends_injected JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, version)
);

-- Music generations
CREATE TABLE music_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lyrics_id TEXT,
  version INTEGER NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  audio_settings JSON,
  is_instrumental BOOLEAN DEFAULT 0,
  original_file_path TEXT,
  processed_file_path TEXT,
  duration_seconds REAL,
  sample_rate INTEGER,
  bitrate INTEGER,
  format TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (lyrics_id) REFERENCES lyrics_generations(id) ON DELETE SET NULL,
  UNIQUE(project_id, version)
);

-- Video generations
CREATE TABLE video_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  music_id TEXT,
  version INTEGER NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  duration INTEGER,
  resolution TEXT,
  task_id TEXT,
  status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  file_id TEXT,
  file_path TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (music_id) REFERENCES music_generations(id) ON DELETE SET NULL,
  UNIQUE(project_id, version)
);

-- Generation chains (links lyrics → music → video)
CREATE TABLE generation_chains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lyrics_id TEXT,
  music_id TEXT,
  video_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (lyrics_id) REFERENCES lyrics_generations(id) ON DELETE SET NULL,
  FOREIGN KEY (music_id) REFERENCES music_generations(id) ON DELETE SET NULL,
  FOREIGN KEY (video_id) REFERENCES video_generations(id) ON DELETE SET NULL
);
```

### 5.2 Processing Tables

```sql
-- FFmpeg operations history
CREATE TABLE ffmpeg_operations (
  id TEXT PRIMARY KEY,
  music_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  parameters JSON,
  input_file_path TEXT,
  output_file_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (music_id) REFERENCES music_generations(id) ON DELETE CASCADE
);

-- Viral optimizations applied
CREATE TABLE viral_optimizations (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  generation_type TEXT CHECK(generation_type IN ('lyrics', 'music', 'video')),
  trends_used JSON,
  hook_score REAL,
  structure_template TEXT,
  reference_track_url TEXT,
  optimization_params JSON,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.3 Jobs Table

```sql
-- Background jobs (managed by BullMQ but tracked in DB)
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('generate-lyrics', 'generate-music', 'generate-video', 'ffmpeg-process')) NOT NULL,
  status TEXT CHECK(status IN ('queued', 'active', 'completed', 'failed', 'paused')) DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  eta_seconds INTEGER,
  input_params JSON,
  result JSON,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### 5.4 Settings Table

```sql
-- User settings and preferences
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initial settings:
INSERT INTO settings (key, value) VALUES
  ('minimax_api_key', ''),
  ('default_workflow_mode', 'hybrid'),
  ('auto_ffmpeg_320kbps', 'true'),
  ('default_music_model', 'music-2.6'),
  ('default_video_model', 'MiniMax-Hailuo-2.3');
```

### 5.5 Indexes

```sql
CREATE INDEX idx_lyrics_project ON lyrics_generations(project_id);
CREATE INDEX idx_music_project ON music_generations(project_id);
CREATE INDEX idx_video_project ON video_generations(project_id);
CREATE INDEX idx_chains_project ON generation_chains(project_id);
CREATE INDEX idx_jobs_project ON jobs(project_id);
CREATE INDEX idx_jobs_status ON jobs(status);
```

---

## 6. Error Handling

### 6.1 MiniMax API Errors

Handle common error codes:

```javascript
const MINIMAX_ERRORS = {
  0: 'Success',
  1002: 'Rate limit exceeded',
  1004: 'Authentication failed',
  1008: 'Insufficient balance',
  1026: 'Content flagged as sensitive',
  2013: 'Invalid parameters',
  2049: 'Invalid API key'
};

// Retry strategy:
// - 1002 (rate limit): Exponential backoff, max 3 retries
// - 1004, 2049 (auth): No retry, notify user
// - 1008 (balance): No retry, notify user
// - 2013 (params): No retry, log for debugging
// - 1026 (sensitive): No retry, allow user to edit prompt
```

### 6.2 FFmpeg Errors

```javascript
// Common FFmpeg failures:
// - File not found: Check path, retry download
// - Unsupported codec: Log error, suggest format conversion
// - Disk space: Check available space before processing
// - Process timeout: Set max 60s timeout, kill if exceeded
```

### 6.3 Job Failures

```javascript
// Job retry policy:
class JobRetryPolicy {
  maxAttempts = 3;
  backoff = 'exponential'; // 1s, 2s, 4s
  
  shouldRetry(error) {
    // Retry: Network errors, rate limits
    // Don't retry: Auth errors, invalid params, sensitive content
  }
}
```

### 6.4 Frontend Error Display

```javascript
// Error UI patterns:
// - Transient errors (network): Toast notification, auto-dismiss
// - Recoverable errors (rate limit): Modal with retry button
// - Fatal errors (auth, balance): Modal with action link
// - Validation errors: Inline field errors
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Target**: 80% coverage minimum

```javascript
// Test categories:
// - Module services (mocked MiniMax API)
// - FFmpeg operations (mocked fluent-ffmpeg)
// - Database models (in-memory SQLite)
// - Utilities and helpers

// Example:
describe('LyricsService', () => {
  it('should generate lyrics with Hinglish preset', async () => {
    const result = await lyricsService.generateLyrics({
      prompt: 'Viral desi rap',
      stylePreset: 'hinglish-urban',
      projectId: 'test-1'
    });
    expect(result.content).toBeDefined();
    expect(result.version).toBe(1);
  });
});
```

### 7.2 Integration Tests

**Target**: Key workflows end-to-end

```javascript
// Test scenarios:
// 1. Full auto workflow: prompt → lyrics → music → video
// 2. Manual workflow: pause at each step, edit, continue
// 3. FFmpeg post-processing: 256kbps → 320kbps conversion
// 4. History tracking: versions saved correctly
// 5. Job queue: parallel job processing

// Use test MiniMax API (mocked responses)
```

### 7.3 E2E Tests

**Tool**: Playwright or Cypress

```javascript
// User journeys:
// 1. New user setup (API key)
// 2. Create project → generate song → download
// 3. Browse history → replay version
// 4. Use FFmpeg panel → apply effects
// 5. Error recovery: retry failed job
```

### 7.4 Manual Testing Checklist

- [ ] Complete auto workflow (prompt to video)
- [ ] Manual pause/edit at each step
- [ ] All FFmpeg utilities work
- [ ] History browser loads all versions
- [ ] Version comparison side-by-side
- [ ] Viral toolkit features functional
- [ ] WebSocket real-time updates
- [ ] Error handling for all API error codes
- [ ] Mobile responsive (frontend)
- [ ] Cross-browser compatibility

---

## 8. Deployment & Setup

### 8.1 Prerequisites

- **Node.js**: v18+ LTS
- **Redis**: v6+ (for BullMQ)
- **FFmpeg**: Installed globally (`brew install ffmpeg` on macOS)
- **MiniMax API Key**: From https://platform.minimax.io

### 8.2 Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/user/redinside-music-studio.git
cd redinside-music-studio

# 2. Install dependencies
npm install              # Root workspace
cd backend && npm install
cd ../frontend && npm install

# 3. Setup environment
cp config/.env.example config/.env
# Edit config/.env and add MINIMAX_API_KEY=your-key-here

# 4. Initialize database
cd backend
npm run db:migrate       # Run migrations

# 5. Start Redis (or use Docker)
redis-server
# OR
docker run -d -p 6379:6379 redis:latest

# 6. Start backend
npm run dev              # Port 3000

# 7. Start frontend (new terminal)
cd frontend
npm run dev              # Port 5173

# 8. Open browser
# http://localhost:5173
```

### 8.3 Docker Deployment (Optional)

```yaml
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - MINIMAX_API_KEY=${MINIMAX_API_KEY}
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./storage:/app/storage
      - ./database:/app/database
    depends_on:
      - redis
  
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
```

### 8.4 Production Considerations

- **Reverse Proxy**: Use Nginx for frontend + backend routing
- **Process Manager**: PM2 for backend process
- **Logging**: Winston for structured logs
- **Monitoring**: Add health check endpoints
- **Backups**: Regular SQLite backups, storage folder backups
- **Rate Limiting**: Protect API endpoints
- **HTTPS**: SSL certificate for production domain

---

## 9. Open Source Considerations

### 9.1 License

**Recommended**: MIT License (permissive, allows commercial use)

### 9.2 Documentation

- **README.md**: Overview, features, quick start
- **SETUP.md**: Detailed installation guide
- **API.md**: API endpoint documentation
- **CONTRIBUTING.md**: Contribution guidelines
- **CODE_OF_CONDUCT.md**: Community standards

### 9.3 Code Quality

- **Linting**: ESLint for JS/TS
- **Formatting**: Prettier
- **Type Safety**: TypeScript for frontend
- **Pre-commit Hooks**: Husky + lint-staged
- **CI/CD**: GitHub Actions (test on PR, build on merge)

### 9.4 Community Features

- **Issue Templates**: Bug report, feature request
- **PR Template**: Checklist for contributors
- **Changelog**: Keep updated with releases
- **Versioning**: Semantic versioning (semver)

---

## 10. Future Enhancements

### 10.1 Phase 2 Features

- **Collaboration**: Multi-user projects (share projects)
- **Cloud Storage**: S3/Cloudflare R2 for media files
- **Export Formats**: Export to Spotify, YouTube, SoundCloud
- **Mobile App**: React Native companion app
- **Voice Cloning**: Custom voice models for vocals

### 10.2 Advanced Viral Features

- **A/B Testing**: Generate multiple versions, test which goes viral
- **Analytics**: Track plays, shares, engagement metrics
- **Social Integration**: Auto-post to Instagram, TikTok
- **Remix Engine**: Let users remix existing tracks

### 10.3 Performance Optimizations

- **Caching**: Redis cache for frequent API calls
- **CDN**: Serve static media from CDN
- **Streaming**: Stream large video files instead of full download
- **Lazy Loading**: Frontend code splitting

---

## 11. Success Criteria

### 11.1 Functional Requirements ✓

- [x] Generate lyrics using MiniMax API
- [x] Generate music from lyrics
- [x] Generate video from music
- [x] Complete version history tracking
- [x] FFmpeg audio processing toolkit
- [x] Multi-style desi hip-hop support
- [x] Viral optimization features
- [x] Hybrid workflow (auto + manual)
- [x] Self-hosted setup with just API key

### 11.2 Non-Functional Requirements

- **Performance**: 
  - Lyrics generation: < 10s
  - Music generation: < 60s
  - Video generation: < 5min
  - FFmpeg processing: < 5s
- **Reliability**: 95% uptime, graceful error handling
- **Usability**: Intuitive UI, < 5min to first song
- **Scalability**: Handle 100+ projects, 1000+ generations

### 11.3 Open Source Goals

- **GitHub Stars**: Target 100+ stars in first 3 months
- **Contributors**: Attract 5+ external contributors
- **Issues**: Maintain < 48hr response time
- **Documentation**: Keep docs updated with each release

---

## Appendix A: MiniMax API Integration

### A.1 Authentication

```javascript
const axios = require('axios');

class MinimaxClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.minimax.io';
  }
  
  async request(endpoint, method, data) {
    const response = await axios({
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      data
    });
    
    return response.data;
  }
}
```

### A.2 Example: Generate Lyrics

```javascript
async function generateLyrics(prompt, stylePreset) {
  const client = new MinimaxClient(process.env.MINIMAX_API_KEY);
  
  const response = await client.request('/v1/lyrics_generation', 'POST', {
    mode: 'write_full_song',
    prompt: `${stylePreset.promptTemplate} ${prompt}`
  });
  
  return {
    title: response.song_title,
    lyrics: response.lyrics,
    styleTags: response.style_tags
  };
}
```

### A.3 Example: Generate Music

```javascript
async function generateMusic(lyrics, musicPrompt) {
  const client = new MinimaxClient(process.env.MINIMAX_API_KEY);
  
  const response = await client.request('/v1/music_generation', 'POST', {
    model: 'music-2.6',
    prompt: musicPrompt,
    lyrics: lyrics,
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3'
    },
    output_format: 'url'
  });
  
  // Download audio from URL
  const audioBuffer = await downloadFile(response.data.audio_url);
  
  return audioBuffer;
}
```

### A.4 Example: Generate Video (Async)

```javascript
async function generateVideo(musicPrompt) {
  const client = new MinimaxClient(process.env.MINIMAX_API_KEY);
  
  // 1. Create task
  const createResponse = await client.request('/v1/video_generation', 'POST', {
    model: 'MiniMax-Hailuo-2.3',
    prompt: musicPrompt,
    duration: 6,
    resolution: '1080P'
  });
  
  const taskId = createResponse.task_id;
  
  // 2. Poll status
  let status = 'processing';
  while (status === 'processing') {
    await sleep(5000); // Wait 5s
    
    const statusResponse = await client.request(
      `/v1/query/video_generation?task_id=${taskId}`,
      'GET'
    );
    
    status = statusResponse.status;
  }
  
  // 3. Download video
  if (status === 'completed') {
    const fileId = statusResponse.file_id;
    const videoBuffer = await client.request(
      `/v1/files/retrieve?file_id=${fileId}`,
      'GET'
    );
    
    return videoBuffer;
  }
}
```

---

## Appendix B: FFmpeg Command Reference

### B.1 Bitrate Conversion (256kbps → 320kbps)

```bash
ffmpeg -i input.mp3 -b:a 320k output.mp3
```

### B.2 Trim Audio

```bash
ffmpeg -i input.mp3 -ss 00:00:06 -to 00:01:30 -c copy trimmed.mp3
```

### B.3 Normalize Audio

```bash
ffmpeg -i input.mp3 -af loudnorm output.mp3
```

### B.4 Fade In/Out

```bash
ffmpeg -i input.mp3 -af "afade=t=in:st=0:d=3,afade=t=out:st=57:d=3" output.mp3
```

### B.5 Change Tempo (without pitch shift)

```bash
ffmpeg -i input.mp3 -filter:a "atempo=1.25" output.mp3
```

---

## Appendix C: Project File Structure Example

```
storage/
├── projects/
│   ├── proj-abc123/
│   │   ├── project.json
│   │   ├── generations/
│   │   │   ├── lyrics/
│   │   │   │   ├── v1.json
│   │   │   │   ├── v2.json
│   │   │   │   └── v3.json
│   │   │   ├── music/
│   │   │   │   ├── v1-original.mp3    (256kbps from MiniMax)
│   │   │   │   ├── v1-processed.mp3   (320kbps post FFmpeg)
│   │   │   │   ├── v2-original.mp3
│   │   │   │   └── v2-processed.mp3
│   │   │   └── video/
│   │   │       ├── v1.mp4
│   │   │       └── v2.mp4
│   │   └── temp/
│   │       └── (processing temp files, auto-cleanup)
│   └── proj-def456/
│       └── ...
└── cache/
    └── (cached API responses, trending topics, etc)
```

---

## Conclusion

This design provides a complete blueprint for building RedInside Music Studio - an open-source, self-hosted desi hip-hop music creation platform powered by MiniMax AI APIs.

**Key Design Decisions**:
1. **Modular Monolith**: Simple deployment, clean architecture
2. **Job Queue**: Non-blocking async processing for long API calls
3. **Version History**: Complete audit trail with replay capability
4. **FFmpeg Integration**: Professional audio post-processing
5. **Hybrid Workflow**: Default automation with manual override
6. **Open Source Ready**: Clean code, good docs, easy setup

**Next Steps**: Create detailed implementation plan breaking down development into sprints/tasks.
