# Cloud Deployment + CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy RedInside Music Studio to cloud (Vercel + Railway + Turso + Upstash + R2 + Clerk) with zero-downtime CI/CD, invite-only auth, safe data migration, and proper GitFlow branching — no breaking changes to local dev.

**Architecture:** React/Vite on Vercel, Node.js on Railway, SQLite→Turso for DB, local→R2 for files, Upstash for Redis, Clerk for OAuth2 invite-only auth. Each service swaps independently behind the same interface so local dev stays unaffected.

**Tech Stack:** Clerk SDK, `@libsql/client`, `@aws-sdk/client-s3`, Railway CLI, Vercel CLI, GitHub Actions, Turso CLI, Upstash, Cloudflare R2

**Spec (source of truth):** `docs/superpowers/specs/2026-05-29-cloud-deployment-cicd-design.md`

---

## File Map

### New files
- `backend/scripts/migrate-to-r2.js` — 5-phase zero-loss R2 migration script
- `backend/scripts/verify-r2.js` — post-migration verification
- `backend/railway.toml` — Railway service configuration
- `frontend/vercel.json` — Vercel SPA routing config
- `.github/workflows/ci.yml` — **Replaces existing** CI with branch-conditional pipeline (already partially done)
- `.github/workflows/deploy.yml` — Separate deploy workflow triggered on main
- `docs/superpowers/plans/2026-05-29-cloud-deployment-cicd-plan.md` — this file

### Modified files
- `backend/src/database/connection.js` — swap `better-sqlite3` → `@libsql/client`
- `backend/src/utils/storage.util.js` — swap `fs.*` → `@aws-sdk/client-s3` for R2
- `backend/src/config/env.config.js` — add Turso, R2, Clerk, Redis URL env vars
- `frontend/src/App.tsx` — add `<ClerkProvider>`, login route `#/login`
- `frontend/src/main.tsx` — wrap with `<ClerkProvider>`
- `frontend/index.html` — no change needed (Clerk injects via SDK)
- `backend/src/server.js` — add Clerk JWT middleware on all `/api/*` routes; add `req.auth.userId` scoping
- `backend/src/database/migrations/021_user_id.sql` — `user_id` column on `projects` + `user_settings` table
- `frontend/src/contexts/WorkspaceContext.tsx` — attach Clerk JWT to all fetch calls

---

## Task 1: Git Branching Setup

**Files:**
- No code changes — GitHub Settings + local git commands only

- [ ] **Step 1: Create `develop` branch from `main`**

```bash
git checkout main
git pull origin main
git checkout -b develop
git push origin develop
```

Expected: `develop` branch exists on remote.

- [ ] **Step 2: Set branch protection on GitHub**

Go to: `GitHub → Settings → Branches → Add rule`

**Rule 1 — `main`:**
- Branch name pattern: `main`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass (add: `lint`, `backend-tests`, `frontend-tests`)
- ✅ Require 1 approving review
- ✅ Do not allow bypassing the above settings

**Rule 2 — `develop`:**
- Branch name pattern: `develop`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass (add: `lint`, `backend-tests`)
- No review required

**Rule 3 — `release/*`:**
- Branch name pattern: `release/*`
- ✅ Require status checks to pass
- No review required

- [ ] **Step 3: Commit this plan doc**

```bash
git add docs/superpowers/plans/2026-05-29-cloud-deployment-cicd-plan.md
git commit -m "docs: add cloud deployment implementation plan"
git push origin develop
```

---

## Task 2: Clerk Auth — SDK, Login Page, JWT Middleware, Multi-Tenancy DB

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/contexts/WorkspaceContext.tsx`
- Modify: `backend/src/server.js`
- Create: `backend/src/database/migrations/021_user_id.sql`
- Modify: `backend/src/config/env.config.js`

### 2a: Install Clerk SDKs

- [ ] **Step 1: Install frontend Clerk SDK**

```bash
cd frontend && npm install @clerk/clerk-react
```

- [ ] **Step 2: Install backend Clerk SDK**

```bash
cd backend && npm install @clerk/express
```

- [ ] **Step 3: Add Clerk env vars to `config/.env` (local dev)**

Add these lines to `config/.env` (get dev keys from Clerk Dashboard → API Keys):

```
CLERK_PUBLISHABLE_KEY=pk_test_your-key-here
CLERK_SECRET_KEY=sk_test_your-key-here
```

### 2b: Backend — Clerk JWT middleware

- [ ] **Step 4: Add Clerk config to `backend/src/config/env.config.js`**

Read `backend/src/config/env.config.js` first, then add to the `config` object:

```js
// Add to imports at top:
// (no new import needed — just env vars)

// Add to config object (after redis block):
clerk: {
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  secretKey: process.env.CLERK_SECRET_KEY || '',
},
```

- [ ] **Step 5: Add Clerk middleware to `backend/src/server.js`**

Read `backend/src/server.js` first. Add after existing imports and before the health check route:

```js
// Add to imports (top of file):
import { clerkMiddleware, requireAuth } from '@clerk/express';

// Add after app.use(express.urlencoded...) and before request logging middleware:
// Clerk auth — attach auth state to all requests
app.use(clerkMiddleware());

