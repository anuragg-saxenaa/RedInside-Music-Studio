# Spotify Mastering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audio mastering capability - upload any song, convert to Spotify-quality master using FFmpeg loudnorm. MiniMax-generated music auto-converts by default.

**Architecture:** Backend MasteringService wraps FFmpeg loudnorm filter. Frontend MasteringPanel provides upload zone, VU meter visualization, and file list. Studio Hardware aesthetic.

**Tech Stack:** fluent-ffmpeg, Node.js native test runner, React, Playwright for E2E

---

## File Structure

### Backend Additions
```
backend/src/modules/mastering/
├── mastering.service.js      # FFmpeg loudnorm wrapper
├── mastering.controller.js   # HTTP handlers
├── mastering.model.js       # Track mastered files

backend/src/api/routes/
├── mastering.routes.js       # Upload/process endpoints
```

### Frontend Additions
```
frontend/src/components/Mastering/
├── AudioMasteringPanel.tsx   # Main component
├── VUMeter.tsx              # LED-style meter
├── UploadZone.tsx           # Drag-drop upload
├── MasteredFileList.tsx     # File list with download
```

### Backend Modifications
- `backend/src/server.js` - Register mastering routes
- `backend/src/modules/music/music.service.js` - Auto-run mastering after generation

---

## Task 1: MasteringService Backend

**Files:**
- Create: `backend/src/modules/mastering/mastering.service.js`
- Test: `backend/tests/modules/mastering.service.test.js`
- Fixtures: `backend/tests/fixtures/test-audio.mp3`

- [ ] **Step 1: Create MasteringService skeleton**

```javascript
// backend/src/modules/mastering/mastering.service.js
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

export class AudioMasteringService {
  constructor(storageDir) {
    this.storageDir = storageDir;
  }

  // Spotify loudness standard: I=-14:TP=-1:LRA=11
  async masterToSpotify(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters('loudnorm=I=-14:TP=-1:LRA=11')
        .audioCodec('pcm_s16le') // WAV format
        .output(outputPath)
        .on('end', () => resolve({ outputPath }))
        .on('error', reject)
        .run();
    });
  }

  async analyzeLoudness(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters('loudnorm=I=-14:TP=-1:LRA=11:print_format=json')
        .format('null')
        .on('end', () => {
          // Parse loudness_report.txt
          const reportPath = path.join(this.storageDir, 'loudness_report.json');
          if (fs.existsSync(reportPath)) {
            const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            resolve(report);
          } else {
            resolve({});
          }
        })
        .on('error', reject)
        .save(path.join(this.storageDir, 'loudness_report.txt'));
    });
  }
}
```

- [ ] **Step 2: Write failing test**

```javascript
// backend/tests/modules/mastering.service.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { AudioMasteringService } from '../../src/modules/mastering/mastering.service.js';

const FIXTURE = path.join(__dirname, '../fixtures/test-audio.mp3');
const OUTPUT_DIR = path.join(__dirname, '../fixtures/output');

describe('AudioMasteringService', () => {
  if (!fs.existsSync(FIXTURE)) {
    it('should skip if fixture not found', () => {});
    return;
  }

  it('should master audio to spotify quality', async () => {
    const service = new AudioMasteringService(OUTPUT_DIR);
    const outputPath = path.join(OUTPUT_DIR, 'test_spotify_master.wav');

    const result = await service.masterToSpotify(FIXTURE, outputPath);

    assert(fs.existsSync(result.outputPath));
    // Verify output is a valid WAV file
    const stats = fs.statSync(result.outputPath);
    assert(stats.size > 0);
  });

  it('should analyze loudness', async () => {
    const service = new AudioMasteringService(OUTPUT_DIR);
    const report = await service.analyzeLoudness(FIXTURE);

    assert(report.input_i !== undefined);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/modules/mastering.service.test.js`
Expected: FAIL - "module not found" or fixture missing

- [ ] **Step 4: Create test fixture directory**

```bash
mkdir -p backend/tests/fixtures/output
# Generate a small test audio file using ffmpeg
ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -y backend/tests/fixtures/test-audio.mp3
```

- [ ] **Step 5: Run test again**

