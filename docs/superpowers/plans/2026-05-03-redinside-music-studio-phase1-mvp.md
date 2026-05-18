# RedInside Music Studio - Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build working MVP with lyrics → music generation workflow, FFmpeg 320kbps conversion, and basic history tracking.

**Architecture:** Modular monolith with Node.js/Express backend, React frontend, SQLite database, BullMQ job queue, and MiniMax API integration.

**Tech Stack:** Node.js 18+, Express, React, Vite, SQLite3, BullMQ, Redis, Axios, fluent-ffmpeg

**Phase 1 Scope:**
- ✅ Backend foundation (Express, SQLite, MiniMax client)
- ✅ Lyrics generation with style presets
- ✅ Music generation with FFmpeg 320kbps conversion
- ✅ Job queue system (BullMQ)
- ✅ Basic history/version tracking
- ✅ Minimal React frontend for testing

**Phase 2 Scope (completed):**
- ✅ Video generation module + routes
- ✅ Viral toolkit module + routes
- ✅ Advanced FFmpeg tools (`POST /api/ffmpeg/convert-bitrate`, `POST /api/ffmpeg/merge`)
- ✅ Full workflow UI (Studio with 7 steps: Lyrics → Music → Artwork → Video → Voice → Medley → Export/Master)
- ✅ Medley module + UI (`MedleyPanel` component, drag-to-reorder, export)
- ✅ Mastering, Upload, Voice Design, Artwork Generator modules
- ✅ WebSocket real-time updates
- ✅ E2E tests: 31/31 passing (real-user-walkthrough.spec.ts)
- ✅ Backend integration tests: 157+ passing

---

## File Structure

```
redinside-music-studio/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.config.js
│   │   ├── database/
│   │   │   ├── connection.js
│   │   │   ├── migrations/
│   │   │   │   └── 001_initial.sql
│   │   │   └── models/
│   │   │       ├── project.model.js
│   │   │       ├── lyrics.model.js
│   │   │       └── music.model.js
│   │   ├── modules/
│   │   │   ├── lyrics/
│   │   │   │   ├── lyrics.service.js
│   │   │   │   ├── lyrics.controller.js
│   │   │   │   └── presets.js
│   │   │   ├── music/
│   │   │   │   ├── music.service.js
│   │   │   │   └── music.controller.js
│   │   │   └── ffmpeg/
│   │   │       └── ffmpeg.service.js
│   │   ├── queue/
│   │   │   ├── queue.config.js
│   │   │   ├── workers/
│   │   │   │   ├── lyrics.worker.js
│   │   │   │   ├── music.worker.js
│   │   │   │   └── ffmpeg.worker.js
│   │   │   └── jobs.service.js
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── projects.routes.js
│   │   │   │   ├── lyrics.routes.js
│   │   │   │   ├── music.routes.js
│   │   │   │   └── jobs.routes.js
│   │   │   └── middleware/
│   │   │       ├── error.middleware.js
│   │   │       └── validation.middleware.js
│   │   ├── utils/
│   │   │   ├── minimax.client.js
│   │   │   ├── storage.util.js
│   │   │   └── logger.js
│   │   └── server.js
│   ├── tests/
│   │   ├── setup.js
│   │   ├── utils/
│   │   │   └── minimax.client.test.js
│   │   └── modules/
│   │       ├── lyrics.service.test.js
│   │       └── music.service.test.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Studio.tsx
│   │   ├── components/
│   │   │   ├── LyricsEditor.tsx
│   │   │   └── MusicPlayer.tsx
│   │   ├── services/
│   │   │   └── api.service.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── storage/
│   └── .gitkeep
├── database/
│   └── .gitkeep
├── config/
│   └── .env.example
└── docker-compose.yml
```

---

## Task 1: Project Setup & Dependencies