// Protect all /api/* routes (except /api/share/:token which is public)
app.use('/api', (req, res, next) => {
  // Public routes — no auth required
  if (req.path.startsWith('/share/')) return next();
  if (req.path === '/test/seed-project' || req.path.startsWith('/test/')) return next(); // CI test routes
  // All other /api routes require valid Clerk JWT
  return requireAuth()(req, res, next);
});
```

- [ ] **Step 6: Create migration `021_user_id.sql`**

Create `backend/src/database/migrations/021_user_id.sql`:

```sql
-- Add user_id to projects for multi-tenancy
-- Existing projects default to 'admin' (owner's local user)
ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL DEFAULT 'admin';

-- Per-user settings (BYOK MiniMax key — Phase 2)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id        TEXT PRIMARY KEY,
  minimax_key    TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 7: Run migration locally**

```bash
cd backend && npm run db:migrate
```

Expected: No error, migration 021 applied.

- [ ] **Step 8: Scope projects queries by user_id in `ProjectsController`**

Read `backend/src/api/routes/projects.routes.js`. In the `getAll` handler, scope by `req.auth?.userId`:

```js
// In ProjectsController.getAll:
getAll: async (req, res, next) => {
  try {
    const userId = req.auth?.userId || 'admin'; // fallback for local dev without Clerk
    const projects = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
    res.json(projects);
  } catch (err) { next(err); }
},

// In ProjectsController.create:
create: async (req, res, next) => {
  try {
    const userId = req.auth?.userId || 'admin';
    const { name } = req.body;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO projects (id, name, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, userId, now, now);
    storage.createProjectDirs(id);
    res.status(201).json({ id, name, user_id: userId, created_at: now, updated_at: now });
  } catch (err) { next(err); }
},
```

> Note: `getById`, `update`, `delete` should also verify `WHERE user_id = ?` using `req.auth?.userId || 'admin'` to prevent cross-user access.

### 2c: Frontend — ClerkProvider + Login page

- [ ] **Step 9: Wrap app in `<ClerkProvider>` in `frontend/src/main.tsx`**

Read `frontend/src/main.tsx` first. Add:

```tsx
import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 10: Add `VITE_CLERK_PUBLISHABLE_KEY` to frontend env**

Create `frontend/.env.local` (git-ignored):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-key-here
```

- [ ] **Step 11: Create `frontend/src/pages/Login.tsx`**

> **IMPORTANT:** After implementing this step, invoke the `frontend-design` skill to apply full polish: animations, micro-interactions, themed glass card, red social buttons, custom subtitle.

Create `frontend/src/pages/Login.tsx`:

```tsx
import { SignIn } from '@clerk/clerk-react';

export default function Login() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#08020a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Outfit', sans-serif",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke="#E63946" strokeWidth="2"/>
          <path d="M10 8L20 14L10 20V8Z" fill="#E63946"/>
        </svg>
        <span style={{ color: '#E63946', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>
          RedInside <span style={{ color: '#fff' }}>Studio</span>
        </span>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', marginBottom: '24px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Invite-only platform
      </p>

      <SignIn
        appearance={{
          variables: {
            colorBackground: 'rgba(18,6,22,0.85)',
            colorPrimary: '#E63946',
            colorText: '#ffffff',
            colorTextSecondary: 'rgba(255,255,255,0.5)',
            colorInputBackground: 'rgba(255,255,255,0.05)',
            colorInputText: '#ffffff',
            borderRadius: '12px',
            fontFamily: "'Outfit', sans-serif",
          },
          elements: {
            card: { border: '1px solid rgba(230,57,70,0.25)', boxShadow: '0 8px 40px rgba(230,57,70,0.08)', backdropFilter: 'blur(20px)' },
            headerTitle: { color: '#ffffff', fontWeight: 700 },
            socialButtonsBlockButton: { border: '1px solid rgba(230,57,70,0.3)', background: 'rgba(230,57,70,0.08)' },
            formButtonPrimary: { background: '#E63946', fontWeight: 700 },
            footerAction: { display: 'none' }, // hide "sign up" — invite only
          },
        }}
        routing="hash"
        signUpUrl="#/login"
      />
    </div>
  );
}
```

- [ ] **Step 12: Add `#/login` route to `frontend/src/App.tsx`**

Read `frontend/src/App.tsx`. Add login view to the state and hash routing:

```tsx
import { useAuth } from '@clerk/clerk-react';
import Login from './pages/Login';

// In App():
const { isSignedIn, isLoaded } = useAuth();

// In currentView state init:
const [currentView, setCurrentView] = useState<'studio' | 'history' | 'viral' | 'settings' | 'share' | 'login'>(() => {
  if (window.location.hash.startsWith('#/share/')) return 'share';
  if (window.location.hash === '#/login') return 'login';
  if (window.location.hash === '#/history') return 'history';
  if (window.location.hash === '#/viral') return 'viral';
  if (window.location.hash === '#/settings') return 'settings';
  return 'studio';
});

// Add to hashchange handler:
else if (hash === '#/login') setCurrentView('login');

// Add before existing view rendering:
if (!isLoaded) return null; // wait for Clerk to init

// Redirect to login if not signed in (except share pages — public)
if (!isSignedIn && currentView !== 'share' && currentView !== 'login') {
  window.location.hash = '#/login';
  return <Login />;
}

if (currentView === 'login') return <Login />;
```

- [ ] **Step 13: Attach Clerk JWT to all API calls in `frontend/src/contexts/WorkspaceContext.tsx`**

Read `WorkspaceContext.tsx`. Add a helper to get the auth token and attach it to all `fetch` calls:

```tsx
import { useAuth } from '@clerk/clerk-react';

// Inside WorkspaceProvider:
const { getToken } = useAuth();

// Helper used in all fetch calls:
const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
  const token = await getToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
  });
}, [getToken]);
```

Replace every `fetch(...)` call in `WorkspaceContext.tsx` with `authFetch(...)`.

- [ ] **Step 14: Verify auth flow locally**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173` → should redirect to login page → sign in with Google → redirects back to studio.

If no Clerk keys set, skip this test. Verify the app still loads without Clerk keys (fallback `|| 'admin'`).

- [ ] **Step 15: Commit**

```bash
git add backend/src/server.js backend/src/config/env.config.js \
        backend/src/database/migrations/021_user_id.sql \
        backend/src/api/routes/projects.routes.js \
        frontend/src/main.tsx frontend/src/App.tsx \
        frontend/src/pages/Login.tsx \
        frontend/src/contexts/WorkspaceContext.tsx \
        frontend/package.json frontend/package-lock.json \
        backend/package.json backend/package-lock.json
git commit -m "feat: add Clerk auth — OAuth2 login, JWT middleware, user_id multi-tenancy"
git push origin develop
```

---

## Task 3: Turso DB — Swap SQLite Driver

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/database/connection.js`
- Modify: `backend/src/config/env.config.js`

> **Why:** Turso uses `@libsql/client` which is API-compatible with better-sqlite3 for most operations, but async. The swap is contained to `connection.js` and the migrate script.

- [ ] **Step 1: Install `@libsql/client`**

```bash
cd backend && npm install @libsql/client
```

- [ ] **Step 2: Add Turso env vars to `backend/src/config/env.config.js`**

Read the file. Add to `config`:

```js
database: {
  // Local: file path. Cloud: turso URL + token.
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, '../../../database', path.basename(process.env.DATABASE_PATH || 'music-studio.sqlite'))}`,
  authToken: process.env.TURSO_AUTH_TOKEN || '',
},
```

Remove the old `database.path` key (replaced by `database.url`).

- [ ] **Step 3: Rewrite `backend/src/database/connection.js`**

```js
import { createClient } from '@libsql/client';
import config from '../config/env.config.js';
import logger from '../utils/logger.js';

