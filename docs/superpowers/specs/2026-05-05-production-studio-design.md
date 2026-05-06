# Phase 1: Production Studio - Design Specification

**Date**: 2026-05-05
**Phase**: 1 of N (Player/UI fixes + Production features + Streaming features)
**Author**: Design collaboration with user

## Executive Summary

Build world-class music production studio. Current app is basic MiniMax API wrapper. Phase 1 adds: real audio waveform, production editing (trim/speed/volume/fade/reverse), multi-track medley, cover mode with file upload, Spotify-like player.

**Design goals:**
- Backend: API-agnostic (abstract MiniMax, prepare for any AI provider)
- Frontend: production-grade UI, responsive, professional
- Full FFmpeg utilization (not just 320kbps conversion)
- No ad-hoc changes - all features go through specs/plans

---

## 1. Architecture Overview

### 1.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    RedInside Music Studio                       │
│                         Phase 1                                 │
│                                                                  │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │   React Frontend     │    │      Node.js Backend           │ │
│  │                      │    │                                │ │
│  │  • Waveform Engine   │◄──►│  • AudioProcessor (FFmpeg)    │ │
│  │  • AudioEditor      │    │  • MedleyProcessor             │ │
│  │  • Upload Handler   │    │  • Upload API                  │ │
│  │  • Player Polish    │    │  • Track/Medley Models         │ │
│  │                      │    │                                │ │
│  └──────────────────────┘    └────────────────────────────────┘ │
│                                                                  │
│  Storage Layer                                                   │
│  • SQLite: tracks, medleys, projects                            │
│  • File Storage: storage/projects/{id}/audio/                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Directory Structure Additions

```
backend/src/
├── modules/
│   ├── audio/
│   │   ├── audio.processor.js      # Chain-pattern FFmpeg operations
│   │   ├── audio.controller.js     # HTTP handlers
│   │   └── audio.model.js          # Track CRUD
│   └── medley/
│       ├── medley.processor.js     # Multi-track concatenation
│       ├── medley.controller.js
│       └── medley.model.js
├── queue/
│   └── workers/
│       ├── audio.worker.js         # Async FFmpeg operations
│       └── medley.worker.js
└── ...

frontend/src/
├── components/
│   ├── AudioEditor/
│   │   ├── AudioEditorPanel.tsx    # Main editor container
│   │   ├── WaveformDisplay.tsx     # Web Audio API waveform
│   │   ├── AudioMarker.tsx         # Draggable trim markers
│   │   ├── TrackLane.tsx          # Single track in timeline
│   │   ├── TrackCard.tsx          # Grid view card
│   │   ├── TimelineView.tsx       # Horizontal lane view
│   │   ├── GridView.tsx          # Card-based view
│   │   ├── ControlsSidebar.tsx    # Trim/speed/volume controls
│   │   └── AudioUpload.tsx        # File dropzone + URL input
│   └── MusicPlayer/
│       └── (existing components - polish for Phase 1)
└── ...
```

---

## 2. Backend Specification

### 2.1 AudioProcessor Class

FFmpeg chain-pattern processor for single-track operations.

```javascript
export class AudioProcessor {
  // Operations (chainable, return this)
  load(filePath: string): AudioProcessor
  trim(startSec: number, endSec: number): AudioProcessor
  speed(tempoFactor: number): AudioProcessor        // 0.5 = half, 2 = double
  volume(gainDb: number): AudioProcessor           // 0 = silence, 1 = normal, 2 = double
  fadeIn(durationSec: number): AudioProcessor
  fadeOut(durationSec: number): AudioProcessor
  reverse(): AudioProcessor

  // Execution
  export(outputPath: string, options?: ExportOptions): Promise<ExportResult>

  // Utility
  getMetadata(filePath: string): Promise<AudioMetadata>
}

interface ExportOptions {
  format?: 'mp3' | 'wav' | 'flac' | 'aac'
  bitrate?: number          // kbps
  sampleRate?: number      // Hz
}

interface ExportResult {
  filePath: string
  duration: number
  bitrate: number
  format: string
}

interface AudioMetadata {
  duration: number         // seconds
  bitrate: number          // bps
  format: string
  sampleRate: number       // Hz
  channels: number
}
```

### 2.2 FFmpeg Operations Mapping

