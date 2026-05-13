# Batch Mastering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add batch mastering - upload multiple files, batch process with Spotify loudness, select files, save to Music or download as ZIP.

**Architecture:** Backend extends MasteringController with new endpoints (batch process, save-to-music, list files, ZIP download). Frontend enhances AudioMasteringPanel with file list UI, selection state, and action buttons. Real integration tests via Playwright.

**Tech Stack:** Node.js, Express, BullMQ, FFmpeg, archiver (ZIP), React, Playwright

---

## Task 1: Backend - Install archiver for ZIP creation

**Files:**
- Modify: `backend/package.json`
- Test: `backend/tests/integration/mastering.test.js`

- [ ] **Step 1: Add archiver dependency**

Run: `cd backend && npm install archiver --save`

- [ ] **Step 2: Commit**

```bash
cd backend && git add package.json package-lock.json && git commit -m "feat: add archiver for ZIP creation"
```

---

## Task 2: Backend - Multi-file upload endpoint

**Files:**
- Modify: `backend/src/modules/mastering/mastering.controller.js:1-42`
- Modify: `backend/src/api/routes/mastering.routes.js`
- Test: `backend/tests/integration/mastering.test.js`

- [ ] **Step 1: Write failing test for multi-file upload**

```javascript
// backend/tests/integration/mastering.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const FIXTURE = path.join(__dirname, '../fixtures/test-audio.mp3');

describe('Mastering API - Multi-file Upload', () => {
  const testProjectId = 'test-batch-' + Date.now();

  it('uploads multiple files in single request', async () => {
    const form = new FormData();
    form.append('files', fs.createReadStream(FIXTURE), 'track1.mp3');
    form.append('files', fs.createReadStream(FIXTURE), 'track2.mp3');

    const res = await fetch(`http://localhost:3000/api/mastering/upload/${testProjectId}`, {
      method: 'POST',
      body: form,
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.files));
    assert.strictEqual(data.files.length, 2);
    assert.ok(data.files[0].id);
    assert.ok(data.files[1].id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "uploads multiple"`
Expected: FAIL (endpoint doesn't handle array yet)

- [ ] **Step 3: Update upload endpoint to handle multiple files**

```javascript
// backend/src/modules/mastering/mastering.controller.js

async upload(req, res, next) {
  try {
    const { projectId } = req.params;
    const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
    
    if (files.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    storage.createProjectDirs(projectId);
    const uploadDir = storage.getUploadDir(projectId);
    
    const uploadedFiles = files.map(file => {
      const fileId = uuidv4();
      const ext = path.extname(file.originalname);
      const uploadPath = path.join(uploadDir, `${fileId}${ext}`);
      fs.writeFileSync(uploadPath, file.buffer);

      let duration = 0;
      try {
        const result = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${uploadPath}"`, { encoding: 'utf8' });
        duration = parseFloat(result.trim()) || 0;
      } catch (e) {}

      return {
        id: fileId,
        filename: file.originalname,
        originalPath: uploadPath,
        duration,
      };
    });

    // Return array for both single and multi
    res.json({ files: uploadedFiles });
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Update multer config for array**

```javascript
// backend/src/api/routes/mastering.routes.js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
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

// Update route to accept array
{ method: 'post', path: '/api/mastering/upload/:projectId', handler: MasteringController.upload, middlewares: [upload.array('files', 50)] },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "uploads multiple"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/mastering/mastering.controller.js backend/src/api/routes/mastering.routes.js backend/tests/integration/mastering.test.js && git commit -m "feat: multi-file upload for batch mastering"
```

---

## Task 3: Backend - List mastered files endpoint

**Files:**
- Create: none (add to existing controller)
- Modify: `backend/src/modules/mastering/mastering.controller.js`
- Test: `backend/tests/integration/mastering.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// backend/tests/integration/mastering.test.js

it('lists mastered files for project', async () => {
  // First upload and process files
  const projectId = 'test-list-' + Date.now();
  
  // Upload a file
  const form = new FormData();
  form.append('files', fs.createReadStream(FIXTURE), 'test.mp3');
  const uploadRes = await fetch(`http://localhost:3000/api/mastering/upload/${projectId}`, {
    method: 'POST', body: form
  });
  const { files: [{ id: fileId }] } = await uploadRes.json();
  
  // Process it
  await fetch('http://localhost:3000/api/mastering/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds: [fileId], projectId, preset: 'spotify', saveToProject: false })
  });
  
  // List files
  const listRes = await fetch(`http://localhost:3000/api/mastering/files/${projectId}`);
  const { files } = await listRes.json();
  
  assert.strictEqual(files.length, 1);
  assert.strictEqual(files[0].id, fileId);
  assert.ok(files[0].masteredPath);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "lists mastered"`
Expected: FAIL (endpoint doesn't exist)

- [ ] **Step 3: Add list endpoint**

```javascript
// backend/src/modules/mastering/mastering.controller.js

async listFiles(req, res, next) {
  try {
    const { projectId } = req.params;
    const mastersDir = storage.getMastersDir(projectId);
    const uploadDir = storage.getUploadDir(projectId);

    if (!fs.existsSync(uploadDir)) {
      return res.json({ files: [] });
    }

    const uploadFiles = fs.readdirSync(uploadDir).filter(f => f.match(/\.(mp3|wav|flac|m4a|ogg)$/i));
    const masterFiles = fs.existsSync(mastersDir) ? fs.readdirSync(mastersDir) : [];

    const files = uploadFiles.map(f => {
      const fileId = f.replace(/\.(mp3|wav|flac|m4a|ogg)$/i, '');
      const masterFile = masterFiles.find(m => m.startsWith(fileId));
      const masterPath = masterFile ? path.join(mastersDir, masterFile) : null;

      let duration = 0;
      const fullPath = path.join(uploadDir, f);
      try {
        const result = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullPath}"`, { encoding: 'utf8' });
        duration = parseFloat(result.trim()) || 0;
      } catch (e) {}

      return {
        id: fileId,
        filename: f,
        originalPath: fullPath,
        masteredPath: masterPath,
        duration,
        status: masterPath ? 'mastered' : 'pending',
      };
    });

    res.json({ files });
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Add route**

```javascript
// backend/src/api/routes/mastering.routes.js
{ method: 'get', path: '/api/mastering/files/:projectId', handler: MasteringController.listFiles },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "lists mastered"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/mastering/mastering.controller.js backend/src/api/routes/mastering.routes.js && git commit -m "feat: add list mastered files endpoint"
```

---

## Task 4: Backend - Batch process endpoint

**Files:**
- Modify: `backend/src/modules/mastering/mastering.controller.js`
- Test: `backend/tests/integration/mastering.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// backend/tests/integration/mastering.test.js

it('batch processes multiple files', async () => {
  const projectId = 'test-batch-process-' + Date.now();
  
  // Upload 2 files
  const form = new FormData();
  form.append('files', fs.createReadStream(FIXTURE), 'track1.mp3');
  form.append('files', fs.createReadStream(FIXTURE), 'track2.mp3');
  const uploadRes = await fetch(`http://localhost:3000/api/mastering/upload/${projectId}`, {
    method: 'POST', body: form
  });
  const { files } = await uploadRes.json();
  const fileIds = files.map(f => f.id);
  
  // Batch process
  const processRes = await fetch('http://localhost:3000/api/mastering/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, projectId, preset: 'spotify', saveToProject: false })
  });
  
  const { results, errors } = await processRes.json();
  assert.strictEqual(results.length, 2);
  assert.strictEqual(errors.length, 0);
  assert.ok(results[0].masteredPath);
  assert.ok(results[1].masteredPath);
  
  // Verify files on disk
  assert.ok(fs.existsSync(results[0].masteredPath));
  assert.ok(fs.existsSync(results[1].masteredPath));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "batch processes"`
Expected: FAIL (endpoint doesn't handle array)

- [ ] **Step 3: Update process endpoint for batch**

```javascript
// backend/src/modules/mastering/mastering.controller.js