const db = createClient({
  url: config.database.url,
  authToken: config.database.authToken || undefined,
});

// Enable foreign keys
await db.execute('PRAGMA foreign_keys = ON');

logger.info(`Database connected: ${config.database.url}`);

export default db;
```

> **Note:** `@libsql/client` is async. All `db.prepare(...).run(...)` calls must become `await db.execute(...)`. This is a broader refactor — see Step 4.

- [ ] **Step 4: Convert synchronous DB calls to async**

`@libsql/client` uses `db.execute(sql, args)` returning a Promise. The pattern change:

| Before (better-sqlite3) | After (@libsql/client) |
|---|---|
| `db.prepare('SELECT...').all(params)` | `(await db.execute({ sql: 'SELECT...', args: [params] })).rows` |
| `db.prepare('INSERT...').run(params)` | `await db.execute({ sql: 'INSERT...', args: [params] })` |
| `db.prepare('SELECT...').get(params)` | `(await db.execute({ sql: 'SELECT...', args: [params] })).rows[0]` |
| `db.transaction(fn)()` | Manual `BEGIN`/`COMMIT`/`ROLLBACK` with `db.execute` |

Files to update (all controllers and models use `db` directly):
- `backend/src/api/routes/projects.routes.js`
- `backend/src/modules/lyrics/lyrics.service.js`
- `backend/src/modules/music/music-tags.service.js`
- `backend/src/modules/music/music-notes.model.js`
- `backend/src/modules/playlist/playlist.model.js`
- `backend/src/modules/share/share.controller.js`
- `backend/src/modules/album/album.model.js`
- `backend/src/modules/audio/social-export.controller.js`
- Any other file importing `db` — run: `grep -r "from.*database/connection" backend/src`

For each file, add `async` to route handlers and `await` to all db calls.

Example conversion (projects.routes.js `getAll`):
```js
// Before:
getAll: (req, res, next) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  res.json(projects);
},

// After:
getAll: async (req, res, next) => {
  try {
    const userId = req.auth?.userId || 'admin';
    const result = await db.execute({ sql: 'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC', args: [userId] });
    res.json(result.rows);
  } catch (err) { next(err); }
},
```

- [ ] **Step 5: Update `backend/src/database/migrate.js`**

Read the current migrate.js. Update to use `@libsql/client`:

```js
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_DATABASE_URL ||
  `file:${path.join(__dirname, '../../database/music-studio.sqlite')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({ url, authToken });

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  // Split on ; to run each statement separately (libsql limitation)
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await db.execute(stmt);
  }
  console.log(`✓ ${file}`);
}

console.log('Migration complete');
process.exit(0);
```

- [ ] **Step 6: Run backend tests to verify no regression**

```bash
cd backend && npm test
```

Expected: All tests pass. If any fail due to async conversion, fix the specific controller.

- [ ] **Step 7: Commit**

```bash
git add backend/src/database/connection.js backend/src/database/migrate.js \
        backend/src/config/env.config.js backend/package.json backend/package-lock.json \
        backend/src/api/routes/projects.routes.js \
        backend/src/modules/
git commit -m "feat: swap better-sqlite3 → @libsql/client for Turso cloud DB"
git push origin develop
```

---

## Task 4: Cloudflare R2 Storage — Adapter Swap + Migration Script

**Files:**
- Modify: `backend/src/utils/storage.util.js`
- Modify: `backend/src/config/env.config.js`
- Create: `backend/scripts/migrate-to-r2.js`

### 4a: R2 Storage Adapter

- [ ] **Step 1: Install AWS S3 SDK (R2 is S3-compatible)**

```bash
cd backend && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Add R2 env vars to `backend/src/config/env.config.js`**

```js
r2: {
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucketName: process.env.R2_BUCKET_NAME || '',
  endpoint: process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : '',
},
storage: {
  // 'local' (default) or 'r2'
  driver: process.env.STORAGE_DRIVER || 'local',
  path: process.env.STORAGE_PATH || '/Users/admin/Music/RedInside-Storage',
},
```

- [ ] **Step 3: Rewrite `backend/src/utils/storage.util.js`**

Keep the exact same public interface. Internals swap based on `config.storage.driver`:

```js
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/env.config.js';

// R2 client (lazy init — only created if driver === 'r2')
let s3Client = null;
function getS3() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return s3Client;
}

class StorageUtil {
  constructor() {
    this.basePath = config.storage.path;
    this.driver = config.storage.driver;
    this.bucket = config.r2?.bucketName || '';
  }

  // --- Path helpers (same as before) ---

  validateProjectId(projectId) {
    if (!projectId || typeof projectId !== 'string') throw new Error('projectId must be a non-empty string');
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('projectId contains invalid characters');
    if (projectId.includes('..') || projectId.includes('/') || projectId.includes('\\')) throw new Error('projectId cannot contain path separators');
    return projectId;
  }