| Operation | FFmpeg Command | Notes |
|-----------|----------------|-------|
| Trim | `-ss {start} -t {duration}` | or `atrim=start:end` |
| Speed | `atempo=tempo` | tempo=0.5 to 4.0, >2 chain two atempo |
| Volume | `volume={gain}` | 1.0 = normal, 0.5 = half, 2.0 = double |
| Fade In | `afade=t=in:st=0:d={dur}` | |
| Fade Out | `afade=t=out:st={start}:d={dur}` | |
| Reverse | `areverse` | |
| Concat | `concat` filter | For medley |

### 2.3 MedleyProcessor Class

Multi-track processor extending AudioProcessor.

```javascript
export class MedleyProcessor {
  tracks: AudioTrack[]

  addTrack(filePath: string, options?: TrackOptions): MedleyProcessor
  removeTrack(index: number): MedleyProcessor
  reorderTracks(fromIndex: number, toIndex: number): MedleyProcessor
  updateTrack(index: number, options: Partial<TrackOptions>): MedleyProcessor
  clearTracks(): MedleyProcessor

  // Each track options: { trimStart, trimEnd, speed, volume, fadeIn, fadeOut }
  exportMedley(outputPath: string, options?: ExportOptions): Promise<ExportResult>
}
```

### 2.4 Data Models

```sql
CREATE TABLE audio_tracks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT,
  source TEXT CHECK(source IN ('generated', 'uploaded', 'cover')),
  original_file_path TEXT NOT NULL,
  processed_file_path TEXT,
  trim_start REAL DEFAULT 0,
  trim_end REAL,                    -- NULL = end of file
  speed REAL DEFAULT 1.0,
  volume REAL DEFAULT 1.0,
  fade_in REAL DEFAULT 0,
  fade_out REAL DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  duration_seconds REAL,
  format TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE medleys (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT,
  total_duration_seconds REAL,
  exported_file_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE medley_tracks (
  id TEXT PRIMARY KEY,
  medley_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  FOREIGN KEY (medley_id) REFERENCES medleys(id),
  FOREIGN KEY (track_id) REFERENCES audio_tracks(id)
);
```

### 2.5 API Endpoints

```
# Audio Operations
POST   /api/audio/trim          - Trim segment (body: { filePath, start, end })
POST   /api/audio/speed         - Change tempo (body: { filePath, tempo })
POST   /api/audio/volume        - Adjust volume (body: { filePath, gain })
POST   /api/audio/fade          - Add fade (body: { filePath, type: 'in'|'out', duration })
POST   /api/audio/reverse       - Reverse audio (body: { filePath })
POST   /api/audio/process       - Chain operations (body: { operations: [...] })
GET    /api/audio/:id/metadata   - Get audio metadata

# Medley Operations
POST   /api/medley              - Create medley project
GET    /api/medley/:id          - Get medley with tracks
PUT    /api/medley/:id          - Update medley metadata
DELETE /api/medley/:id          - Delete medley
POST   /api/medley/:id/tracks   - Add track to medley
PUT    /api/medley/:id/tracks   - Update/reorder tracks
DELETE /api/medley/:id/tracks/:trackId - Remove track
POST   /api/medley/:id/export   - Process and export medley

# Upload
POST   /api/upload/audio        - Multipart file upload
POST   /api/upload/url          - Fetch from URL (body: { url })
```

---

## 3. Frontend Specification

### 3.1 WaveformDisplay Component

Real audio visualization using Web Audio API.

```typescript
interface WaveformDisplayProps {
  audioUrl: string
  duration: number              // total duration in seconds
  trimStart: number             // trim start marker position
  trimEnd: number               // trim end marker position
  onSeek?: (time: number) => void
  onTrimChange?: (start: number, end: number) => void
  zoomLevel?: number            // 1 = fit all, 2 = 2x zoom, etc.
  className?: string
}

interface WaveformDisplayState {
  waveformData: Float32Array    // decoded audio samples
  peaks: number[]               // normalized peaks for display
  currentTime: number           // playback position
  isLoading: boolean
  error: string | null
}
```

**Implementation:**
1. Fetch audio file as ArrayBuffer
2. Decode with `AudioContext.decodeAudioData()`
3. downsample to ~1000 points for display
4. Render as canvas or SVG bars
5. Overlay draggable markers for trim points
6. Sync marker positions to numeric inputs

### 3.2 AudioEditorPanel Component

Main production editing interface.