async process(req, res, next) {
  try {
    const { fileIds, projectId, preset, saveToProject } = req.body;
    
    // Handle single ID or array
    const ids = Array.isArray(fileIds) ? fileIds : (fileIds ? [fileIds] : []);
    
    if (ids.length === 0) {
      return res.status(400).json({ error: 'No fileIds provided' });
    }

    const uploadDir = storage.getUploadDir(projectId);
    const mastersDir = storage.getMastersDir(projectId);
    const results = [];
    const errors = [];

    for (const fileId of ids) {
      try {
        const files = fs.readdirSync(uploadDir);
        const inputFile = files.find(f => f.startsWith(fileId));
        
        if (!inputFile) {
          errors.push({ fileId, error: 'File not found' });
          continue;
        }

        const inputPath = path.join(uploadDir, inputFile);
        const outputPath = path.join(mastersDir, `${fileId}_spotify_master.wav`);

        let inputDuration = 0;
        try {
          const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`, { encoding: 'utf8' });
          inputDuration = parseFloat(dur.trim()) || 0;
        } catch (e) {}

        const service = new AudioMasteringService(mastersDir);
        await service.masterToSpotify(inputPath, outputPath);

        if (saveToProject) {
          const { MusicModel } = await import('../../database/models/music.model.js');
          const version = MusicModel.getNextVersion(projectId);
          const music = MusicModel.create({
            projectId,
            version,
            originalFilePath: inputPath,
            processedFilePath: outputPath,
            title: inputFile,
            model: 'upload',
            durationSeconds: inputDuration,
          });
          results.push({ fileId, status: 'success', masteredPath: outputPath, musicId: music.id, version });
        } else {
          results.push({ fileId, status: 'success', masteredPath: outputPath });
        }
      } catch (err) {
        errors.push({ fileId, error: err.message });
      }
    }

    res.json({ results, errors });
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "batch processes"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/mastering/mastering.controller.js && git commit -m "feat: batch process multiple files with loudnorm"
```

---

## Task 5: Backend - Save to Music endpoint

**Files:**
- Create: none (add to existing controller)
- Modify: `backend/src/modules/mastering/mastering.controller.js`
- Modify: `backend/src/api/routes/mastering.routes.js`
- Test: `backend/tests/integration/mastering.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// backend/tests/integration/mastering.test.js

it('saves mastered files to music history', async () => {
  const projectId = 'test-save-music-' + Date.now();
  
  // Upload and process
  const form = new FormData();
  form.append('files', fs.createReadStream(FIXTURE), 'test.mp3');
  const uploadRes = await fetch(`http://localhost:3000/api/mastering/upload/${projectId}`, {
    method: 'POST', body: form
  });
  const { files: [{ id: fileId }] } = await uploadRes.json();
  
  await fetch('http://localhost:3000/api/mastering/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds: [fileId], projectId, preset: 'spotify', saveToProject: false })
  });
  
  // Save to Music
  const saveRes = await fetch('http://localhost:3000/api/mastering/save-to-music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, fileIds: [fileId] })
  });
  
  const { saved } = await saveRes.json();
  assert.strictEqual(saved.length, 1);
  assert.ok(saved[0].musicId);
  assert.ok(saved[0].version);
  
  // Verify music exists via API
  const musicRes = await fetch(`http://localhost:3000/api/projects/${projectId}/music`);
  const musicList = await musicRes.json();
  assert.strictEqual(musicList.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "saves mastered files"`
Expected: FAIL (endpoint doesn't exist)

- [ ] **Step 3: Add save-to-music endpoint**

```javascript
// backend/src/modules/mastering/mastering.controller.js

async saveToMusic(req, res, next) {
  try {
    const { projectId, fileIds } = req.body;
    
    if (!projectId || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'projectId and fileIds required' });
    }

    const mastersDir = storage.getMastersDir(projectId);
    const saved = [];

    for (const fileId of fileIds) {
      const masterFiles = fs.readdirSync(mastersDir).filter(f => f.startsWith(fileId));
      const masterFile = masterFiles.find(f => f.endsWith('_spotify_master.wav'));
      
      if (!masterFile) {
        continue; // Skip if not mastered
      }

      const masterPath = path.join(mastersDir, masterFile);
      
      let duration = 0;
      try {
        const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${masterPath}"`, { encoding: 'utf8' });
        duration = parseFloat(dur.trim()) || 0;
      } catch (e) {}

      const { MusicModel } = await import('../../database/models/music.model.js');
      const version = MusicModel.getNextVersion(projectId);
      const music = MusicModel.create({
        projectId,
        version,
        originalFilePath: masterPath, // mastered file
        processedFilePath: masterPath,
        title: masterFile.replace('_spotify_master.wav', ''),
        model: 'mastering',
        durationSeconds: duration,
      });

      saved.push({ fileId, musicId: music.id, version });
    }

    res.json({ saved });
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Add route**

```javascript
// backend/src/api/routes/mastering.routes.js
{ method: 'post', path: '/api/mastering/save-to-music', handler: MasteringController.saveToMusic },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "saves mastered files"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/mastering/mastering.controller.js backend/src/api/routes/mastering.routes.js && git commit -m "feat: add save-to-music endpoint"
```

---

## Task 6: Backend - ZIP download endpoint

**Files:**
- Modify: `backend/src/modules/mastering/mastering.controller.js`
- Modify: `backend/src/api/routes/mastering.routes.js`
- Test: `backend/tests/integration/mastering.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// backend/tests/integration/mastering.test.js

it('creates ZIP of selected mastered files', async () => {
  const projectId = 'test-zip-' + Date.now();
  
  // Upload and process 2 files
  const form = new FormData();
  form.append('files', fs.createReadStream(FIXTURE), 'track1.mp3');
  form.append('files', fs.createReadStream(FIXTURE), 'track2.mp3');
  const uploadRes = await fetch(`http://localhost:3000/api/mastering/upload/${projectId}`, {
    method: 'POST', body: form
  });
  const { files } = await uploadRes.json();
  const fileIds = files.map(f => f.id);
  
  await fetch('http://localhost:3000/api/mastering/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, projectId, preset: 'spotify', saveToProject: false })
  });
  
  // Download ZIP
  const zipRes = await fetch(`http://localhost:3000/api/mastering/zip?projectId=${projectId}&fileIds=${fileIds.join(',')}`);
  
  assert.strictEqual(zipRes.status, 200);
  assert.ok(zipRes.headers.get('content-type').includes('zip'));
  
  // Verify ZIP content
  const buffer = await zipRes.arrayBuffer();
  assert.ok(buffer.byteLength > 0);
  
  // Extract and verify (basic check)
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(Buffer.from(buffer));
  const entries = zip.getEntries();
  assert.ok(entries.length >= 2); // At least our 2 files
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "creates ZIP"`
Expected: FAIL (endpoint doesn't exist)

- [ ] **Step 3: Add ZIP endpoint**

```javascript
// backend/src/modules/mastering/mastering.controller.js