**Files:**
- Create: `package.json` (root)
- Create: `backend/package.json`
- Create: `frontend/package.json`
- Create: `config/.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize root workspace**

```bash
cd /Users/admin/Anurag/Development/Codebase/ai/RedInside-Music-Studio
npm init -y
```

- [ ] **Step 2: Create backend package.json**

```json
{
  "name": "redinside-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "test": "node --test tests/**/*.test.js",
    "db:migrate": "node src/database/migrate.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "axios": "^1.6.0",
    "better-sqlite3": "^9.2.2",
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.2",
    "fluent-ffmpeg": "^2.1.2",
    "nanoid": "^5.0.4",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

Save to `backend/package.json`

- [ ] **Step 3: Create frontend package.json**

```json
{
  "name": "redinside-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.8"
  }
}
```

Save to `frontend/package.json`

- [ ] **Step 4: Create environment config template**

```bash
# MiniMax API Configuration
MINIMAX_API_KEY=your_api_key_here
MINIMAX_BASE_URL=https://api.minimax.io

# Server Configuration
PORT=3000
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Database
DATABASE_PATH=../database/music-studio.sqlite

# Storage
STORAGE_PATH=../storage
```

Save to `config/.env.example`

- [ ] **Step 5: Create .gitignore**

```
# Dependencies
node_modules/
package-lock.json

# Environment
.env
.env.local

# Database
database/*.sqlite
database/*.sqlite-journal

# Storage
storage/*
!storage/.gitkeep

# Logs
logs/
*.log

# Build
dist/
build/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
```

Save to `.gitignore`

- [ ] **Step 6: Install dependencies**

```bash
cd backend && npm install
cd ../frontend && npm install
```

Expected: All packages installed successfully

- [ ] **Step 7: Create storage and database directories**

```bash
mkdir -p storage/projects storage/cache database
touch storage/.gitkeep database/.gitkeep
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: initial project setup with dependencies"
```

---

## Task 2: Environment Configuration

**Files:**
- Create: `backend/src/config/env.config.js`
- Create: `backend/src/utils/logger.js`
- Modify: `config/.env` (copy from .env.example)

- [ ] **Step 1: Write failing test for env config**

```javascript
// backend/tests/config/env.config.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import config from '../../src/config/env.config.js';

test('should load environment configuration', () => {
  assert.ok(config.minimax.apiKey, 'API key should be loaded');
  assert.strictEqual(config.server.port, 3000);
  assert.strictEqual(config.redis.host, 'localhost');
});

test('should throw if MINIMAX_API_KEY is missing', () => {
  const originalKey = process.env.MINIMAX_API_KEY;
  delete process.env.MINIMAX_API_KEY;
  
  assert.throws(() => {
    delete require.cache[require.resolve('../../src/config/env.config.js')];
    require('../../src/config/env.config.js');
  }, /MINIMAX_API_KEY is required/);
  
  process.env.MINIMAX_API_KEY = originalKey;
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
node --test tests/config/env.config.test.js
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement env config**

```javascript
// backend/src/config/env.config.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from config directory
dotenv.config({ path: path.resolve(__dirname, '../../../config/.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required in environment configuration`);
  }
  return value;
}

const config = {
  minimax: {
    apiKey: requireEnv('MINIMAX_API_KEY'),
    baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  database: {
    path: path.resolve(__dirname, process.env.DATABASE_PATH || '../../../database/music-studio.sqlite'),
  },
  storage: {
    path: path.resolve(__dirname, process.env.STORAGE_PATH || '../../../storage'),
  },
};

export default config;
```

- [ ] **Step 4: Implement logger utility**

```javascript
// backend/src/utils/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export default logger;
```

- [ ] **Step 5: Copy .env.example to .env and add API key**

```bash
cp config/.env.example config/.env
# Manually edit config/.env and add your MiniMax API key
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend
node --test tests/config/env.config.test.js
```

Expected: PASS (after adding valid API key to .env)

- [ ] **Step 7: Commit**

```bash
git add backend/src/config/ backend/src/utils/logger.js backend/tests/config/
git commit -m "feat: add environment configuration and logger"
```

---

## Task 3: Database Setup & Models

**Files:**
- Create: `backend/src/database/connection.js`
- Create: `backend/src/database/migrations/001_initial.sql`
- Create: `backend/src/database/migrate.js`
- Create: `backend/src/database/models/project.model.js`
- Create: `backend/src/database/models/lyrics.model.js`
- Create: `backend/src/database/models/music.model.js`

- [ ] **Step 1: Write failing test for database connection**

```javascript
// backend/tests/database/connection.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import db from '../../src/database/connection.js';

test('should connect to SQLite database', () => {
  const result = db.prepare('SELECT 1 as value').get();
  assert.strictEqual(result.value, 1);
});

test('should have projects table', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").get();
  assert.ok(tables, 'projects table should exist');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
node --test tests/database/connection.test.js
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement database connection**

```javascript
// backend/src/database/connection.js
import Database from 'better-sqlite3';
import config from '../config/env.config.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

// Ensure database directory exists
const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.database.path);

// Enable foreign keys
db.pragma('foreign_keys = ON');

logger.info(`Database connected: ${config.database.path}`);

export default db;
```

- [ ] **Step 4: Create initial migration SQL**

```sql
-- backend/src/database/migrations/001_initial.sql

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  current_lyrics_version INTEGER DEFAULT 0,
  current_music_version INTEGER DEFAULT 0,
  workflow_mode TEXT CHECK(workflow_mode IN ('auto', 'manual', 'hybrid')) DEFAULT 'hybrid',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lyrics generations table
CREATE TABLE IF NOT EXISTS lyrics_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  prompt TEXT,
  mode TEXT CHECK(mode IN ('write_full_song', 'edit')) DEFAULT 'write_full_song',
  style_preset TEXT,
  content TEXT NOT NULL,
  title TEXT,
  style_tags TEXT,
  structure_tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, version)
);

-- Music generations table
CREATE TABLE IF NOT EXISTS music_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lyrics_id TEXT,
  version INTEGER NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  audio_settings TEXT,
  is_instrumental INTEGER DEFAULT 0,
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

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('generate-lyrics', 'generate-music', 'ffmpeg-process')) NOT NULL,
  status TEXT CHECK(status IN ('queued', 'active', 'completed', 'failed')) DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  input_params TEXT,
  result TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lyrics_project ON lyrics_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_music_project ON music_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
```

- [ ] **Step 5: Implement migration runner**

```javascript
// backend/src/database/migrate.js
import db from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    logger.info(`Running migration: ${file}`);
    db.exec(sql);
  }
  
  logger.info('All migrations completed');
}

// Run migrations if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export default runMigrations;
```

- [ ] **Step 6: Run migrations**

```bash
cd backend
npm run db:migrate
```

Expected: "All migrations completed"

- [ ] **Step 7: Implement project model**

```javascript
// backend/src/database/models/project.model.js
import db from '../connection.js';
import { nanoid } from 'nanoid';

export const ProjectModel = {
  create(data) {
    const id = nanoid();
    const stmt = db.prepare(`
      INSERT INTO projects (id, name, description, workflow_mode)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, data.name, data.description || null, data.workflowMode || 'hybrid');
    
    return this.findById(id);
  },
  
  findById(id) {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  },
  
  findAll() {
    return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  },
  
  update(id, data) {
    const updates = [];
    const values = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.workflowMode !== undefined) {
      updates.push('workflow_mode = ?');
      values.push(data.workflowMode);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    return this.findById(id);
  },
  
  incrementVersion(id, type) {
    const field = `current_${type}_version`;
    db.prepare(`UPDATE projects SET ${field} = ${field} + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  },
  
  delete(id) {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  },
};
```

- [ ] **Step 8: Implement lyrics model**

```javascript
// backend/src/database/models/lyrics.model.js
import db from '../connection.js';
import { nanoid } from 'nanoid';

export const LyricsModel = {
  create(data) {
    const id = nanoid();
    const stmt = db.prepare(`
      INSERT INTO lyrics_generations (
        id, project_id, version, prompt, mode, style_preset,
        content, title, style_tags, structure_tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.projectId,
      data.version,
      data.prompt || null,
      data.mode || 'write_full_song',
      data.stylePreset || null,
      data.content,
      data.title || null,
      data.styleTags || null,
      data.structureTags ? JSON.stringify(data.structureTags) : null
    );
    
    return this.findById(id);
  },
  
  findById(id) {
    const row = db.prepare('SELECT * FROM lyrics_generations WHERE id = ?').get(id);
    if (row && row.structure_tags) {
      row.structure_tags = JSON.parse(row.structure_tags);
    }
    return row;
  },
  
  findByProject(projectId) {
    const rows = db.prepare('SELECT * FROM lyrics_generations WHERE project_id = ? ORDER BY version DESC').all(projectId);
    return rows.map(row => {
      if (row.structure_tags) row.structure_tags = JSON.parse(row.structure_tags);
      return row;
    });
  },
  
  getNextVersion(projectId) {
    const result = db.prepare('SELECT MAX(version) as max_version FROM lyrics_generations WHERE project_id = ?').get(projectId);
    return (result?.max_version || 0) + 1;
  },
};
```

- [ ] **Step 9: Implement music model**

```javascript
// backend/src/database/models/music.model.js
import db from '../connection.js';
import { nanoid } from 'nanoid';

export const MusicModel = {
  create(data) {
    const id = nanoid();
    const stmt = db.prepare(`
      INSERT INTO music_generations (
        id, project_id, lyrics_id, version, model, prompt,
        audio_settings, is_instrumental, original_file_path,
        processed_file_path, duration_seconds, sample_rate, bitrate, format
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.projectId,
      data.lyricsId || null,
      data.version,
      data.model,
      data.prompt || null,
      data.audioSettings ? JSON.stringify(data.audioSettings) : null,
      data.isInstrumental ? 1 : 0,
      data.originalFilePath || null,
      data.processedFilePath || null,
      data.durationSeconds || null,
      data.sampleRate || null,
      data.bitrate || null,
      data.format || null
    );
    
    return this.findById(id);
  },
  
  findById(id) {
    const row = db.prepare('SELECT * FROM music_generations WHERE id = ?').get(id);
    if (row && row.audio_settings) {
      row.audio_settings = JSON.parse(row.audio_settings);
    }
    if (row) {
      row.is_instrumental = Boolean(row.is_instrumental);
    }
    return row;
  },
  
  findByProject(projectId) {
    const rows = db.prepare('SELECT * FROM music_generations WHERE project_id = ? ORDER BY version DESC').all(projectId);
    return rows.map(row => {
      if (row.audio_settings) row.audio_settings = JSON.parse(row.audio_settings);
      row.is_instrumental = Boolean(row.is_instrumental);
      return row;
    });
  },
  
  update(id, data) {
    const updates = [];
    const values = [];
    
    if (data.originalFilePath !== undefined) {
      updates.push('original_file_path = ?');
      values.push(data.originalFilePath);
    }
    if (data.processedFilePath !== undefined) {
      updates.push('processed_file_path = ?');
      values.push(data.processedFilePath);
    }
    if (data.durationSeconds !== undefined) {
      updates.push('duration_seconds = ?');
      values.push(data.durationSeconds);
    }
    if (data.bitrate !== undefined) {
      updates.push('bitrate = ?');
      values.push(data.bitrate);
    }
    
    values.push(id);
    const stmt = db.prepare(`UPDATE music_generations SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    return this.findById(id);
  },
  
  getNextVersion(projectId) {
    const result = db.prepare('SELECT MAX(version) as max_version FROM music_generations WHERE project_id = ?').get(projectId);
    return (result?.max_version || 0) + 1;
  },
};
```

- [ ] **Step 10: Run test to verify it passes**

```bash
cd backend
node --test tests/database/connection.test.js
```

Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add backend/src/database/ backend/tests/database/
git commit -m "feat: add database setup with migrations and models"
```

---

## Task 4: MiniMax API Client

**Files:**
- Create: `backend/src/utils/minimax.client.js`
- Create: `backend/tests/utils/minimax.client.test.js`

- [ ] **Step 1: Write failing test for MiniMax client**

```javascript
// backend/tests/utils/minimax.client.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import MinimaxClient from '../../src/utils/minimax.client.js';

test('should create client with API key', () => {
  const client = new MinimaxClient('test-key');
  assert.ok(client);
  assert.strictEqual(client.apiKey, 'test-key');
});

test('should build request headers', () => {
  const client = new MinimaxClient('test-key');
  const headers = client.getHeaders();
  assert.strictEqual(headers.Authorization, 'Bearer test-key');
  assert.strictEqual(headers['Content-Type'], 'application/json');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
node --test tests/utils/minimax.client.test.js
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement MiniMax client**

```javascript
// backend/src/utils/minimax.client.js
import axios from 'axios';
import logger from './logger.js';

class MinimaxClient {
  constructor(apiKey, baseURL = 'https://api.minimax.io') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }
  
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
  
  async request(endpoint, method = 'POST', data = null) {
    const url = `${this.baseURL}${endpoint}`;
    
    logger.info(`MiniMax API request: ${method} ${endpoint}`);
    
    try {
      const response = await axios({
        method,
        url,
        headers: this.getHeaders(),
        data,
      });
      
      logger.info(`MiniMax API response: ${response.status}`);
      return response.data;
    } catch (error) {
      logger.error('MiniMax API error:', {
        endpoint,
        status: error.response?.status,
        message: error.response?.data || error.message,
      });
      throw this.handleError(error);
    }
  }
  
  handleError(error) {
    const status = error.response?.data?.base_resp?.status_code;
    const message = error.response?.data?.base_resp?.status_msg || error.message;
    
    const errorMap = {
      0: 'Success',
      1002: 'Rate limit exceeded',
      1004: 'Authentication failed',
      1008: 'Insufficient balance',
      1026: 'Content flagged as sensitive',
      2013: 'Invalid parameters',
      2049: 'Invalid API key',
    };
    
    const errorMessage = errorMap[status] || message;
    const err = new Error(errorMessage);
    err.statusCode = status;
    err.originalError = error;
    
    return err;
  }
  
  // Lyrics Generation API
  async generateLyrics(params) {
    return this.request('/v1/lyrics_generation', 'POST', params);
  }
  
  // Music Generation API
  async generateMusic(params) {
    return this.request('/v1/music_generation', 'POST', params);
  }
  
  // Video Generation API (async)
  async generateVideo(params) {
    return this.request('/v1/video_generation', 'POST', params);
  }
  
  async queryVideoStatus(taskId) {
    return this.request(`/v1/query/video_generation?task_id=${taskId}`, 'GET');
  }
  
  async retrieveFile(fileId) {
    return this.request(`/v1/files/retrieve?file_id=${fileId}`, 'GET');
  }
}

export default MinimaxClient;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend
node --test tests/utils/minimax.client.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/minimax.client.js backend/tests/utils/
git commit -m "feat: add MiniMax API client with error handling"
```

---

## Task 5: Storage Utility

**Files:**
- Create: `backend/src/utils/storage.util.js`
- Create: `backend/tests/utils/storage.util.test.js`

- [ ] **Step 1: Write failing test for storage utility**

```javascript
// backend/tests/utils/storage.util.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import storage from '../../src/utils/storage.util.js';
import fs from 'fs';

test('should create project directory structure', () => {
  const projectId = 'test-project-123';
  storage.createProjectDirs(projectId);
  
  assert.ok(fs.existsSync(storage.getProjectDir(projectId)));
  assert.ok(fs.existsSync(storage.getLyricsDir(projectId)));
  assert.ok(fs.existsSync(storage.getMusicDir(projectId)));
  
  // Cleanup
  fs.rmSync(storage.getProjectDir(projectId), { recursive: true });
});

test('should generate file paths', () => {
  const projectId = 'proj-1';
  const lyricsPath = storage.getLyricsFilePath(projectId, 1);
  assert.ok(lyricsPath.includes('proj-1'));
  assert.ok(lyricsPath.includes('v1.json'));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
node --test tests/utils/storage.util.test.js
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement storage utility**

```javascript
// backend/src/utils/storage.util.js
import fs from 'fs';
import path from 'path';
import config from '../config/env.config.js';

class StorageUtil {
  constructor() {
    this.basePath = config.storage.path;
  }
  
  getProjectDir(projectId) {
    return path.join(this.basePath, 'projects', projectId);
  }
  
  getGenerationsDir(projectId) {
    return path.join(this.getProjectDir(projectId), 'generations');
  }
  
  getLyricsDir(projectId) {
    return path.join(this.getGenerationsDir(projectId), 'lyrics');
  }
  
  getMusicDir(projectId) {
    return path.join(this.getGenerationsDir(projectId), 'music');
  }
  
  getTempDir(projectId) {
    return path.join(this.getProjectDir(projectId), 'temp');
  }
  
  createProjectDirs(projectId) {
    const dirs = [
      this.getLyricsDir(projectId),
      this.getMusicDir(projectId),
      this.getTempDir(projectId),
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
  
  getLyricsFilePath(projectId, version) {
    return path.join(this.getLyricsDir(projectId), `v${version}.json`);
  }
  
  getMusicFilePath(projectId, version, type = 'processed') {
    const filename = type === 'original' ? `v${version}-original.mp3` : `v${version}-processed.mp3`;
    return path.join(this.getMusicDir(projectId), filename);
  }
  
  getTempFilePath(projectId, filename) {
    return path.join(this.getTempDir(projectId), filename);
  }
  
  saveLyrics(projectId, version, data) {
    const filePath = this.getLyricsFilePath(projectId, version);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }
  
  saveAudioFile(buffer, filePath) {
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }
  
  readFile(filePath) {
    return fs.readFileSync(filePath);
  }
  
  deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

const storage = new StorageUtil();
export default storage;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend
node --test tests/utils/storage.util.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/storage.util.js backend/tests/utils/storage.util.test.js
git commit -m "feat: add storage utility for file management"
```

---

## Task 6: Lyrics Module

**Files:**
- Create: `backend/src/modules/lyrics/presets.js`
- Create: `backend/src/modules/lyrics/lyrics.service.js`
- Create: `backend/src/modules/lyrics/lyrics.controller.js`
- Create: `backend/tests/modules/lyrics.service.test.js`

- [ ] **Step 1: Create style presets**

```javascript
// backend/src/modules/lyrics/presets.js
export const STYLE_PRESETS = {
  'hinglish-urban': {
    name: 'Hinglish Urban',
    description: 'Hindi-English mix, modern trap/drill beats, urban Indian sound',
    promptTemplate: 'Modern urban Hinglish hip-hop with trap/drill influence, mixing Hindi and English, street style, catchy hooks,',
    languages: ['Hindi', 'English'],
    mood: 'confident, energetic, rebellious',
  },
  'hindi-urdu-classical': {
    name: 'Hindi-Urdu Classical',
    description: 'Ghazal-inspired, poetic, soulful',
    promptTemplate: 'Soulful Hindi-Urdu hip-hop with ghazal inspiration, poetic and emotional, deep lyrics, husky vocals,',
    languages: ['Hindi', 'Urdu'],
    mood: 'emotional, romantic, melancholic',
  },
  'punjabi-swagger': {
    name: 'Punjabi Swagger',
    description: 'Bhangra influence, Sidhu Moose Wala style',
    promptTemplate: 'Punjabi hip-hop with bhangra beats, swagger and confidence, Sidhu Moose Wala style, bold lyrics,',
    languages: ['Punjabi', 'English'],
    mood: 'bold, proud, energetic',
  },
  'regional-fusion': {
    name: 'Regional Fusion',
    description: 'Multi-language (Tamil, Telugu, Bengali + English)',
    promptTemplate: 'Regional Indian hip-hop fusion with Tamil/Telugu/Bengali influence, mixing local language with English, diverse cultural elements,',
    languages: ['Tamil', 'Telugu', 'Bengali', 'English'],
    mood: 'diverse, cultural, fusion',
  },
  'custom': {
    name: 'Custom',
    description: 'User-defined prompt',
    promptTemplate: '',
    languages: [],
    mood: '',
  },
};

export function getPreset(presetName) {
  return STYLE_PRESETS[presetName] || STYLE_PRESETS['custom'];
}

export function buildPrompt(presetName, userPrompt) {
  const preset = getPreset(presetName);
  if (presetName === 'custom') {
    return userPrompt;
  }
  return `${preset.promptTemplate} ${userPrompt}`;
}
```

- [ ] **Step 2: Write failing test for lyrics service**

```javascript
// backend/tests/modules/lyrics.service.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { LyricsService } from '../../src/modules/lyrics/lyrics.service.js';
import { ProjectModel } from '../../src/database/models/project.model.js';

test('should generate lyrics', async () => {
  const project = ProjectModel.create({ name: 'Test Project' });
  const lyricsService = new LyricsService();
  
  // This will call actual MiniMax API - skip in CI
  if (process.env.CI) return;
  
  const result = await lyricsService.generateLyrics({
    projectId: project.id,
    prompt: 'Viral desi rap about Mumbai streets',
    stylePreset: 'hinglish-urban',
  });
  
  assert.ok(result.id);
  assert.ok(result.content);
  assert.strictEqual(result.version, 1);
  
  // Cleanup
  ProjectModel.delete(project.id);
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend
node --test tests/modules/lyrics.service.test.js
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 4: Implement lyrics service**

```javascript
// backend/src/modules/lyrics/lyrics.service.js
import MinimaxClient from '../../utils/minimax.client.js';
import { LyricsModel } from '../../database/models/lyrics.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import config from '../../config/env.config.js';
import logger from '../../utils/logger.js';
import { buildPrompt } from './presets.js';

export class LyricsService {
  constructor() {
    this.client = new MinimaxClient(config.minimax.apiKey, config.minimax.baseURL);
  }
  
  async generateLyrics(params) {
    const { projectId, prompt, stylePreset = 'hinglish-urban', mode = 'write_full_song' } = params;
    
    logger.info('Generating lyrics', { projectId, stylePreset, mode });
    
    // Build full prompt with style preset
    const fullPrompt = buildPrompt(stylePreset, prompt);
    
    // Call MiniMax API
    const response = await this.client.generateLyrics({
      mode,
      prompt: fullPrompt,
    });
    
    // Parse response
    const { song_title, lyrics, style_tags } = response;
    
    // Parse structure tags from lyrics
    const structureTags = this.parseStructureTags(lyrics);
    
    // Get next version number
    const version = LyricsModel.getNextVersion(projectId);
    
    // Save to database
    const lyricsRecord = LyricsModel.create({
      projectId,
      version,
      prompt: fullPrompt,
      mode,
      stylePreset,
      content: lyrics,
      title: song_title,
      styleTags: style_tags,
      structureTags,
    });
    
    // Save to file
    storage.saveLyrics(projectId, version, {
      id: lyricsRecord.id,
      title: song_title,
      lyrics,
      styleTags: style_tags,
      structureTags,
      prompt: fullPrompt,
      createdAt: lyricsRecord.created_at,
    });
    
    // Increment project version
    ProjectModel.incrementVersion(projectId, 'lyrics');
    
    logger.info('Lyrics generated successfully', { lyricsId: lyricsRecord.id, version });
    
    return lyricsRecord;
  }
  
  parseStructureTags(lyrics) {
    const tagRegex = /\[(.*?)\]/g;
    const tags = [];
    let match;
    
    while ((match = tagRegex.exec(lyrics)) !== null) {
      const tag = match[1];
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
    
    return tags;
  }
  
  async getLyrics(lyricsId) {
    return LyricsModel.findById(lyricsId);
  }
  
  async getProjectLyrics(projectId) {
    return LyricsModel.findByProject(projectId);
  }
}
```

- [ ] **Step 5: Implement lyrics controller**

```javascript
// backend/src/modules/lyrics/lyrics.controller.js
import { LyricsService } from './lyrics.service.js';
import { STYLE_PRESETS } from './presets.js';
import logger from '../../utils/logger.js';

const lyricsService = new LyricsService();

export const LyricsController = {
  async generate(req, res, next) {
    try {
      const { projectId, prompt, stylePreset, mode } = req.body;
      
      if (!projectId || !prompt) {
        return res.status(400).json({
          error: 'projectId and prompt are required',
        });
      }
      
      const result = await lyricsService.generateLyrics({
        projectId,
        prompt,
        stylePreset,
        mode,
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Error generating lyrics:', error);
      next(error);
    }
  },
  
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const lyrics = await lyricsService.getLyrics(id);
      
      if (!lyrics) {
        return res.status(404).json({ error: 'Lyrics not found' });
      }
      
      res.json(lyrics);
    } catch (error) {
      next(error);
    }
  },
  
  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const lyrics = await lyricsService.getProjectLyrics(projectId);
      res.json(lyrics);
    } catch (error) {
      next(error);
    }
  },
  
  async getPresets(req, res) {
    res.json(STYLE_PRESETS);
  },
};
```

- [ ] **Step 6: Run test (skip if no API key)**

```bash
cd backend
node --test tests/modules/lyrics.service.test.js
```

Expected: PASS or SKIP (if CI environment)

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/lyrics/ backend/tests/modules/lyrics.service.test.js
git commit -m "feat: add lyrics generation module with style presets"
```

---

Due to length constraints, I'll provide Phase 1 plan in abbreviated form for remaining tasks. The pattern is established - each task follows TDD with exact code, tests, and commits.

**Remaining Tasks Overview:**

**Task 7: Music Module** - Service for MiniMax music generation, links to lyrics
**Task 8: FFmpeg Service** - Bitrate conversion 256kbps → 320kbps  
**Task 9: Queue System** - BullMQ setup, workers for lyrics/music/ffmpeg
**Task 10: API Routes** - Express routes for projects, lyrics, music, jobs
**Task 11: Error Middleware** - Centralized error handling
**Task 12: Server Setup** - Express server with CORS, routes
**Task 13: Frontend Bootstrap** - Vite + React + TypeScript setup
**Task 14: API Service** - Axios client for backend API
**Task 15: Studio Page** - Main UI for generating lyrics/music
**Task 16: Integration Test** - End-to-end workflow test
**Task 17: Docker Compose** - Redis + app containerization
**Task 18: Documentation** - README, SETUP guide

Each follows same pattern: test → implement → verify → commit.

---

## Execution

Plan saved. Choose execution approach:

**1. Subagent-Driven (recommended)** - Fresh subagent per task, review checkpoints  
**2. Inline Execution** - Execute in this session with batch checkpoints

Which?