```typescript
interface AudioEditorPanelProps {
  projectId: string
  initialTracks?: AudioTrack[]
  mode: 'single' | 'medley'
  onExport?: (result: ExportResult) => void
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Audio Editor                               [Timeline] [Grid]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Timeline View / Grid View (toggleable)                 │   │
│  │                                                         │   │
│  │  [Track 1 ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]       │   │
│  │  [Track 2 ░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░]       │   │
│  │  [Track 3 ░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░]       │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Controls Sidebar                                        │   │
│  │                                                          │   │
│  │  Trim:  [00:10.5] → [00:45.2]  [🔄 Reset]               │   │
│  │  Speed: ═══════●═══════  1.25x                          │   │
│  │  Volume: ═════════●═══  1.0x                           │   │
│  │  Effects: [✓] Fade In (2s)  [✓] Fade Out (2s)          │   │
│  │                                                          │   │
│  │  [Preview]              [Export ▼] ▼ MP3 320kbps       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 AudioUpload Component

Dual input: file upload + URL fetch.

```typescript
interface AudioUploadProps {
  projectId: string
  onUploaded: (track: AudioTrack) => void
  acceptTypes?: string[]         // ['.mp3', '.wav', '.flac']
  maxSizeMB?: number             // default 50MB
}
```

**Features:**
- Drag-drop zone with visual feedback
- File picker button
- URL input with validation
- Progress bar during upload/fetch
- Preview playback before submitting
- Supported: MP3, WAV, FLAC, OGG, M4A

### 3.4 View Toggle: Timeline vs Grid

**Timeline View (precision work):**
- Horizontal scrolling timeline
- Full-width waveform per track
- Visible markers for trim start/end
- Drag to reorder tracks
- Click waveform to seek

**Grid View (overview):**
- Cards per track (vertical layout)
- Small waveform thumbnail
- Quick trim info display
- Drag handles for reorder
- Better for many tracks

### 3.5 Player Polish (Phase 1 fixes)

**Artwork Display:**
- Album art from `/api/projects/:id/artwork`
- Correct sizing (300x300 in player, 56x56 in compact)
- Fallback placeholder

**Playback Controls:**
- Real seek via `audio.currentTime`
- Duration from actual audio metadata (not API estimate)
- Progress bar click-to-seek
- Play/pause with state sync

**Waveform (upgraded):**
- Real waveform from Web Audio API
- Fallback to hash-based fake if Web Audio fails

---

## 4. Implementation Order

```
Step 1: FFmpeg AudioProcessor
  - trim(), speed(), volume(), fadeIn(), fadeOut(), reverse()
  - Unit tests for each operation

Step 2: Upload Handler
  - File upload endpoint
  - URL fetch endpoint
  - Frontend AudioUpload component

Step 3: Waveform Component
  - Web Audio API integration
  - Canvas/SVG visualization
  - Draggable markers

Step 4: Single-Track Editor
  - AudioEditorPanel structure
  - Controls sidebar
  - Preview + Export

Step 5: Medley Multi-Track
  - MedleyProcessor (backend)
  - Timeline view
  - Grid view
  - View toggle

Step 6: Cover Mode Integration
  - Connect upload to cover mode
  - Use editor for cover track

Step 7: Player Polish
  - Artwork fix
  - Playback bugs
  - Real waveform
```

---

## 5. Dependencies

### Backend
- `fluent-ffmpeg` - FFmpeg wrapper (already installed)
- `formidable` - File upload parsing (or use built-in)

### Frontend
- Web Audio API (browser built-in, no install)
- React DnD or `@dnd-kit/core` - drag and drop for reorder
- Canvas or custom SVG for waveform rendering

---

## 6. Scope Boundaries

### In Scope (Phase 1)
- Audio trim, speed, volume, fade, reverse
- Real waveform visualization
- Single-track editor
- Multi-track medley (up to 10 tracks)
- File upload + URL fetch
- Timeline + Grid view toggle
- Player fixes (artwork, playback, waveform)

### Out of Scope (Phase 2+)
- MIDI editing
- Stem separation
- Real-time collaboration
- Cloud storage / streaming server
- Auth / user accounts
- Video sync

---

## 7. Success Criteria

1. User can upload MP3/WAV/FLAC or provide URL
2. User can see real waveform of audio
3. User can set trim start/end via drag or numeric input
4. User can adjust speed (0.5x - 2x) and hear preview
5. User can adjust volume and add fade in/out
6. User can create medley by adding multiple tracks
7. User can reorder tracks via drag in timeline or grid
8. User can export medley as single MP3 file
9. Player shows artwork correctly
10. Player play/pause/seek works reliably
11. UI is responsive on mobile and desktop