  validateFilename(filename) {
    if (!filename || typeof filename !== 'string') throw new Error('filename must be a non-empty string');
    const safe = path.basename(filename);
    if (safe !== filename || safe.includes('..')) throw new Error('Invalid filename');
    return safe;
  }

  getProjectDir(projectId) { return `projects/${this.validateProjectId(projectId)}`; }
  getGenerationsDir(projectId) { return `${this.getProjectDir(projectId)}/generations`; }
  getLyricsDir(projectId) { return `${this.getGenerationsDir(projectId)}/lyrics`; }
  getMusicDir(projectId) { return `${this.getGenerationsDir(projectId)}/music`; }
  getMedleyDir(projectId) { return `${this.getGenerationsDir(projectId)}/medley`; }
  getVideoDir(projectId) { return `${this.getGenerationsDir(projectId)}/video`; }
  getArtworkDir(projectId) { return `${this.getProjectDir(projectId)}/artwork`; }
  getUploadDir(projectId) { return `${this.getProjectDir(projectId)}/uploads`; }
  getTempDir(projectId) { return `${this.getProjectDir(projectId)}/temp`; }
  getMastersDir(projectId) { return `${this.getProjectDir(projectId)}/masters`; }

  getMusicFilePath(projectId, version, type = 'processed') {
    const filename = type === 'original' ? `v${version}-original.mp3` : `v${version}-processed.mp3`;
    return `${this.getMusicDir(projectId)}/${filename}`;
  }
  getLyricsFilePath(projectId, version) { return `${this.getLyricsDir(projectId)}/v${version}.json`; }
  getMedleyFilePath(projectId, medleyId) { return `${this.getMedleyDir(projectId)}/medley-${medleyId}.mp3`; }
  getVideoFilePath(projectId, version) { return `${this.getVideoDir(projectId)}/v${version}.mp4`; }
  getArtworkFilePath(projectId, filename) { return `${this.getArtworkDir(projectId)}/${filename}`; }
  getTempFilePath(projectId, filename) { return `${this.getTempDir(projectId)}/${this.validateFilename(filename)}`; }

  // --- Core I/O (driver-aware) ---

  // Create local dirs (no-op for R2)
  createProjectDirs(projectId) {
    if (this.driver === 'r2') return; // R2 has no directories
    this.validateProjectId(projectId);
    const dirs = [this.getLyricsDir(projectId), this.getMusicDir(projectId), this.getMedleyDir(projectId),
      this.getVideoDir(projectId), this.getTempDir(projectId), this.getArtworkDir(projectId),
      this.getUploadDir(projectId), this.getMastersDir(projectId)]
      .map(k => path.join(this.basePath, k));
    for (const dir of dirs) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
  }

  // Returns full local path (local driver) or R2 key (r2 driver)
  _localPath(key) { return path.join(this.basePath, key); }

  async saveAudioFile(buffer, keyOrPath) {
    if (this.driver === 'r2') {
      await getS3().send(new PutObjectCommand({ Bucket: this.bucket, Key: keyOrPath, Body: buffer, ContentType: 'audio/mpeg' }));
      return keyOrPath;
    }
    const fullPath = this._localPath(keyOrPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }

  async readFile(keyOrPath) {
    if (this.driver === 'r2') {
      const res = await getS3().send(new GetObjectCommand({ Bucket: this.bucket, Key: keyOrPath }));
      const chunks = [];
      for await (const chunk of res.Body) chunks.push(chunk);
      return Buffer.concat(chunks);
    }
    return fs.readFileSync(this._localPath(keyOrPath));
  }

  async deleteFile(keyOrPath) {
    if (this.driver === 'r2') {
      await getS3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: keyOrPath }));
      return;
    }
    const fullPath = this._localPath(keyOrPath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }

  async saveLyrics(projectId, version, data) {
    const key = this.getLyricsFilePath(projectId, version);
    const buf = Buffer.from(JSON.stringify(data, null, 2));
    if (this.driver === 'r2') {
      await getS3().send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buf, ContentType: 'application/json' }));
      return key;
    }
    const fullPath = this._localPath(key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buf);
    return fullPath;
  }

  // Generate presigned URL for direct R2 streaming (15min expiry)
  async getPresignedUrl(key, expiresIn = 900) {
    if (this.driver !== 'r2') throw new Error('getPresignedUrl only for R2 driver');
    return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  // Upload artwork (PNG data URI)
  async saveArtwork(key, buffer, contentType = 'image/png') {
    if (this.driver === 'r2') {
      await getS3().send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }));
      return key;
    }
    const fullPath = this._localPath(key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }
}

