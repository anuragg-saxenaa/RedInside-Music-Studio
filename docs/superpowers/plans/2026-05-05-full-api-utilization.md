# RedInside Music Studio - Full MiniMax API Integration Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement.

**Goal:** Integrate all MiniMax APIs - Voice Design, Voice Cloning, Image Generation - into RedInside Music Studio as a world-class music production platform.

**Architecture:** Add three new workflow stages: Artwork (Image Gen), Voice Design, Voice Cloning. Integrate TTS for audio announcements. Full FFmpeg export options.

**Tech Stack:** React + TypeScript + MiniMax API + FFmpeg.wasm

---

## Task 1: Add Image Generation API Backend Support

**Files:**
- Create: `backend/src/modules/image/image.service.js`
- Create: `backend/src/modules/image/image.controller.js`
- Create: `backend/src/routes/image.routes.js`
- Modify: `backend/src/server.js` (register routes)
- Modify: `backend/src/utils/minimax.client.js` (add image generation)

- [ ] **Step 1: Create MiniMax image client method**

In `minimax.client.js`, add:
```js
async generateImage({ model = 'image-01', prompt, aspectRatio, width, height, responseFormat = 'url', seed, n = 1, promptOptimizer, subjectReference }) {
  const payload = { model, prompt };
  if (aspectRatio) payload.aspect_ratio = aspectRatio;
  if (width && height) { payload.width = width; payload.height = height; }
  if (responseFormat) payload.response_format = responseFormat;
  if (seed) payload.seed = seed;
  if (n) payload.n = n;
  if (promptOptimizer) payload.prompt_optimizer = promptOptimizer;
  if (subjectReference) payload.subject_reference = subjectReference;

  return this.request('/v1/image_generation', 'POST', payload);
}
```

- [ ] **Step 2: Create image service**

Create `backend/src/modules/image/image.service.js`:
```js
const path = require('path');
const { StorageService } = require('../../utils/storage.util');
const { MiniMaxClient } = require('../../utils/minimax.client');

class ImageService {
  constructor() {
    this.minimax = new MiniMaxClient();
    this.storage = new StorageService('image');
  }

  async generateImage({ projectId, prompt, model, aspectRatio, width, height, responseFormat, seed, n, promptOptimizer, subjectReference }) {
    const result = await this.minimax.generateImage({
      model: model || 'image-01',
      prompt,
      aspectRatio,
      width,
      height,
      responseFormat: responseFormat || 'url',
      seed,
      n: n || 1,
      promptOptimizer,
      subjectReference,
    });

    if (result.base_resp.status_code !== 0) {
      throw new Error(result.base_resp.status_msg || 'Image generation failed');
    }

    // Save to database
    const db = require('../../database/connection');
    const stmt = db.prepare(`
      INSERT INTO image_generations (project_id, model, prompt, aspect_ratio, width, height, image_urls, seed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      projectId,
      model || 'image-01',
      prompt,
      aspectRatio || '1:1',
      width,
      height,
      JSON.stringify(result.data?.image_urls || []),
      seed,
      new Date().toISOString()
    );

    return {
      id: info.lastInsertRowid,
      projectId,
      model,
      prompt,
      imageUrls: result.data?.image_urls || [],
      seed,
    };
  }

  async getProjectImages(projectId) {
    const db = require('../../database/connection');
    const stmt = db.prepare('SELECT * FROM image_generations WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId);
  }
}

module.exports = { ImageService };
```

- [ ] **Step 3: Create image controller**

Create `backend/src/modules/image/image.controller.js`:
```js
const { ImageService } = require('./image.service');

class ImageController {
  constructor() {
    this.service = new ImageService();
  }

