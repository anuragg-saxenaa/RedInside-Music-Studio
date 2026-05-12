# Batch Mastering Design Spec

**Date:** 2026-05-12
**Feature:** Batch Spotify Mastering with ZIP Export
**Workflow:** Option B - Staging area with user curation

---

## Overview

Enhance AudioMasteringPanel to support batch operations: upload multiple files, batch master with Spotify loudness, select files to save to Music history or download as ZIP.

**User Flow:**
1. User navigates to Export step in studio
2. Drops multiple audio files (up to 50, max 50MB each)
3. Files appear in liquid glass file list
4. Clicks "Master All" - FFmpeg processes each with loudnorm
5. Mastered files remain in Mastering panel (staging, not auto-added to Music)
6. User clicks to select files (click-to-select, Shift+Click range)
7. Actions: "Save to Music" (promotes selected to Music history) OR "Download ZIP" (backup without adding)

---

## UI Components

### AudioMasteringPanel (enhanced)

**State:**
```typescript
interface FileInfo {
  id: string;
  filename: string;
  status: 'uploading' | 'idle' | 'processing' | 'mastered' | 'error';
  progress: number; // 0-100
  error?: string;
  originalPath?: string;
  masteredPath?: string;
  duration?: number;
  format?: string;
}

interface MasteringState {
  files: FileInfo[];
  selectedIds: Set<string>;
  isMasteringAll: boolean;
}
```

**Layout:**
- Upload zone at top (multi-file dropzone)
- File list with liquid glass rows (scrollable, 50+ files)
- Selection state per file (click to toggle, Shift+Click for range)
- Bottom action bar: "Master All", "Save to Music" (disabled if nothing selected), "Download ZIP"

**Liquid Glass File Row:**
- Circular music icon (lights red when selected)
- Mini waveform preview (8 bars)
- Filename + duration/bitrate meta
- Status tag: Pending | Mastering | Mastered | Error
- Checkmark circle badge (shows when selected)

**Bottom Action Bar:**
- Glass panel with blur backdrop
- "Master All" button (gradient red, disabled during batch processing)
- "Save to Music" button (disabled if no mastered files selected)
- "Download ZIP" button (disabled if nothing selected)
- Selection count display
- "Clear Selection" ghost button

---

## Backend API

### Endpoints

#### `POST /api/mastering/upload/:projectId`
**Existing** - handles single file upload, supports multipart.

**Update:** Accept multiple files in single request OR allow repeated calls to accumulate files.

**Request:** `multipart/form-data` with `files[]` array

**Response:**
```json
{
  "files": [
    { "id": "uuid1", "filename": "track1.mp3", "duration": 202 },
    { "id": "uuid2", "filename": "track2.wav", "duration": 180 }
  ]
}
```

#### `POST /api/mastering/process`
**Existing** - single file processing.

**Update:** Accept `fileIds` array for batch processing.

**Request:**
```json
{
  "fileIds": ["uuid1", "uuid2"],
  "projectId": "project-uuid",
  "preset": "spotify",
  "saveToProject": false
}
```

**Response:**
```json
{
  "results": [
    { "fileId": "uuid1", "status": "success", "masteredPath": "/path/to/uuid1_spotify_master.wav" },
    { "fileId": "uuid2", "status": "success", "masteredPath": "/path/to/uuid2_spotify_master.wav" }
  ],
  "errors": []
}
```

#### `POST /api/mastering/save-to-music`
**New** - Promote selected mastered files to Music history.

**Request:**
```json
{
  "projectId": "project-uuid",
  "fileIds": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "saved": [
    { "fileId": "uuid1", "musicId": "music-uuid", "version": 17 },
    { "fileId": "uuid2", "musicId": "music-uuid2", "version": 18 }
  ]
}
```

**Logic:**
- For each fileId, read mastered file from masters dir
- Create Music record with version number
- Return created music entries

#### `GET /api/mastering/zip`
**New** - Create ZIP of selected mastered files.