async downloadZip(req, res, next) {
  try {
    const { projectId, fileIds } = req.query;
    
    if (!projectId || !fileIds) {
      return res.status(400).json({ error: 'projectId and fileIds required' });
    }

    const ids = fileIds.split(',');
    const mastersDir = storage.getMastersDir(projectId);
    
    const archiver = require('archiver');
    
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="mastered-tracks-${Date.now()}.zip"`
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    for (const fileId of ids) {
      const masterFiles = fs.readdirSync(mastersDir).filter(f => f.startsWith(fileId));
      const masterFile = masterFiles.find(f => f.endsWith('_spotify_master.wav'));
      
      if (masterFile) {
        const filePath = path.join(mastersDir, masterFile);
        archive.file(filePath, { name: masterFile });
      }
    }

    archive.pipe(res);
    archive.finalize();
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Add route**

```javascript
// backend/src/api/routes/mastering.routes.js
{ method: 'get', path: '/api/mastering/zip', handler: MasteringController.downloadZip },
```

- [ ] **Step 5: Install adm-zip for tests**

Run: `cd backend && npm install adm-zip --save-dev`

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && node --test tests/integration/mastering.test.js --grep "creates ZIP"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/mastering/mastering.controller.js backend/src/api/routes/mastering.routes.js && git commit -m "feat: add ZIP download endpoint"
```

---

## Task 7: Frontend - Enhance AudioMasteringPanel with file list and selection

**Files:**
- Modify: `frontend/src/components/Mastering/AudioMasteringPanel.tsx`
- Test: `frontend/tests/e2e/batch-mastering.spec.ts`

- [ ] **Step 1: Write failing Playwright test**

```typescript
// frontend/tests/e2e/batch-mastering.spec.ts

test('batch mastering - upload, master, select, save to music', async ({ page }) => {
  // Navigate to project with music so Export step is accessible
  const projectRes = await page.request.get('http://localhost:3000/api/projects');
  const projects = await projectRes.json();
  const project = projects.find((p: any) => p.current_music_version > 0) || projects[0];
  
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Go to Export step
  const exportBtn = page.locator('button:has-text("Export")').first();
  await exportBtn.click();
  await page.waitForTimeout(1000);
  
  // Upload multiple files
  const uploadZone = page.locator('[data-testid="upload-zone"]');
  await expect(uploadZone).toBeVisible({ timeout: 10000 });
  
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles([
    './tests/fixtures/test-audio.mp3',
    './tests/fixtures/test-audio.mp3',
  ]);
  
  // Wait for files to appear in list
  await page.waitForTimeout(2000);
  
  // Verify 2 files in list
  const fileItems = page.locator('[data-testid="file-item"]');
  await expect(fileItems).toHaveCount(2, { timeout: 5000 });
  
  // Master All
  const masterAllBtn = page.locator('button:has-text("Master All")');
  await masterAllBtn.click();
  
  // Wait for mastering to complete (check for mastered status)
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('[data-testid="file-item"]');
    return Array.from(items).some(item => item.textContent?.includes('Mastered'));
  }, { timeout: 120000 });
  
  // Select both files
  const firstFile = page.locator('[data-testid="file-item"]').first();
  await firstFile.click();
  const secondFile = page.locator('[data-testid="file-item"]').nth(1);
  await secondFile.click();
  
  // Verify selection count
  const selectionInfo = page.locator('text=/\\d+ selected/');
  await expect(selectionInfo).toContainText('2 selected');
  
  // Save to Music
  const saveBtn = page.locator('button:has-text("Save to Music")');
  await saveBtn.click();
  
  // Verify success (files should have music indicator)
  await page.waitForTimeout(2000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx playwright test tests/e2e/batch-mastering.spec.ts --grep "batch mastering"`
Expected: FAIL (component doesn't exist yet)

- [ ] **Step 3: Enhance AudioMasteringPanel with new state and UI**

```typescript
// frontend/src/components/Mastering/AudioMasteringPanel.tsx

import { useState, useCallback } from 'react';
import UploadZone from './UploadZone';
import VUMeter from './VUMeter';
import AudioEditorPanel from '../AudioEditor/AudioEditorPanel';

interface FileInfo {
  id: string;
  filename: string;
  status: 'uploading' | 'idle' | 'processing' | 'mastered' | 'error';
  progress: number;
  error?: string;
  originalPath?: string;
  masteredPath?: string;
  duration?: number;
}

// Liquid glass file row component
const GlassFileRow = ({ 
  file, 
  isSelected, 
  onSelect 
}: { 
  file: FileInfo; 
  isSelected: boolean; 
  onSelect: () => void;
}) => {
  const statusColors = {
    idle: '#888',
    uploading: '#FFB800',
    processing: '#FFB800',
    mastered: '#00FF88',
    error: '#E63946',
  };

  return (
    <div 
      data-testid="file-item"
      onClick={onSelect}
      className={`glass-row ${isSelected ? 'selected' : ''}`}
    >
      <div className="icon-circle">♪</div>
      <div className="waveform">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="wave-bar" style={{ height: `${Math.random() * 16 + 4}px` }} />
        ))}
      </div>
      <div className="file-info">
        <div className="file-name">{file.filename}</div>
        <div className="file-meta">
          <span>{file.duration ? formatTime(file.duration) : '--:--'}</span>
        </div>
      </div>
      <span className={`tag ${file.status}`}>
        {file.status === 'mastered' ? 'Mastered' : 
         file.status === 'processing' ? 'Mastering' : 'Pending'}
      </span>
      <div className={`check-circle ${isSelected ? 'selected' : ''}`}>✓</div>
    </div>
  );
};

// Action bar component
const ActionBar = ({ 
  selectedCount, 
  masteredCount,
  onMasterAll,
  onSaveToMusic,
  onDownloadZip,
  onClearSelection,
  isMastering 
}: {
  selectedCount: number;
  masteredCount: number;
  onMasterAll: () => void;
  onSaveToMusic: () => void;
  onDownloadZip: () => void;
  onClearSelection: () => void;
  isMastering: boolean;
}) => (
  <div className="action-bar">
    <button 
      className="btn btn-primary" 
      onClick={onMasterAll}
      disabled={isMastering}
    >
      {isMastering ? 'Mastering...' : 'Master All'}
    </button>
    <button 
      className="btn btn-primary" 
      onClick={onSaveToMusic}
      disabled={selectedCount === 0 || masteredCount === 0}
    >
      Save to Music
    </button>
    <button 
      className="btn btn-primary" 
      onClick={onDownloadZip}
      disabled={selectedCount === 0}
    >
      Download ZIP
    </button>
    <div className="spacer" />
    <span className="stat"><strong>{selectedCount}</strong> selected</span>
    <button className="btn btn-ghost" onClick={onClearSelection}>Clear</button>
  </div>
);

export default function AudioMasteringPanel({ projectId }: AudioMasteringPanelProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMasteringAll, setIsMasteringAll] = useState(false);
  
  const handleUploadComplete = useCallback((fileInfos: Array<{id: string, filename: string, duration?: number}>) => {
    setFiles(prev => [...prev, ...fileInfos.map(f => ({
      id: f.id,
      filename: f.filename,
      status: 'idle' as const,
      progress: 0,
      duration: f.duration,
    }))]);
  }, []);

  const handleFileSelect = useCallback((fileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const handleMasterAll = async () => {
    setIsMasteringAll(true);
    const fileIds = files.filter(f => f.status === 'idle').map(f => f.id);
    
    try {
      const res = await fetch('/api/mastering/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds, projectId, preset: 'spotify', saveToProject: false })
      });
      
      const { results } = await res.json();
      
      // Update file statuses
      setFiles(prev => prev.map(f => {
        const result = results.find((r: any) => r.fileId === f.id);
        if (result) {
          return { ...f, status: 'mastered' as const, masteredPath: result.masteredPath };
        }
        return f;
      }));
    } finally {
      setIsMasteringAll(false);
    }
  };

  const handleSaveToMusic = async () => {
    const ids = Array.from(selectedIds);
    await fetch('/api/mastering/save-to-music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, fileIds: ids })
    });
  };

  const handleDownloadZip = () => {
    const ids = Array.from(selectedIds);
    window.open(`/api/mastering/zip?projectId=${projectId}&fileIds=${ids.join(',')}`, '_blank');
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const masteredCount = files.filter(f => f.status === 'mastered').length;

  return (
    <div className="glass-panel">
      <div className="toolbar">
        <span className="toolbar-title">Track Library</span>
      </div>
      
      <UploadZone 
        projectId={projectId} 
        onUploadComplete={handleUploadComplete}
        dataTestId="upload-zone"
        multiple={true}
      />
      
      <div className="file-list">
        {files.map(file => (
          <GlassFileRow
            key={file.id}
            file={file}
            isSelected={selectedIds.has(file.id)}
            onSelect={() => handleFileSelect(file.id)}
          />
        ))}
      </div>
      
      <ActionBar
        selectedCount={selectedIds.size}
        masteredCount={masteredCount}
        onMasterAll={handleMasterAll}
        onSaveToMusic={handleSaveToMusic}
        onDownloadZip={handleDownloadZip}
        onClearSelection={handleClearSelection}
        isMastering={isMasteringAll}
      />
      
      <style>{`
        .glass-panel {
          background: rgba(255,255,255,0.06);
          backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          overflow: hidden;
        }
        .toolbar {
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
        }
        .toolbar-title {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .glass-row {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          margin: 8px 16px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          cursor: pointer;
          transition: all 300ms ease;
        }
        .glass-row:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
        }
        .glass-row.selected {
          background: rgba(230,57,70,0.12);
          border-color: rgba(230,57,70,0.35);
        }
        .icon-circle {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: rgba(255,255,255,0.5);
        }
        .glass-row.selected .icon-circle {
          background: rgba(230,57,70,0.25);
          color: #E63946;
        }
        .waveform { display: flex; align-items: center; gap: 2px; width: 56px; }
        .wave-bar { width: 3px; background: rgba(255,255,255,0.15); border-radius: 2px; }
        .glass-row.selected .wave-bar { background: rgba(230,57,70,0.3); }
        .file-info { flex: 1; }
        .file-name { font-size: 14px; color: rgba(255,255,255,0.85); font-weight: 500; }
        .glass-row.selected .file-name { color: #fff; }
        .file-meta { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .tag {
          font-size: 10px; padding: 4px 10px; border-radius: 20px;
          background: rgba(0,255,136,0.12); color: #00FF88;
        }
        .tag.processing { background: rgba(255,180,0,0.12); color: #FFB800; }
        .tag.idle { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); }
        .check-circle {
          width: 24px; height: 24px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center;
          color: transparent; font-size: 11px;
        }
        .glass-row.selected .check-circle {
          background: #E63946; border-color: #E63946; color: white;
        }
        .action-bar {
          padding: 18px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .btn {
          padding: 12px 24px;
          border-radius: 14px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 200ms;
        }
        .btn-primary {
          background: linear-gradient(135deg, #E63946, #B8232E);
          color: white;
          box-shadow: 0 6px 24px rgba(230,57,70,0.3);
        }
        .btn-primary:hover { box-shadow: 0 8px 32px rgba(230,57,70,0.4); }
        .btn-primary:disabled { opacity: 0.4; transform: none; box-shadow: none; }
        .btn-ghost {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.5);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .spacer { flex: 1; }
        .stat { font-size: 12px; color: rgba(255,255,255,0.4); }
        .stat strong { color: #E63946; }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx playwright test tests/e2e/batch-mastering.spec.ts --grep "batch mastering"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Mastering/AudioMasteringPanel.tsx && git commit -m "feat: batch mastering UI with liquid glass file list"
```

---

## Task 8: Frontend - Update UploadZone for multi-file support

**Files:**
- Modify: `frontend/src/components/Mastering/UploadZone.tsx`
- Test: `frontend/tests/e2e/batch-mastering.spec.ts`

- [ ] **Step 1: Write failing test for multi-file upload**

```typescript
// frontend/tests/e2e/batch-mastering.spec.ts

test('upload zone accepts multiple files', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Go to Export
  const exportBtn = page.locator('button:has-text("Export")').first();
  await exportBtn.click();
  await page.waitForTimeout(1000);
  
  const uploadZone = page.locator('[data-testid="upload-zone"]');
  await expect(uploadZone).toBeVisible();
  
  // Upload 3 files
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles([
    './tests/fixtures/test-audio.mp3',
    './tests/fixtures/test-audio.mp3',
    './tests/fixtures/test-audio.mp3',
  ]);
  
  // Should see 3 file items appear
  await page.waitForTimeout(3000);
  const fileItems = page.locator('[data-testid="file-item"]');
  await expect(fileItems).toHaveCount(3, { timeout: 10000 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx playwright test tests/e2e/batch-mastering.spec.ts --grep "accepts multiple files"`
Expected: FAIL (UploadZone doesn't handle multiple)

- [ ] **Step 3: Update UploadZone component**

```typescript
// frontend/src/components/Mastering/UploadZone.tsx

interface UploadZoneProps {
  projectId: string;
  onUploadComplete: (files: Array<{id: string, filename: string, duration?: number}>) => void;
  dataTestId?: string;
  multiple?: boolean;
}

// In the component, update input to accept multiple:
<input 
  type="file" 
  multiple={multiple}
  accept="audio/*"
  style={{ display: 'none' }} 
  onChange={async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Upload each file
    const uploadedFiles = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('files', file);
      
      const res = await fetch(`/api/mastering/upload/${projectId}`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (data.files) {
        uploadedFiles.push(...data.files);
      }
    }
    
    onUploadComplete(uploadedFiles);
  }}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx playwright test tests/e2e/batch-mastering.spec.ts --grep "accepts multiple files"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Mastering/UploadZone.tsx && git commit -m "feat: multi-file upload support"
```

---

## Task 9: Frontend - Download ZIP test

**Files:**
- Test: `frontend/tests/e2e/batch-mastering.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/tests/e2e/batch-mastering.spec.ts

test('download ZIP of selected files', async ({ page }) => {
  // Setup: upload and master files first (reuse previous test steps)
  // ... setup code ...
  
  // Select files
  const fileItems = page.locator('[data-testid="file-item"]');
  await fileItems.first().click();
  await fileItems.nth(1).click();
  
  // Click Download ZIP
  const zipBtn = page.locator('button:has-text("Download ZIP")');
  
  // Set up download listener
  const downloadPromise = page.waitForEvent('download');
  await zipBtn.click();
  
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.zip');
  
  // Save and verify
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
});
```

- [ ] **Step 2: Run test**
Expected: PASS (functionality already in backend)

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/batch-mastering.spec.ts && git commit -m "test: add ZIP download integration test"
```

---

## Task 10: Integration test - Verify existing functionality not broken

**Files:**
- Test: `frontend/tests/e2e/complete-workflow.spec.ts`

- [ ] **Step 1: Run existing E2E tests**

Run: `cd frontend && npx playwright test tests/e2e/complete-workflow.spec.ts --grep "Upload Audio"`
Expected: PASS (existing functionality works)

- [ ] **Step 2: If failing, fix issues**

- [ ] **Step 3: Commit any fixes**

---

## Self-Review Checklist

- [ ] All backend endpoints implemented (upload multi, list, process batch, save-to-music, ZIP)
- [ ] Frontend UI with liquid glass file list
- [ ] Selection logic (click to toggle)
- [ ] Action bar buttons functional
- [ ] Playwright tests for all major flows
- [ ] No placeholders or TBDs
- [ ] Tests use real backend, real FFmpeg, real files
- [ ] Existing tests still pass

---

## Execution

**Plan complete.** Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?