  async generate(req, res) {
    try {
      const { projectId, prompt, model, aspectRatio, width, height, responseFormat, seed, n, promptOptimizer, subjectReference } = req.body;
      if (!projectId || !prompt) {
        return res.status(400).json({ error: 'projectId and prompt are required' });
      }
      const result = await this.service.generateImage({
        projectId, prompt, model, aspectRatio, width, height, responseFormat, seed, n, promptOptimizer, subjectReference,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async list(req, res) {
    try {
      const { projectId } = req.params;
      const images = await this.service.getProjectImages(projectId);
      res.json(images);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = { ImageController };
```

- [ ] **Step 4: Create routes**

Create `backend/src/routes/image.routes.js`:
```js
const { ImageController } = require('../modules/image/image.controller');

function registerImageRoutes(app) {
  const controller = new ImageController();
  app.post('/api/image/generate', controller.generate.bind(controller));
  app.get('/api/projects/:projectId/images', controller.list.bind(controller));
}

module.exports = { registerImageRoutes };
```

- [ ] **Step 5: Update server.js**

Add to server.js imports and route registration:
```js
const { registerImageRoutes } = require('./routes/image.routes');
// In setupRoutes():
registerImageRoutes(app);
```

- [ ] **Step 6: Add database migration**

In `backend/src/database/migrate.js`, add:
```js
// Image generations table
db.exec(`
  CREATE TABLE IF NOT EXISTS image_generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    aspect_ratio TEXT,
    width INTEGER,
    height INTEGER,
    image_urls TEXT,
    seed INTEGER,
    created_at TEXT NOT NULL
  )
`);
```

Run: `cd backend && npm run db:migrate` - verify table created

---

## Task 2: Add Voice Design API Backend Support

**Files:**
- Modify: `backend/src/utils/minimax.client.js` (add voice design)
- Create: `backend/src/modules/voice/voice.service.js`
- Create: `backend/src/modules/voice/voice.controller.js`
- Create: `backend/src/routes/voice.routes.js`
- Modify: `backend/src/server.js` (register routes)

- [ ] **Step 1: Add voice design method to MiniMax client**

In `minimax.client.js`, add:
```js
async createVoiceDesign({ prompt, previewText, voiceId }) {
  const payload = { prompt, preview_text: previewText };
  if (voiceId) payload.voice_id = voiceId;
  return this.request('/v1/voice_design', 'POST', payload);
}

async getVoiceList() {
  return this.request('/v1/voice/list', 'GET');
}

async deleteVoice(voiceId) {
  return this.request(`/v1/voice/delete?voice_id=${voiceId}`, 'DELETE');
}
```

- [ ] **Step 2: Create voice service**

Create `backend/src/modules/voice/voice.service.js`:
```js
const { MiniMaxClient } = require('../../utils/minimax.client');

class VoiceService {
  constructor() {
    this.minimax = new MiniMaxClient();
  }

  async designVoice({ prompt, previewText, voiceId }) {
    const result = await this.minimax.createVoiceDesign({ prompt, previewText, voiceId });
    if (result.base_resp.status_code !== 0) {
      throw new Error(result.base_resp.status_msg || 'Voice design failed');
    }
    return {
      voiceId: result.voice_id,
      trialAudio: result.trial_audio,
    };
  }

  async listVoices() {
    const result = await this.minimax.getVoiceList();
    return result.data?.voices || [];
  }

  async deleteVoice(voiceId) {
    const result = await this.minimax.deleteVoice(voiceId);
    return result.base_resp.status_code === 0;
  }
}

module.exports = { VoiceService };
```

- [ ] **Step 3: Create voice controller**

Create `backend/src/modules/voice/voice.controller.js`:
```js
const { VoiceService } = require('./voice.service');

class VoiceController {
  constructor() {
    this.service = new VoiceService();
  }

  async design(req, res) {
    try {
      const { prompt, previewText, voiceId } = req.body;
      if (!prompt || !previewText) {
        return res.status(400).json({ error: 'prompt and previewText are required' });
      }
      const result = await this.service.designVoice({ prompt, previewText, voiceId });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async list(req, res) {
    try {
      const voices = await this.service.listVoices();
      res.json(voices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async delete(req, res) {
    try {
      const { voiceId } = req.params;
      await this.service.deleteVoice(voiceId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = { VoiceController };
```

- [ ] **Step 4: Create routes**

Create `backend/src/routes/voice.routes.js`:
```js
const { VoiceController } = require('../modules/voice/voice.controller');

function registerVoiceRoutes(app) {
  const controller = new VoiceController();
  app.post('/api/voice/design', controller.design.bind(controller));
  app.get('/api/voices', controller.list.bind(controller));
  app.delete('/api/voice/:voiceId', controller.delete.bind(controller));
}

module.exports = { registerVoiceRoutes };
```

- [ ] **Step 5: Update server.js**

Add imports and route registration:
```js
const { registerVoiceRoutes } = require('./routes/voice.routes');
// In setupRoutes():
registerVoiceRoutes(app);
```

Run: `cd backend && npm run dev` - verify voice endpoints work

---

## Task 3: Add Voice Cloning API Backend Support

**Files:**
- Modify: `backend/src/utils/minimax.client.js` (add voice clone upload)
- Modify: `backend/src/modules/voice/voice.service.js` (add clone methods)
- Modify: `backend/src/modules/voice/voice.controller.js` (add clone endpoints)

- [ ] **Step 1: Add voice clone upload to MiniMax client**

In `minimax.client.js`, add:
```js
async uploadVoiceClone(filePath) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('purpose', 'voice_clone');

  const response = await fetch(`${this.baseUrl}/v1/files/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${this.apiKey}` },
    body: formData,
  });
  return response.json();
}
```

- [ ] **Step 2: Add voice clone methods to voice service**

In `voice.service.js`, add:
```js
async cloneVoice({ projectId, audioFilePath, name }) {
  const uploadResult = await this.minimax.uploadVoiceClone(audioFilePath);
  if (uploadResult.base_resp.status_code !== 0) {
    throw new Error(uploadResult.base_resp.status_msg || 'Voice upload failed');
  }

  // Save to database
  const db = require('../../database/connection');
  const stmt = db.prepare(`
    INSERT INTO voice_clones (project_id, name, file_id, filename, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    projectId,
    name,
    uploadResult.file.file_id,
    uploadResult.file.filename,
    new Date().toISOString()
  );

  return {
    id: info.lastInsertRowid,
    projectId,
    name,
    fileId: uploadResult.file.file_id,
    filename: uploadResult.file.filename,
  };
}

async getVoiceClones(projectId) {
  const db = require('../../database/connection');
  const stmt = db.prepare('SELECT * FROM voice_clones WHERE project_id = ? ORDER BY created_at DESC');
  return stmt.all(projectId);
}
```

- [ ] **Step 3: Add voice clone database table**

In `migrate.js`, add:
```js
// Voice clones table
db.exec(`
  CREATE TABLE IF NOT EXISTS voice_clones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
```

- [ ] **Step 4: Update voice controller**

In `voice.controller.js`, add:
```js
async clone(req, res) {
  try {
    const { projectId, name } = req.body;
    if (!projectId || !name) {
      return res.status(400).json({ error: 'projectId and name are required' });
    }
    // Note: In production, handle file upload properly
    // For now, assume audioUrl is provided instead of file path
    const result = await this.service.cloneVoice({ projectId, name, audioUrl });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
```

Add route:
```js
app.post('/api/voice/clone', controller.clone.bind(controller));
app.get('/api/projects/:projectId/voices', controller.listClones.bind(controller));
```

Run: `cd backend && npm run db:migrate` - verify table created

---

## Task 4: Add Artwork Tab to Frontend

**Files:**
- Create: `frontend/src/components/ArtworkGenerator/ArtworkGenerator.tsx`
- Modify: `frontend/src/pages/Studio.tsx` (add artwork tab)
- Modify: `frontend/src/components/WorkflowStepper/WorkflowStepper.tsx` (add step)

- [ ] **Step 1: Create ArtworkGenerator component**

Create `frontend/src/components/ArtworkGenerator/ArtworkGenerator.tsx`:
```tsx
import { useState } from 'react';

interface ArtworkGeneratorProps {
  projectId: string;
}

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (1024×1024)' },
  { value: '16:9', label: '16:9 (1280×720)' },
  { value: '4:3', label: '4:3 (1152×864)' },
  { value: '9:16', label: '9:16 (720×1280)' },
  { value: '3:2', label: '3:2 (1248×832)' },
  { value: '2:3', label: '2:3 (832×1248)' },
];

export default function ArtworkGenerator({ projectId }: ArtworkGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<Array<{ id: number; imageUrls: string[]; prompt: string }>>([]);
  const [n, setN] = useState(1);
  const [seed, setSeed] = useState<number | undefined>();

  const generateArtwork = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt, aspectRatio, n, seed }),
      });
      const result = await response.json();
      setImages(prev => [result, ...prev]);
    } catch (err) {
      console.error('Artwork generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px' }}>
          Generate Artwork
        </h3>
        <p style={{ color: '#A0A0A0', fontSize: '14px', marginBottom: '16px' }}>
          Create album artwork, artist images, and cover art using AI
        </p>
      </div>

      {/* Prompt */}
      <div>
        <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
          Describe your artwork
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cinematic portrait of a rapper in a dimly lit studio with red LED lights..."
          maxLength={1500}
          style={{
            width: '100%',
            height: '100px',
            backgroundColor: '#141414',
            border: '1px solid #2A2A2A',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: '14px',
            fontFamily: 'DM Sans, sans-serif',
            resize: 'none',
            outline: 'none',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
        />
        <div style={{ color: '#666666', fontSize: '11px', marginTop: '4px', textAlign: 'right' }}>
          {prompt.length}/1500
        </div>
      </div>

      {/* Options Row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {/* Aspect Ratio */}
        <div>
          <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Aspect Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {ASPECT_RATIOS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Number of images */}
        <div>
          <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Count</label>
          <select
            value={n}
            onChange={(e) => setN(parseInt(e.target.value))}
            style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        {/* Seed */}
        <div>
          <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Seed (optional)</label>
          <input
            type="number"
            value={seed || ''}
            onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="Random"
            style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: '13px',
              width: '100px',
            }}
          />
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateArtwork}
        disabled={generating || !prompt.trim()}
        style={{
          backgroundColor: generating || !prompt.trim() ? '#666666' : '#E63946',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          padding: '14px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
        onMouseOver={(e) => { if (!generating && prompt.trim()) e.currentTarget.style.backgroundColor = '#FF4757'; }}
        onMouseOut={(e) => { if (!generating && prompt.trim()) e.currentTarget.style.backgroundColor = '#E63946'; }}
      >
        {generating ? '⏳ Generating...' : '🎨 Generate Artwork'}
      </button>

      {/* Generated Artwork Grid */}
      {images.length > 0 && (
        <div>
          <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>
            Generated Artwork
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            {images.map(img => (
              img.imageUrls.map((url, i) => (
                <div key={`${img.id}-${i}`} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={url} alt={`Artwork ${i + 1}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
                  <a
                    href={url}
                    download
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: '#FFFFFF',
                      textDecoration: 'none',
                      fontSize: '12px',
                    }}
                  >
                    ↓ Download
                  </a>
                </div>
              ))
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update WorkflowStepper to include artwork step**

In `WorkflowStepper.tsx`, add 'artwork' step:
```tsx
type WorkflowStep = 'lyrics' | 'music' | 'artwork' | 'export';
```

And add the new step button in the stepper rendering.

- [ ] **Step 3: Add artwork tab to Studio.tsx**

In Studio.tsx:
```tsx
import ArtworkGenerator from '../components/ArtworkGenerator/ArtworkGenerator';
```

Add case:
```tsx
<div style={{ display: currentStep === 'artwork' ? 'block' : 'none' }}>
  <ArtworkGenerator projectId={project.id} />
</div>
```

Run: `npm run dev` - verify artwork tab appears and generates images

---

## Task 5: Add Voice Design Tab to Frontend

**Files:**
- Create: `frontend/src/components/VoiceDesign/VoiceDesign.tsx`
- Modify: `frontend/src/pages/Studio.tsx` (add voice tab)

- [ ] **Step 1: Create VoiceDesign component**

Create `frontend/src/components/VoiceDesign/VoiceDesign.tsx`:
```tsx
import { useState } from 'react';

const VOICE_EXAMPLES = [
  'Deep, gravelly voice like a seasoned jazz vocalist',
  'Energetic and youthful, like a pop radio host',
  'Raspy, emotional indie singer voice',
  'Bold and commanding, authoritative documentary narrator',
  'Soft and intimate, late-night radio host voice',
];

export default function VoiceDesign() {
  const [prompt, setPrompt] = useState('');
  const [previewText, setPreviewText] = useState('Hey everyone, welcome back to the show...');
  const [designing, setDesigning] = useState(false);
  const [voices, setVoices] = useState<Array<{ voiceId: string; trialAudio?: string }>>([]);
  const [customVoiceId, setCustomVoiceId] = useState('');

  const designVoice = async () => {
    if (!prompt.trim() || !previewText.trim()) return;
    setDesigning(true);
    try {
      const response = await fetch('/api/voice/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, previewText, voiceId: customVoiceId || undefined }),
      });
      const result = await response.json();
      setVoices(prev => [result, ...prev]);
      if (result.trialAudio) {
        // Play trial audio
        const audio = new Audio(`data:audio/mp3;base64,${result.trialAudio}`);
        audio.play();
      }
    } catch (err) {
      console.error('Voice design failed:', err);
    } finally {
      setDesigning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px' }}>
          Voice Design Studio
        </h3>
        <p style={{ color: '#A0A0A0', fontSize: '14px', marginBottom: '16px' }}>
          Create custom AI voices from text descriptions. Use them for TTS, announcements, and more.
        </p>
      </div>

      {/* Voice Examples */}
      <div>
        <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
          Try an example prompt
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {VOICE_EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setPrompt(ex)}
              style={{
                backgroundColor: '#1E1E1E',
                border: '1px solid #2A2A2A',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#A0A0A0',
                fontSize: '12px',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => (e.currentTarget as HTMLElement).style.borderColor = '#E63946'}
              onMouseOut={(e) => (e.currentTarget as HTMLElement).style.borderColor = '#2A2A2A'}
            >
              {ex.slice(0, 30)}...
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
          Voice Description
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the voice: age, gender, accent, personality, speaking style..."
          maxLength={500}
          style={{
            width: '100%',
            height: '80px',
            backgroundColor: '#141414',
            border: '1px solid #2A2A2A',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: '14px',
            fontFamily: 'DM Sans, sans-serif',
            resize: 'none',
            outline: 'none',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
        />
      </div>

      {/* Preview Text */}
      <div>
        <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
          Preview Text (what the voice will say)
        </label>
        <input
          type="text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="Enter preview text..."
          maxLength={500}
          style={{
            width: '100%',
            backgroundColor: '#141414',
            border: '1px solid #2A2A2A',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: '14px',
            outline: 'none',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
        />
      </div>

      {/* Custom Voice ID (optional) */}
      <div>
        <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
          Custom Voice ID (optional)
        </label>
        <input
          type="text"
          value={customVoiceId}
          onChange={(e) => setCustomVoiceId(e.target.value)}
          placeholder="my-custom-voice"
          style={{
            width: '200px',
            backgroundColor: '#141414',
            border: '1px solid #2A2A2A',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#FFFFFF',
            fontSize: '13px',
            outline: 'none',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
        />
      </div>

      {/* Design Button */}
      <button
        onClick={designVoice}
        disabled={designing || !prompt.trim() || !previewText.trim()}
        style={{
          backgroundColor: designing || !prompt.trim() || !previewText.trim() ? '#666666' : '#E63946',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          padding: '14px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: designing || !prompt.trim() || !previewText.trim() ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
        onMouseOver={(e) => { if (!designing && prompt.trim()) e.currentTarget.style.backgroundColor = '#FF4757'; }}
        onMouseOut={(e) => { if (!designing && prompt.trim()) e.currentTarget.style.backgroundColor = '#E63946'; }}
      >
        {designing ? '⏳ Creating Voice...' : '🎙️ Design Voice'}
      </button>

      {/* Generated Voices */}
      {voices.length > 0 && (
        <div>
          <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>
            Your Voices
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {voices.map((v, i) => (
              <div key={i} style={{
                backgroundColor: '#1E1E1E',
                border: '1px solid #2A2A2A',
                borderRadius: '8px',
                padding: '12px 16px',
              }}>
                <div style={{ color: '#E63946', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>
                  Voice ID: {v.voiceId}
                </div>
                <div style={{ color: '#A0A0A0', fontSize: '12px', marginTop: '4px' }}>
                  Ready for TTS synthesis
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add voice tab to Studio.tsx**

```tsx
import VoiceDesign from '../components/VoiceDesign/VoiceDesign';
```

Add case:
```tsx
<div style={{ display: currentStep === 'voice' ? 'block' : 'none' }}>
  <VoiceDesign />
</div>
```

Run: `npm run dev` - verify voice design tab appears

---

## Task 6: Update Spec Document with Full API Integration

**Files:**
- Modify: `docs/superpowers/specs/2026-05-05-frontend-design-system.md`

Add new sections documenting all new API integrations.

---

## Verification

Run all tests:
```bash
cd backend && npm test
cd frontend && npm run dev
```

Manual verification checklist:
- [ ] Image generation with aspect ratio selection works
- [ ] Voice design with preview audio works
- [ ] Voice cloning (upload + clone) works
- [ ] Artwork tab visible in workflow stepper
- [ ] Voice tab visible in workflow stepper
- [ ] All MiniMax APIs connected: music, lyrics, image, voice, ffmpeg