const storage = new StorageUtil();
export default storage;
```

- [ ] **Step 4: Update audio streaming endpoint to use presigned URL**

Read `backend/src/api/routes/music.routes.js`. Update the `GET /api/music/:id/file` handler:

```js
// GET /api/music/:id/file — serve audio file
router.get('/:id/file', async (req, res, next) => {
  try {
    const track = await db.execute({ sql: 'SELECT * FROM music_generations WHERE id = ?', args: [req.params.id] });
    const row = track.rows[0];
    if (!row) return res.status(404).json({ error: 'Track not found' });

    const filePath = row.processed_file_path || row.original_file_path;

    if (storage.driver === 'r2') {
      // Generate presigned URL → 302 redirect → browser streams direct from R2
      const url = await storage.getPresignedUrl(filePath);
      return res.redirect(302, url);
    }

    // Local: stream file directly
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', 'audio/mpeg');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});
```

### 4b: R2 Migration Script

- [ ] **Step 5: Create `backend/scripts/migrate-to-r2.js`**

```js
#!/usr/bin/env node
/**
 * Zero-loss R2 migration — 5 phases:
 * 1. COPY   — upload local files to R2 (no deletes, no DB changes)
 * 2. VERIFY — MD5 checksum local vs R2 ETag
 * 3. UPDATE — atomic DB transaction to swap paths
 * 4. FINAL  — fetch each R2 path, verify 200
 * 5. ARCHIVE — rename local storage dir (never delete)
 *
 * Run: node backend/scripts/migrate-to-r2.js
 * Env needed: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *             DATABASE_PATH (optional, defaults to database/music-studio.sqlite)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@libsql/client';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BUCKET = process.env.R2_BUCKET_NAME;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

const LOCAL_STORAGE = process.env.STORAGE_PATH || '/Users/admin/Music/RedInside-Storage';
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../database/music-studio.sqlite');
const db = createClient({ url: `file:${DB_PATH}` });

// Map absolute local path → R2 key
function localToR2Key(localPath) {
  // /Users/admin/Music/RedInside-Storage/projects/abc/generations/music/v1-processed.mp3
  // → projects/abc/generations/music/v1-processed.mp3
  const rel = path.relative(LOCAL_STORAGE, localPath);
  return rel.replace(/\\/g, '/');
}

async function phase1Copy(files) {
  console.log('\n=== PHASE 1: COPY ===');
  const results = [];
  for (const { localPath, r2Key } of files) {
    if (!fs.existsSync(localPath)) { console.log(`  ✗ MISSING: ${localPath}`); results.push({ ok: false, localPath, r2Key }); continue; }
    const body = fs.readFileSync(localPath);
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: r2Key, Body: body }));
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: r2Key }));
    const sizeMatch = head.ContentLength === body.length;
    if (!sizeMatch) { console.log(`  ✗ SIZE MISMATCH: ${r2Key}`); results.push({ ok: false, localPath, r2Key }); continue; }
    console.log(`  ✓ ${r2Key}`);
    results.push({ ok: true, localPath, r2Key, localSize: body.length });
  }
  return results;
}

async function phase2Verify(files) {
  console.log('\n=== PHASE 2: VERIFY (checksums) ===');
  for (const { localPath, r2Key } of files) {
    if (!fs.existsSync(localPath)) { console.log(`  ✗ MISSING LOCAL: ${localPath}`); throw new Error('Phase 2 failed'); }
    const localMd5 = createHash('md5').update(fs.readFileSync(localPath)).digest('hex');
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: r2Key }));
    const r2Etag = head.ETag?.replace(/"/g, '');
    if (localMd5 !== r2Etag) { console.log(`  ✗ CHECKSUM MISMATCH: ${r2Key} (local=${localMd5} r2=${r2Etag})`); throw new Error('Phase 2 failed — checksum mismatch'); }
    console.log(`  ✓ ${r2Key}`);
  }
}

async function phase3UpdateDB(updates) {
  console.log('\n=== PHASE 3: UPDATE DB ===');
  await db.execute('BEGIN');
  try {
    for (const { table, col, id, r2Key } of updates) {
      await db.execute({ sql: `UPDATE ${table} SET ${col} = ? WHERE id = ?`, args: [r2Key, id] });
    }
    await db.execute('COMMIT');
    console.log(`  ✓ Updated ${updates.length} rows`);
  } catch (err) {
    await db.execute('ROLLBACK');
    throw new Error(`Phase 3 ROLLBACK: ${err.message}`);
  }
}

async function phase4FinalVerify(files) {
  console.log('\n=== PHASE 4: FINAL VERIFY ===');
  for (const { r2Key } of files) {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: r2Key }));
    if (!head.ContentLength) { throw new Error(`Phase 4 failed — ${r2Key} not accessible`); }
    console.log(`  ✓ ${r2Key} (${head.ContentLength} bytes)`);
  }
}

async function phase5Archive() {
  console.log('\n=== PHASE 5: ARCHIVE LOCAL ===');
  const backupPath = `${LOCAL_STORAGE}-backup-${new Date().toISOString().slice(0, 10)}`;
  fs.renameSync(LOCAL_STORAGE, backupPath);
  console.log(`  ✓ Archived to: ${backupPath}`);
  console.log('  Keep for 30 days, then delete manually.');
}

async function main() {
  console.log('RedInside → R2 Migration');
  console.log(`Bucket: ${BUCKET}, Local: ${LOCAL_STORAGE}`);

  // Collect all file paths from DB
  const music = (await db.execute('SELECT id, original_file_path, processed_file_path FROM music_generations')).rows;
  const medley = (await db.execute('SELECT id, output_file_path FROM medleys')).rows;
  const albums = (await db.execute('SELECT id, artwork_path FROM albums WHERE artwork_path IS NOT NULL')).rows;

  const filePairs = [];
  const dbUpdates = [];

  for (const row of music) {
    if (row.original_file_path) {
      const r2Key = localToR2Key(row.original_file_path);
      filePairs.push({ localPath: row.original_file_path, r2Key });
      dbUpdates.push({ table: 'music_generations', col: 'original_file_path', id: row.id, r2Key });
    }
    if (row.processed_file_path) {
      const r2Key = localToR2Key(row.processed_file_path);
      filePairs.push({ localPath: row.processed_file_path, r2Key });
      dbUpdates.push({ table: 'music_generations', col: 'processed_file_path', id: row.id, r2Key });
    }
  }
  for (const row of medley) {
    if (row.output_file_path) {
      const r2Key = localToR2Key(row.output_file_path);
      filePairs.push({ localPath: row.output_file_path, r2Key });
      dbUpdates.push({ table: 'medleys', col: 'output_file_path', id: row.id, r2Key });
    }
  }
  for (const row of albums) {
    if (row.artwork_path) {
      const r2Key = localToR2Key(row.artwork_path);
      filePairs.push({ localPath: row.artwork_path, r2Key });
      dbUpdates.push({ table: 'albums', col: 'artwork_path', id: row.id, r2Key });
    }
  }

  console.log(`\nFiles to migrate: ${filePairs.length}`);
  console.log(`DB rows to update: ${dbUpdates.length}`);

  const p1 = await phase1Copy(filePairs);
  const failed = p1.filter(r => !r.ok);
  if (failed.length > 0) { console.error(`\nPHASE 1 FAILED: ${failed.length} files. Fix and retry.`); process.exit(1); }

  await phase2Verify(filePairs);
  await phase3UpdateDB(dbUpdates);
  await phase4FinalVerify(filePairs);
  await phase5Archive();

  console.log('\n✓ MIGRATION COMPLETE — switch STORAGE_DRIVER=r2 in config');
}

main().catch(err => { console.error('\nMIGRATION FAILED:', err.message); process.exit(1); });
```

- [ ] **Step 6: Test the adapter locally (dry run)**

Without R2 credentials, verify the local driver still works:

```bash
cd backend && npm test
```

Expected: All tests pass (no R2 calls in test mode, `STORAGE_DRIVER` defaults to `local`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/utils/storage.util.js backend/src/config/env.config.js \
        backend/scripts/migrate-to-r2.js \
        backend/package.json backend/package-lock.json
git commit -m "feat: R2 storage adapter (local/r2 driver) + zero-loss migration script"
git push origin develop
```

---

## Task 5: Upstash Redis — Swap Redis Connection

**Files:**
- Modify: `backend/src/config/env.config.js`
- Modify: `backend/src/queue/` (BullMQ connection config)

> Upstash provides a Redis-compatible REST API. BullMQ supports it via `@upstash/redis` + `@upstash/ratelimit`, but the easiest path is using `ioredis` with the Upstash TLS URL.

- [ ] **Step 1: Add Upstash env vars**

Add to `config/.env` (local, for testing; in prod these come from GitHub Secrets → Railway):

```
UPSTASH_REDIS_URL=rediss://default:your-token@your-host.upstash.io:6379
```

- [ ] **Step 2: Update `backend/src/config/env.config.js`**

Read the file, update redis config:

```js
redis: {
  // Upstash: use full URL. Local: use host/port.
  url: process.env.UPSTASH_REDIS_URL || null,
  host: process.env.REDIS_HOST || 'localhost',
  port: parsePort(process.env.REDIS_PORT, '6379'),
},
```

- [ ] **Step 3: Find BullMQ connection setup**

```bash
grep -r "new Redis\|createClient\|ioredis\|BullMQ\|Queue\|Worker" backend/src/queue/ | head -30
```

Read the queue connection file (likely `backend/src/queue/connection.js` or similar).

- [ ] **Step 4: Update queue connection to use Upstash URL when set**

```js
import Redis from 'ioredis';
import config from '../config/env.config.js';

const connection = config.redis.url
  ? new Redis(config.redis.url, { tls: {}, maxRetriesPerRequest: null })
  : new Redis({ host: config.redis.host, port: config.redis.port, maxRetriesPerRequest: null });

export default connection;
```

- [ ] **Step 5: Run backend tests**

```bash
cd backend && npm test
```

Expected: All pass (local Redis used in CI; Upstash URL only set in prod).

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/env.config.js backend/src/queue/
git commit -m "feat: support Upstash Redis URL for cloud BullMQ queue"
git push origin develop
```

---

## Task 6: Railway Backend Deploy

**Files:**
- Create: `backend/railway.toml`
- No code changes — Railway reads from env vars

- [ ] **Step 1: Install Railway CLI**

```bash
npm install -g @railway/cli
railway login
```

- [ ] **Step 2: Create `backend/railway.toml`**

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm ci"

[deploy]
startCommand = "node src/server.js"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[services]]
name = "redinside-backend"
```

- [ ] **Step 3: Create Railway project**

```bash
cd backend
railway init --name redinside-backend
```

- [ ] **Step 4: Set Railway env vars**

In Railway Dashboard → Service → Variables, add all secrets from the spec:

```
NODE_ENV=production
PORT=3000
CLERK_SECRET_KEY=sk_live_...
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=...
UPSTASH_REDIS_URL=rediss://...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=redinside-studio
STORAGE_DRIVER=r2
MINIMAX_API_KEY=...
MINIMAX_BASE_URL=https://api.minimax.io
```

- [ ] **Step 5: Add `RAILWAY_TOKEN` to GitHub Secrets**

GitHub → repo → Settings → Secrets and variables → Actions → New secret:
- Name: `RAILWAY_TOKEN`
- Value: (from Railway Dashboard → Account → Tokens)

- [ ] **Step 6: Deploy backend manually to verify**

```bash
cd backend && railway up
```

Wait for deploy. Check logs:
```bash
railway logs
```

Expected: `Server running on port 3000`, `Database connected`.

- [ ] **Step 7: Test health endpoint**

```bash
curl https://your-service.up.railway.app/health
```

Expected: `{"status":"ok","minimax":"real",...}`

- [ ] **Step 8: Commit**

```bash
git add backend/railway.toml
git commit -m "feat: add Railway deploy config (healthcheck, start command)"
git push origin develop
```

---

## Task 7: Vercel Frontend Deploy

**Files:**
- Create: `frontend/vercel.json`
- No code changes — Vercel reads env vars from dashboard

- [ ] **Step 1: Install Vercel CLI**

```bash
npm install -g vercel
vercel login
```

- [ ] **Step 2: Create `frontend/vercel.json`**

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "env": {
    "VITE_API_BASE_URL": "@vite_api_base_url",
    "VITE_CLERK_PUBLISHABLE_KEY": "@vite_clerk_publishable_key"
  }
}
```

> The rewrites ensure hash router works after Vercel deploy (all paths serve `index.html`).

- [ ] **Step 3: Update `frontend/src/contexts/WorkspaceContext.tsx` API base URL**

The frontend currently uses relative paths (`/api/...`) which only work when frontend and backend are on the same origin. For cloud deploy, we need to prefix with the Railway URL.

Add to `frontend/.env.local`:
```
VITE_API_BASE_URL=http://localhost:3000
```

Add to Vercel Dashboard env vars:
```
VITE_API_BASE_URL=https://your-service.up.railway.app
```

In `WorkspaceContext.tsx`, update the `authFetch` helper:

```tsx
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Update all fetch paths from '/api/...' to `${API_BASE}/api/...`
```

> Also update `PlayerBar.tsx`, `SoundsTab.tsx`, and any other file that directly `fetch('/api/...')`.

Run:
```bash
grep -r "fetch('/api\|fetch(\`/api" frontend/src/ --include="*.tsx" --include="*.ts" -l
```

Update each file to prefix with `API_BASE`.

- [ ] **Step 4: Deploy frontend to Vercel**

```bash
cd frontend && vercel --prod
```

Follow prompts. Link to existing project or create new.

- [ ] **Step 5: Set Vercel env vars**

```bash
vercel env add VITE_CLERK_PUBLISHABLE_KEY production
vercel env add VITE_API_BASE_URL production
```

Or set in Vercel Dashboard → Project → Settings → Environment Variables.

- [ ] **Step 6: Store Vercel secrets for GitHub Actions**

From `vercel --token` output, or Vercel Dashboard:

Add to GitHub Secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID` (from `.vercel/project.json` after link)
- `VERCEL_PROJECT_ID` (from `.vercel/project.json`)

- [ ] **Step 7: Verify Vercel deploy**

Open Vercel deployment URL → should show login page → sign in → studio loads → can see projects.

- [ ] **Step 8: Commit**

```bash
git add frontend/vercel.json frontend/src/contexts/WorkspaceContext.tsx
# also add any other files updated with API_BASE
git commit -m "feat: Vercel deploy config + API_BASE URL for cloud frontend"
git push origin develop
```

---

## Task 8: GitHub Actions Full CI/CD Pipeline

**Files:**
- Modify: `.github/workflows/ci.yml` — add branch-conditional jobs
- Create: `.github/workflows/deploy.yml` — deploy pipeline for main

> The existing `ci.yml` covers lint + backend-tests + frontend-tests. This task extends it with deploy jobs gated by branch.

- [ ] **Step 1: Rewrite `.github/workflows/ci.yml`**

Read the current `.github/workflows/ci.yml` first. Replace entirely:

```yaml
name: CI

on:
  push:
    branches: [main, develop, 'release/**', 'hotfix/**', 'feature/**']
  pull_request:
    branches: [main, develop, 'release/**']

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npx tsc --noEmit
      - run: cd frontend && npm run lint

  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      CI: true
      NODE_ENV: test
      MINIMAX_BASE_URL: http://localhost:8999
      MINIMAX_API_KEY: test-key-ci
      PORT: 3000
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: cd backend && npm ci
      - run: sudo apt-get update && sudo apt-get install -y ffmpeg
      - run: |
          sudo apt-get install -y redis-server
          redis-server --daemonize yes
          redis-cli ping
      - run: node backend/tests/minimax-mock-server.js &
      - run: npx wait-on http://localhost:8999/health --timeout 10000 || true
      - run: cd backend && node src/server.js &
      - run: npx wait-on http://localhost:3000/health --timeout 15000
      - run: cd backend && npm test

  frontend-tests:
    name: Frontend E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    # Only run on develop, release/*, main — skip for feature/* to save time
    if: |
      github.ref == 'refs/heads/develop' ||
      github.ref == 'refs/heads/main' ||
      startsWith(github.ref, 'refs/heads/release/') ||
      github.base_ref == 'develop' ||
      github.base_ref == 'main'
    env:
      CI: true
      NODE_ENV: test
      MINIMAX_BASE_URL: http://localhost:8999
      MINIMAX_API_KEY: test-key-ci
      PORT: 3000
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: sudo apt-get update && sudo apt-get install -y ffmpeg redis-server
      - run: redis-server --daemonize yes
      - run: cd backend && npm ci
      - run: cd frontend && npm ci
      - run: cd frontend && npx playwright install --with-deps chromium
      - run: cd frontend && npm run build
      - run: cd frontend && npx playwright test
        env:
          VITE_API_BASE_URL: http://localhost:3000
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]

# Require CI to pass first
concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy-backend:
    name: Deploy Backend → Railway
    runs-on: ubuntu-latest
    needs: [] # CI workflow runs separately; deploy triggers only on main push after CI passes via branch protection
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      - name: Deploy to Railway
        run: railway up --service redinside-backend --detach
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      - name: Wait for Railway health check
        run: |
          for i in $(seq 1 12); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ secrets.RAILWAY_BACKEND_URL }}/health)
            if [ "$STATUS" = "200" ]; then echo "✓ Backend healthy"; exit 0; fi
            echo "Attempt $i: status $STATUS — waiting 10s..."; sleep 10
          done
          echo "✗ Backend failed to start"; exit 1

  db-migrate:
    name: Run DB Migrations
    runs-on: ubuntu-latest
    needs: [deploy-backend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: cd backend && npm ci
      - name: Run migrations
        run: node backend/src/database/migrate.js
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}

  deploy-frontend:
    name: Deploy Frontend → Vercel
    runs-on: ubuntu-latest
    needs: [deploy-backend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
        env:
          VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY }}
          VITE_API_BASE_URL: ${{ secrets.RAILWAY_BACKEND_URL }}
      - name: Deploy to Vercel (production)
        run: |
          npm install -g vercel
          vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }} \
            --scope=${{ secrets.VERCEL_ORG_ID }} \
            frontend/
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

  tag-release:
    name: Tag Release
    runs-on: ubuntu-latest
    needs: [deploy-frontend, db-migrate]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Get version from package.json
        id: pkg
        run: echo "version=$(node -p "require('./frontend/package.json').version")" >> $GITHUB_OUTPUT
      - name: Create git tag
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          TAG="v${{ steps.pkg.outputs.version }}-$(date +%Y%m%d%H%M)"
          git tag $TAG
          git push origin $TAG
          echo "Tagged: $TAG"
```

- [ ] **Step 3: Add all required GitHub Secrets**

GitHub → repo → Settings → Secrets → Actions → New secret. Add each:

```
CLERK_SECRET_KEY           sk_live_...
CLERK_PUBLISHABLE_KEY      pk_live_...
TURSO_DATABASE_URL         libsql://your-db.turso.io
TURSO_AUTH_TOKEN           ...
UPSTASH_REDIS_URL          rediss://...
R2_ACCOUNT_ID              ...
R2_ACCESS_KEY_ID           ...
R2_SECRET_ACCESS_KEY       ...
R2_BUCKET_NAME             redinside-studio
RAILWAY_TOKEN              ...
RAILWAY_BACKEND_URL        https://your-service.up.railway.app
VERCEL_TOKEN               ...
VERCEL_ORG_ID              ...
VERCEL_PROJECT_ID          ...
MINIMAX_API_KEY            ...
```

- [ ] **Step 4: Push to develop and verify CI green**

```bash
git push origin develop
```

Check GitHub Actions tab — all 3 CI jobs should pass (lint, backend-tests, frontend-tests).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "feat: full CI/CD pipeline — branch-conditional CI + prod deploy on main"
git push origin develop
```

---

## Task 9: Smoke Test + First Production Deploy

**Files:** No new files — manual verification steps

- [ ] **Step 1: Create release branch from develop**

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.0
git push origin release/v1.0
```

- [ ] **Step 2: Merge to main via PR**

```bash
gh pr create --title "Release v1.0.0 — cloud deployment" \
  --body "First cloud release: Vercel + Railway + Turso + R2 + Clerk auth" \
  --base main --head release/v1.0
```

Wait for all CI checks to pass (lint ✓, backend-tests ✓, frontend-tests ✓), then merge.

- [ ] **Step 3: Verify deploy pipeline runs**

GitHub Actions → `Deploy` workflow should trigger automatically:
1. `deploy-backend` → Railway
2. `db-migrate` → Turso migrations
3. `deploy-frontend` → Vercel
4. `tag-release` → git tag

- [ ] **Step 4: Run R2 migration for existing data**

```bash
# Set env vars in terminal:
export R2_ACCOUNT_ID=...
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_BUCKET_NAME=redinside-studio
export STORAGE_PATH=/Users/admin/Music/RedInside-Storage
export DATABASE_PATH=/Users/admin/Anurag/Development/Codebase/ai/RedInside-Music-Studio/database/music-studio.sqlite

node backend/scripts/migrate-to-r2.js
```

Expected output:
```
Files to migrate: N
=== PHASE 1: COPY ===
  ✓ projects/abc/generations/music/v1-processed.mp3
  ...
=== PHASE 2: VERIFY (checksums) ===
  ✓ ...
=== PHASE 3: UPDATE DB ===
  ✓ Updated N rows
=== PHASE 4: FINAL VERIFY ===
  ✓ ...
=== PHASE 5: ARCHIVE LOCAL ===
  ✓ Archived to: /Users/admin/Music/RedInside-Storage-backup-2026-05-29
✓ MIGRATION COMPLETE
```

- [ ] **Step 5: Full smoke test on production URL**

Open the Vercel production URL. Run through:

1. **Auth**: Click login → Google OAuth2 → redirected to Studio
2. **Projects**: Projects list loads (your projects, scoped to your user_id)
3. **Tracks**: Open a project → Sounds tab → tracks appear
4. **Play**: Click play on a track → audio streams from R2 (check: `GET /api/music/:id/file` returns 302 to R2 presigned URL)
5. **Generate**: In Write tab, generate lyrics → save → switch to Sounds → generate music → wait for job to complete
6. **Artwork**: Upload artwork in RightPanel → thumbnail appears in PlayerBar
7. **Delete project**: Click ⋯ → Delete → inline confirm → project removed

Expected: All 7 steps pass without error.

- [ ] **Step 6: Merge release branch back to develop**

```bash
git checkout develop
git merge main
git push origin develop
```

- [ ] **Step 7: Tag the release**

```bash
git checkout main
git tag v1.0.0
git push origin v1.0.0
```

- [ ] **Step 8: Invite first users**

Go to Clerk Dashboard → User Management → Allowlist → add invited email addresses.

---

## GitHub Secrets Reference

| Secret | Where to get it |
|--------|----------------|
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `TURSO_DATABASE_URL` | `turso db show --url your-db` |
| `TURSO_AUTH_TOKEN` | `turso db tokens create your-db` |
| `UPSTASH_REDIS_URL` | Upstash Console → Redis → Connect |
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → R2 |
| `R2_ACCESS_KEY_ID` | R2 → Manage API Tokens |
| `R2_SECRET_ACCESS_KEY` | R2 → Manage API Tokens |
| `R2_BUCKET_NAME` | `redinside-studio` |
| `RAILWAY_TOKEN` | Railway Dashboard → Account → Tokens |
| `RAILWAY_BACKEND_URL` | Railway Dashboard → Service → Domain |
| `VERCEL_TOKEN` | Vercel Dashboard → Account → Tokens |
| `VERCEL_ORG_ID` | `cat frontend/.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | `cat frontend/.vercel/project.json` after `vercel link` |
| `MINIMAX_API_KEY` | MiniMax Console |

---

## Rollback Runbook

| Scenario | Action | Time |
|----------|--------|------|
| Backend deploy broken | Railway Dashboard → Deployments → Redeploy previous | 60s |
| Frontend broken | Vercel Dashboard → Deployments → Promote previous | 30s |
| Bad code merged to main | `git revert HEAD && git push origin main` | 5min |
| DB migration failed | Migration script logs `ROLLBACK` — no data lost; fix SQL and re-run | 15min |
| R2 migration loss | Local backup at `RedInside-Storage-backup-YYYY-MM-DD` — restore and re-run | 30min |