**Request:** `GET /api/mastering/zip?projectId=xxx&fileIds=uuid1,uuid2`

**Response:** Binary ZIP file stream with `Content-Disposition: attachment`

**Logic:**
- Read each mastered file
- Create ZIP using archiver or similar
- Stream to client
- Cleanup ZIP after sent (or after 5 min expiry)

#### `GET /api/mastering/files/:projectId`
**New** - List all mastered files in project.

**Response:**
```json
{
  "files": [
    {
      "id": "uuid1",
      "filename": "track1.mp3",
      "originalPath": "/upload/uuid1.mp3",
      "masteredPath": "/masters/uuid1_spotify_master.wav",
      "duration": 202,
      "status": "mastered"
    }
  ]
}
```

---

## Data Model

### Storage Structure
```
storage/
└── projects/
    └── {projectId}/
        ├── uploads/           # Original uploaded files
        │   └── {fileId}.mp3
        └── masters/           # Mastered files
            └── {fileId}_spotify_master.wav
```

### Database
No new tables. Music records created on "Save to Music" action.

---

## Testing Requirements

### Integration Tests (Real, No Mocks)

**Test File:** `frontend/tests/e2e/batch-mastering.spec.ts`

**Setup:**
- Real backend running on port 3000
- Real Redis for BullMQ
- Real FFmpeg for audio processing
- Test audio fixtures: 3 real MP3/WAV files in `frontend/tests/fixtures/`

**Test Cases:**

1. **Upload Multiple Files**
   - Drop 3 audio files on upload zone
   - Verify 3 files appear in file list with correct filenames
   - Verify status changes to "Ready" or "Pending"

2. **Batch Master All**
   - Click "Master All"
   - Verify progress indicator per file
   - Wait for completion (up to 2 min for 3 files)
   - Verify all files show "Mastered" status
   - Verify mastered files exist on disk

3. **Selection Logic**
   - Click file → selected (check badge appears)
   - Click same file → deselected
   - Shift+Click for range selection
   - Selection count updates in action bar

4. **Save to Music**
   - Select 2 mastered files
   - Click "Save to Music"
   - Verify response shows music IDs created
   - Navigate to Music step
   - Verify 2 new music entries exist

5. **Download ZIP**
   - Select 3 mastered files
   - Click "Download ZIP"
   - Verify ZIP downloads
   - Open ZIP, verify 3 audio files inside

6. **Clear Selection**
   - Select 3 files
   - Click "Clear Selection"
   - Verify 0 selected, buttons disabled

7. **Error Handling**
   - Upload corrupted file
   - Verify error status shows
   - Other files process normally

### Backend Tests

**Test File:** `backend/tests/integration/mastering.test.js`

1. **Batch Upload**
   - POST 3 files at once
   - Verify 3 file records created in DB

2. **Batch Process**
   - Process 3 files via loudnorm
   - Verify 3 mastered files on disk
   - Verify no Music records created yet

3. **Save to Music**
   - Call save-to-music with 2 fileIds
   - Verify 2 Music records created
   - Verify version numbers correct

4. **ZIP Creation**
   - Create ZIP with 3 files
   - Verify ZIP is valid
   - Verify all 3 files extract correctly

---

## Performance Considerations

- Batch processing uses BullMQ concurrency of 2 (not 1, not 4) - balances speed vs system load
- ZIP creation streams directly to response (no temp files)
- File list supports virtual scrolling for 100+ files
- Mastered files auto-cleanup after 30 days from masters dir (optional cleanup job)

---

## Dependencies

**Backend:**
- `archiver` or `zipstream` for ZIP creation
- FFmpeg (already required)
- BullMQ (already required)

**Frontend:**
- No new dependencies
- Use existing UploadZone component (extend for multi-file)

---

## Out of Scope

- Audio editing per file (trim, speed, volume) - separate feature
- Real-time progress WebSocket - polling is fine for now
- Drag-to-reorder files in list
- Bulk delete from Mastering panel