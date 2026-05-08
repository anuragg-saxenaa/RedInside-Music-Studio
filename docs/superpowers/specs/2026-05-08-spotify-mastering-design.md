# Spotify Mastering Export - Design Spec

## Overview

Add audio mastering capability to export panel. Users can upload any song and convert to Spotify-quality master using FFmpeg loudnorm filter. MiniMax-generated music auto-converts to Spotify quality by default.

## Aesthetic Direction: Studio Hardware

Inspired by analog mixing consoles. Dark metallic surfaces, LED VU meters, tactile knobs, warm amber/red accents. Professional mastering suite feel.

### Design Tokens
- **Background**: `#0D0D0D` (deep black with subtle metallic texture)
- **Surface**: `#1A1A1A` (brushed metal dark)
- **Border**: `#2A2A2A` (subtle edges)
- **Primary**: `#E63946` (red accent - record button)
- **Amber**: `#FFB800` (LED warm accent)
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `#888888`

### Typography
- **Display**: Bebas Neue (bold condensed - meters, headers)
- **Body**: DM Sans (clean, readable)
- **Mono**: JetBrains Mono (technical readouts)

### Motion
- VU meter: CSS animation with 60fps LED segment updates
- Button press: subtle scale(0.97) with 100ms ease
- Upload zone: pulse animation on dragover
- Processing: shimmer effect on waveform during conversion

---

## Architecture

### Backend

**New Files:**
- `backend/src/modules/mastering/mastering.service.js` - FFmpeg loudnorm wrapper
- `backend/src/api/routes/mastering.routes.js` - Upload + process endpoints
- `backend/src/database/models/mastered.model.js` - Track mastered files

** mastering.service.js:
```javascript
export class AudioMasteringService {
  // FFmpeg loudnorm: I=-14:TP=-1:LRA=11 (Spotify spec)
  async masterToSpotify(inputPath, outputPath) { ... }
  async analyzeLoudness(inputPath) { ... } // Returns JSON report
}
```

**Endpoints:**
- `POST /api/mastering/upload` - Multipart file upload
- `POST /api/mastering/process` - Run mastering on file
- `GET /api/mastering/:id/status` - Job status polling

### Frontend

**New/Modified Files:**
- `frontend/src/components/Mastering/AudioMasteringPanel.tsx` - Main component
- `frontend/src/components/Mastering/VUMeter.tsx` - LED-style meter
- `frontend/src/components/Mastering/UploadZone.tsx` - Drag-drop upload
- `frontend/src/components/Mastering/MasteredFileList.tsx` - File list with download
- `frontend/src/pages/Studio.tsx` - Update export tab

**MasteringPanel States:**
1. `idle` - Show upload zone + file list
2. `uploading` - Progress bar
3. `processing` - VU meter animation + progress
4. `complete` - Show mastered file + download button
5. `error` - Error message + retry

---

## Data Flow

### Upload External Song
1. User drags file onto UploadZone
2. Frontend sends multipart to `POST /api/mastering/upload`
3. Backend saves to `storage/projects/{id}/uploads/{uuid}.{ext}`
4. Returns `{ id, filename, originalPath }`
5. Frontend shows in file list

### Process to Spotify Master
1. User selects file + clicks "Master for Spotify"
2. Backend runs FFmpeg loudnorm
3. Saves to `storage/projects/{id}/masters/{uuid}_spotify_master.wav`
4. Returns `{ id, masteredPath, downloadUrl }`

### Auto-Convert MiniMax Music
1. Music generation completes
2. Backend automatically runs mastering on output
3. Updates music record with `mastered_file_path`
4. Frontend shows mastered version in music list

---

## Storage Structure

```
storage/projects/{projectId}/
├── uploads/           # User-uploaded files
│   └── {uuid}.mp3
├── masters/           # Spotify mastered files
│   └── {uuid}_spotify_master.wav
└── generations/       # Original MiniMax output
    └── music/
```

---

## API Design

### POST /api/mastering/upload
**Request:** multipart/form-data with `file` field
**Response:**
```json
{
  "id": "uuid",
  "filename": "original.wav",
  "originalPath": "/storage/...",
  "duration": 180.5
}
```

### POST /api/mastering/process
**Request:**
```json
{
  "fileId": "uuid",
  "preset": "spotify" | "apple" | "youtube",
  "saveToProject": true
}
```
**Response:**
```json
{
  "id": "uuid",
  "status": "processing",
  "jobId": "uuid"
}
```

### GET /api/mastering/:id/status
**Response:**
```json
{
  "status": "complete" | "processing" | "error",
  "progress": 65,
  "masteredPath": "/storage/...",
  "downloadUrl": "/api/mastering/{id}/download"
}
```

---

## UI Components

### UploadZone
- Dashed border, dark surface
- Dragover: border glows amber, background pulse
- Accepted: .mp3, .wav, .flac, .m4a, .ogg
- Max size: 50MB

### VUMeter (LED segments)
- 20-segment vertical LED bar
- Green (0-12), Yellow (13-16), Red (17-20)
- Animated during processing
- Shows real-time loudness estimate

### MasteredFileList
- Table: filename, duration, size, actions
- Actions: Play, Download, Delete
- Badge for "Spotify Mastered"

### MasteringButton
- Red background (#E63946)
- Subtle glow on hover
- Loading spinner during processing
- Disabled state while processing

---

## Implementation Steps

1. Backend: Create MasteringService + routes
2. Backend: Add upload handling + file storage
3. Frontend: Create MasteringPanel component
4. Frontend: Add VUMeter visualization
5. Frontend: Wire up upload + process flow
6. Integration: Auto-convert MiniMax output
7. Styling: Apply Studio Hardware aesthetic
8. Testing: Real audio files through pipeline

---

## Dependencies

- FFmpeg with loudnorm filter (already in container)
- No new frontend dependencies
- Use existing storage utility