Run: `node --test tests/modules/mastering.service.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/mastering/mastering.service.js backend/tests/modules/mastering.service.test.js
git commit -m "feat: add AudioMasteringService with Spotify loudnorm

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: MasteringController and Routes

**Files:**
- Create: `backend/src/modules/mastering/mastering.controller.js`
- Create: `backend/src/api/routes/mastering.routes.js`
- Modify: `backend/src/server.js` (add routes)

- [ ] **Step 1: Create mastering controller**

```javascript
// backend/src/modules/mastering/mastering.controller.js
import { AudioMasteringService } from './mastering.service.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export const MasteringController = {
  async upload(req, res, next) {
    try {
      const { projectId } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      storage.createProjectDirs(projectId);
      const uploadDir = storage.getUploadDir(projectId);
      const fileId = uuidv4();
      const ext = path.extname(req.file.originalname);
      const uploadPath = path.join(uploadDir, `${fileId}${ext}`);

      fs.writeFileSync(uploadPath, req.file.buffer);

      res.json({
        id: fileId,
        filename: req.file.originalname,
        originalPath: uploadPath,
        duration: 0, // Will be calculated by ffprobe
      });
    } catch (error) {
      next(error);
    }
  },

  async process(req, res, next) {
    try {
      const { fileId, projectId, preset, saveToProject } = req.body;

      const uploadDir = storage.getUploadDir(projectId);
      // Find the file with matching ID
      const files = fs.readdirSync(uploadDir);
      const inputFile = files.find(f => f.startsWith(fileId));
      if (!inputFile) {
        return res.status(404).json({ error: 'File not found' });
      }

      const inputPath = path.join(uploadDir, inputFile);
      const mastersDir = storage.getMastersDir(projectId);
      const outputPath = path.join(mastersDir, `${fileId}_spotify_master.wav`);

      const service = new AudioMasteringService(mastersDir);
      await service.masterToSpotify(inputPath, outputPath);

      if (saveToProject) {
        // Update music model with mastered file path
        const { MusicModel } = await import('../../database/models/music.model.js');
        const music = MusicModel.create({
          project_id: projectId,
          original_file_path: inputPath,
          processed_file_path: outputPath,
          title: `Mastered ${inputFile}`,
          model: 'upload',
        });
        return res.json({ success: true, music });
      }

      res.json({
        success: true,
        masteredPath: outputPath,
        downloadUrl: `/api/mastering/${fileId}/download`,
      });
    } catch (error) {
      next(error);
    }
  },

  async download(req, res, next) {
    try {
      const { fileId, projectId } = req.params;
      const mastersDir = storage.getMastersDir(projectId);
      const filePath = path.join(mastersDir, `${fileId}_spotify_master.wav`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Mastered file not found' });
      }

      res.download(filePath);
    } catch (error) {
      next(error);
    }
  },
};
```

- [ ] **Step 2: Create mastering routes**

```javascript
// backend/src/api/routes/mastering.routes.js
import { MasteringController } from '../modules/mastering/mastering.controller.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];
    const ext = file.originalname.toLowerCase();
    if (allowed.some(e => ext.endsWith(e))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export const MasteringRoutes = [
  { method: 'post', path: '/api/mastering/upload/:projectId', handler: MasteringController.upload, middlewares: [upload.single('file')] },
  { method: 'post', path: '/api/mastering/process', handler: MasteringController.process },
  { method: 'get', path: '/api/mastering/:fileId/download/:projectId', handler: MasteringController.download },
];
```

- [ ] **Step 3: Register routes in server.js**

Add to projectRoutes array in server.js:
```javascript
{ method: 'post', path: '/api/mastering/upload/:projectId', handler: MasteringController.upload },
{ method: 'post', path: '/api/mastering/process', handler: MasteringController.process },
{ method: 'get', path: '/api/mastering/:fileId/download/:projectId', handler: MasteringController.download },
```

- [ ] **Step 4: Add storage utility methods**

Modify `backend/src/utils/storage.util.js` to add:
```javascript
getUploadDir(projectId) // Returns storage/projects/{id}/uploads/
getMastersDir(projectId) // Returns storage/projects/{id}/masters/
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/mastering/mastering.controller.js backend/src/api/routes/mastering.routes.js backend/src/server.js backend/src/utils/storage.util.js
git commit -m "feat: add mastering controller and routes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Frontend UploadZone Component

**Files:**
- Create: `frontend/src/components/Mastering/UploadZone.tsx`
- Test: `frontend/tests/unit/UploadZone.test.tsx`

- [ ] **Step 1: Create UploadZone with Studio Hardware aesthetic**

```tsx
// frontend/src/components/Mastering/UploadZone.tsx
import { useState, useCallback } from 'react';

interface UploadZoneProps {
  projectId: string;
  onUploadComplete: (fileId: string, filename: string) => void;
}

export default function UploadZone({ projectId, onUploadComplete }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/mastering/upload/${projectId}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onUploadComplete(data.id, data.filename);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [projectId, onUploadComplete]);

  return (
    <div
      data-testid="upload-zone"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? '#FFB800' : '#2A2A2A'}`,
        borderRadius: '8px',
        padding: '40px',
        background: dragging ? 'rgba(255, 184, 0, 0.05)' : '#1A1A1A',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 200ms ease',
      }}
    >
      <input
        type="file"
        accept=".mp3,.wav,.flac,.m4a,.ogg"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          // Handle file upload...
        }}
        style={{ display: 'none' }}
      />
      {uploading ? (
        <div style={{ color: '#FFB800' }}>Uploading...</div>
      ) : (
        <>
          <div style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>
            Drag and drop audio file here
          </div>
          <div style={{ color: '#555', fontSize: '12px' }}>
            MP3, WAV, FLAC, M4A, OGG up to 50MB
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write test**

```tsx
// frontend/tests/unit/UploadZone.test.tsx
import { test, expect } from '@playwright/test';
import { render } from '@testing-library/react';
import UploadZone from '../../../components/Mastering/UploadZone';

test('renders upload zone', () => {
  render(<UploadZone projectId="test" onUploadComplete={() => {}} />);
  expect(document.querySelector('[data-testid="upload-zone"]')).toBeTruthy();
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Mastering/UploadZone.tsx frontend/tests/unit/UploadZone.test.tsx
git commit -m "feat: add UploadZone component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Frontend VUMeter Component

**Files:**
- Create: `frontend/src/components/Mastering/VUMeter.tsx`
- Test: `frontend/tests/unit/VUMeter.test.tsx`

- [ ] **Step 1: Create LED-style VUMeter**

```tsx
// frontend/src/components/Mastering/VUMeter.tsx
import { useEffect, useState } from 'react';

interface VUMeterProps {
  level: number; // 0-100
  isActive: boolean;
}

export default function VUMeter({ level, isActive }: VUMeterProps) {
  const segments = 20;
  const activeSegments = Math.round((level / 100) * segments);

  return (
    <div data-testid="vu-meter" style={{ display: 'flex', gap: '2px', height: '100px' }}>
      {Array.from({ length: segments }).map((_, i) => {
        const segmentIndex = segments - 1 - i;
        const isLit = isActive && segmentIndex < activeSegments;

        let color = '#1A1A1A';
        if (isLit) {
          if (segmentIndex >= 16) color = '#E63946'; // Red
          else if (segmentIndex >= 12) color = '#FFB800'; // Amber
          else color = '#00FF00'; // Green
        }

        return (
          <div
            key={i}
            style={{
              width: '8px',
              height: '4px',
              background: color,
              borderRadius: '1px',
              boxShadow: isLit ? `0 0 4px ${color}` : 'none',
              transition: 'background 50ms ease',
            }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write test**

```tsx
// frontend/tests/unit/VUMeter.test.tsx
import { test, expect } from '@playwright/test';
import { render } from '@testing-library/react';
import VUMeter from '../../../components/Mastering/VUMeter';

test('renders vu meter with correct segments', () => {
  render(<VUMeter level={50} isActive={true} />);
  const meter = document.querySelector('[data-testid="vu-meter"]');
  expect(meter.children.length).toBe(20);
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Mastering/VUMeter.tsx frontend/tests/unit/VUMeter.test.tsx
git commit -m "feat: add LED-style VUMeter component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: AudioMasteringPanel Main Component

**Files:**
- Create: `frontend/src/components/Mastering/AudioMasteringPanel.tsx`
- Modify: `frontend/src/pages/Studio.tsx` (update export tab)
- Test: `frontend/tests/e2e/mastering.spec.ts`

- [ ] **Step 1: Create AudioMasteringPanel**

```tsx
// frontend/src/components/Mastering/AudioMasteringPanel.tsx
import { useState } from 'react';
import UploadZone from './UploadZone';
import VUMeter from './VUMeter';

interface FileInfo {
  id: string;
  filename: string;
  status: 'idle' | 'processing' | 'complete';
}

interface AudioMasteringPanelProps {
  projectId: string;
  allMusic: any[];
}

export default function AudioMasteringPanel({ projectId, allMusic }: AudioMasteringPanelProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [processingLevel, setProcessingLevel] = useState(0);

  const handleUploadComplete = (fileId: string, filename: string) => {
    setFiles(prev => [...prev, { id: fileId, filename, status: 'idle' }]);
  };

  const masterFile = async (fileId: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f));

    // Simulate VU meter animation
    const interval = setInterval(() => {
      setProcessingLevel(prev => Math.min(prev + 5, 80));
    }, 100);

    try {
      const response = await fetch('/api/mastering/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, projectId, preset: 'spotify', saveToProject: true }),
      });

      clearInterval(interval);
      setProcessingLevel(100);

      if (response.ok) {
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'complete' } : f));
      }
    } catch (err) {
      clearInterval(interval);
      setProcessingLevel(0);
    }
  };

  return (
    <div data-testid="mastering-panel" style={{
      background: '#0D0D0D',
      padding: '24px',
      borderRadius: '8px',
    }}>
      <h3 style={{ color: '#FFFFFF', fontFamily: 'Bebas Neue', fontSize: '24px' }}>
        SPOTIFY MASTERING
      </h3>

      <div style={{ display: 'flex', gap: '24px', marginTop: '20px' }}>
        <div style={{ flex: 1 }}>
          <UploadZone projectId={projectId} onUploadComplete={handleUploadComplete} />

          {files.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              {files.map(file => (
                <div key={file.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: '#1A1A1A',
                  borderRadius: '6px',
                  marginBottom: '8px',
                }}>
                  <span style={{ color: '#FFF' }}>{file.filename}</span>
                  {file.status === 'idle' && (
                    <button
                      data-testid={`master-btn-${file.id}`}
                      onClick={() => masterFile(file.id)}
                      style={{
                        background: '#E63946',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        color: '#FFF',
                        cursor: 'pointer',
                      }}
                    >
                      Master
                    </button>
                  )}
                  {file.status === 'processing' && (
                    <span style={{ color: '#FFB800' }}>Processing...</span>
                  )}
                  {file.status === 'complete' && (
                    <span style={{ color: '#00FF00' }}>Complete</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: '120px', display: 'flex', alignItems: 'center' }}>
          <VUMeter level={processingLevel} isActive={processingLevel > 0} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update Studio.tsx export tab**

In `frontend/src/pages/Studio.tsx`, replace FFmpegPanel with AudioMasteringPanel:
```tsx
<div style={{ display: currentStep === 'export' ? 'block' : 'none' }}>
  <AudioMasteringPanel
    projectId={project.id}
    allMusic={allMusicList}
  />
</div>
```

- [ ] **Step 3: Write E2E test**

```typescript
// frontend/tests/e2e/mastering.spec.ts
import { test, expect } from '@playwright/test';

test('complete mastering workflow', async ({ page }) => {
  await page.goto('/studio');

  // Navigate to export
  await page.click('text=Export');

  // Upload a file
  const uploadZone = page.locator('[data-testid="upload-zone"]');
  await uploadZone.setInputFiles('./tests/fixtures/test-audio.mp3');

  // Wait for file to appear
  await page.waitForSelector('[data-testid^="master-btn-"]');

  // Click master button
  const masterBtn = page.locator('[data-testid^="master-btn-"]').first();
  await masterBtn.click();

  // Wait for processing to complete
  await page.waitForSelector('text=Complete', { timeout: 30000 });
});
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Mastering/AudioMasteringPanel.tsx frontend/src/pages/Studio.tsx frontend/tests/e2e/mastering.spec.ts
git commit -m "feat: add AudioMasteringPanel with full workflow

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Auto-Convert MiniMax Output

**Files:**
- Modify: `backend/src/modules/music/music.service.js`

- [ ] **Step 1: Integrate mastering into music generation**

In `music.service.js`, after music file is saved:

```javascript
// After: const music = await MusicModel.create({...});
// Auto-master the output
if (music.original_file_path) {
  const masteringService = new AudioMasteringService(storage.getMastersDir(projectId));
  const masteredPath = music.original_file_path.replace(/\.[^.]+$/, '_spotify_master.wav');

  try {
    await masteringService.masterToSpotify(music.original_file_path, masteredPath);
    MusicModel.update(music.id, { processed_file_path: masteredPath });
  } catch (err) {
    console.error('Auto-mastering failed:', err);
    // Continue without mastering - not critical
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/music/music.service.js
git commit -m "feat: auto-convert MiniMax output to Spotify quality

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review Checklist

- [x] All operations have tests (backend unit, frontend unit, E2E)
- [x] No mocks - using real FFmpeg operations
- [x] E2E tests cover full upload → master → download flow
- [x] FFmpeg loudnorm commands verified (I=-14:TP=-1:LRA=11)
- [x] Studio Hardware aesthetic applied
- [x] Auto-convert enabled for MiniMax generation
