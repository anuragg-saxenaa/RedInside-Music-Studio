# Cloud Deployment + CI/CD Design

**Date:** 2026-05-29
**Status:** Approved
**Goal:** Deploy RedInside Music Studio to cloud for 10 invited users, free tier, with zero-downtime CI/CD, safe data migration, proper branching, and seamless path to scale.

---

## 1. Architecture Overview

### Services

| Service | Provider | Purpose | Cost |
|---------|----------|---------|------|
| Frontend hosting | Vercel | React/Vite static deploy | Free |
| Backend API | Railway | Node.js + FFmpeg + BullMQ | $5 credit → free |
| Database | Turso | SQLite-compatible, distributed | Free (9GB) |
| Redis / Job queue | Upstash | BullMQ jobs | Free (10K cmds/day) |
| File storage | Cloudflare R2 | Audio, artwork, video | Free (10GB, zero egress) |
| Auth | Clerk | Google/Facebook/Apple OAuth2 | Free (10K MAU) |

### Request Flow

```
User browser
  → Vercel (React app, static)
  → Railway (/api/*) ← protected by Clerk JWT middleware
      → Turso (project/track/album queries, scoped by user_id)
      → Cloudflare R2 (presigned URL redirect for audio streaming)
      → MiniMax API (AI generation)
      → Upstash Redis (BullMQ job queue)
```

### Audio Streaming (zero Railway bandwidth)

```
GET /api/music/:id/file
  → backend verifies Clerk JWT
  → generates R2 presigned URL (15min expiry)
  → 302 redirect → browser streams direct from R2
```

---

## 2. Auth Layer (Clerk)

### Provider Support
- Google OAuth2 ✅
- Facebook OAuth2 ✅
- Apple Sign In ✅ (requires Apple Developer account for App Store; web-only is free)

### Invite-Only (Phase 1)
- Clerk Dashboard → Allowlist → add invited user emails
- Only allowlisted emails can sign up
- Unknown emails: blocked automatically, no code required

### BYOK — Bring Your Own Key (Phase 2, future)
- Settings page: user enters their MiniMax API key
- Stored encrypted (AES-256) in `user_settings` table
- Backend: if user has own key → use it; else fallback to `MINIMAX_API_KEY` env var
- Zero breaking change — same Settings page, just unlock the field

### Multi-tenancy DB Change
```sql
ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL DEFAULT 'admin';
-- Existing projects assigned to admin user_id (owner's Clerk ID)
-- All project/track/playlist/album queries filtered by user_id

CREATE TABLE user_settings (
  user_id        TEXT PRIMARY KEY,
  minimax_key    TEXT,              -- AES-256 encrypted
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Auth UI
- Full-page route `/#/login` in existing hash router
- Clerk `<SignIn>` component themed to match app exactly:
  - Background: `#08020a`
  - Primary: `#E63946` (C.red)
  - Font: Outfit, DM Sans
  - Dark glass card, red border, red social buttons
  - Custom subtitle: "Invite-only platform"
- Uses `frontend-design` skill for full polish (animations, micro-interactions)
- No jarring white default Clerk UI

### Code Changes
- **Frontend:** `<ClerkProvider>` wraps `App.tsx`; `useAuth()` attaches JWT to all fetch calls; `/#/login` route with themed `<SignIn>`
- **Backend:** `@clerk/express` middleware on all `/api/*` routes; `req.auth.userId` scopes all DB queries

---

## 3. File Storage — Local → Cloudflare R2

### R2 Bucket Structure
```
redinside-studio/
└── projects/
    └── {projectId}/
        ├── generations/
        │   ├── lyrics/v{n}.txt
        │   ├── music/v{n}-original.mp3
        │   └── music/v{n}-processed.mp3
        ├── artwork/
        │   ├── music-{musicId}.png
        │   └── album-{albumId}.png
        └── medley/medley-{medleyId}.mp3
```

### Code Change
`storage.util.js` interface stays identical — internals swap from `fs.*` to `@aws-sdk/client-s3` (R2 is S3-compatible). All callers unchanged.

### DB Path Change
```
Before: /Users/admin/Music/RedInside-Storage/projects/abc/music/v1-processed.mp3  (absolute)
After:  projects/abc/generations/music/v1-processed.mp3                            (R2 key, relative)
```

### Data Migration — Zero Loss Protocol

**Phase 1: COPY (no deletes, no DB changes)**
- Read each file path from DB
- Upload to R2 at equivalent key
- `HEAD` request → verify R2 has file (size match)
- Log every file: ✓ or ✗
- STOP on any failure — fix before continuing

**Phase 2: VERIFY (checksums)**
- MD5 local file vs R2 ETag
- Must match exactly for every file
- STOP on any mismatch

**Phase 3: UPDATE DB (atomic transaction)**
```sql
BEGIN TRANSACTION;
  UPDATE music_generations SET original_file_path = ? WHERE id = ?;
  UPDATE music_generations SET processed_file_path = ? WHERE id = ?;
  UPDATE video_generations SET file_path = ? WHERE id = ?;
  UPDATE medleys SET output_file_path = ? WHERE id = ?;
  UPDATE albums SET artwork_path = ? WHERE id = ?;
COMMIT;
-- ROLLBACK on any error — local files untouched, app still works
```

**Phase 4: FINAL VERIFY**
- Fetch each DB path via R2 → must return 200
- `ffprobe` duration check on each `.mp3`
- Print full migration report

**Phase 5: ARCHIVE LOCAL (never delete)**
```
mv /Users/admin/Music/RedInside-Storage → /Users/admin/Music/RedInside-Storage-backup-2026-05-29
```
Keep for 30 days, then manually delete after confidence.

**Migration script:** `backend/scripts/migrate-to-r2.js`
Prints per-file status, phase-by-phase progress, final summary.

---

## 4. Git Branching Strategy

### Branch Map

```
main          → Production (always deployable, tagged, protected)
release/vX.Y  → Staging (QA, final fixes only)
develop       → Integration (all features land here, Vercel preview)
feature/*     → Feature work (PR → develop)
hotfix/*      → Emergency fixes (PR → main + backport → develop)
```

### Branch Protection Rules (GitHub Settings)

| Branch | Direct push | Requires PR | Requires CI | Requires review |
|--------|------------|-------------|-------------|-----------------|
| `main` | ❌ blocked | ✅ | ✅ pass | ✅ 1 approval |
| `develop` | ❌ blocked | ✅ | ✅ pass | ❌ |
| `release/*` | ❌ blocked | ✅ | ✅ pass | ❌ |

### Release Flow

```
feature/auth-clerk ──PR──▶ develop
feature/r2-storage ──PR──▶ develop
                             │
              git checkout -b release/v1.0
              deploy to staging → QA
                             │
              PR ──────────▶ main
              git tag v1.0.0
              git push origin v1.0.0
```

### Version Tagging

```
v1.0.0  — auth + R2 storage + cloud launch
v1.1.0  — BYOK keys
v1.2.0  — Electron Mac app
v1.x.x  — patch: hotfixes only (never new features)
```

### Rollback Options

| Method | When | Time |
|--------|------|------|
| Railway redeploy to previous image | Deploy broken | 60s |
| Vercel promote previous deployment | Frontend broken | 30s |
| `gh pr revert <number>` | Bad code merged | 5min |
| `git revert HEAD~N` + push | Multiple commits | 10min |

---

## 5. CI/CD Pipeline

### Pipeline Per Branch

| Branch | Jobs | Time |
|--------|------|------|
| `feature/*` | lint + typecheck | ~2 min |
| `develop` | lint + typecheck + backend-tests + e2e + Vercel preview | ~6 min |
| `release/*` | full CI + staging deploy + health check + smoke test | ~8 min |
| `main` | full CI + DB migrate + prod deploy + tag + notify | ~8 min |
| `hotfix/*` | full CI + prod deploy + backport to develop | ~8 min |

### CI Jobs Detail

**Job 1 — lint-typecheck** (all branches)
```
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
```

**Job 2 — backend-tests** (develop, release/*, main)
```
start Redis
start MiniMax mock server (port 8999)
start backend (MINIMAX_BASE_URL=http://localhost:8999)
wait-on http://localhost:3000/health
cd backend && npm test → 0 failures required
```

**Job 3 — e2e** (develop, release/*, main)
```
cd frontend && npm run build
install backend deps
npx playwright test (chromium)
upload artifacts on failure (screenshots, traces)
```

**Job 4 — deploy-staging** (release/* only)
```
railway deploy --service staging
vercel deploy --target preview
GET /health → assert 200
smoke test: create project → assert 201
```

**Job 5 — db-migrate** (main only, runs before deploy)
```
turso db shell → run pending migrations
verify schema version matches app version
rollback + block deploy if mismatch
```

**Job 6 — deploy-production** (main only, after all pass)
```
railway deploy --service production
vercel promote to production
GET /health → assert 200
git tag vX.Y.Z → push
notify: email/Slack "vX.Y.Z deployed ✓"
```

### Zero-Downtime Deploy (Railway)
```
New container builds → health check /health → 200
Traffic shifts to new container
Old container stops
If health check fails → old container keeps all traffic (auto-rollback)
```

### GitHub Secrets Required
```
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
UPSTASH_REDIS_URL
UPSTASH_REDIS_TOKEN
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
RAILWAY_TOKEN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
MINIMAX_API_KEY
```

---

## 6. Day-to-Day Developer Flow

### Adding a new feature
```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# build + test locally
git push origin feature/my-feature
# open PR → develop
# CI runs (2min lint) → merge when green
```

### Shipping a release
```bash
git checkout -b release/v1.1 develop
# final QA on staging (auto-deployed)
# fix any issues on release branch
git checkout main
git merge release/v1.1
git push origin main           # triggers full CI + prod deploy
git tag v1.1.0
git push origin v1.1.0
git checkout develop
git merge main                 # keep develop in sync
```

### Emergency hotfix
```bash
git checkout -b hotfix/critical-bug main
# fix
git push origin hotfix/critical-bug
# PR → main (CI runs, 1 review)
# merge → auto-deploys prod
# backport: PR → develop
```

### Rolling back production
```bash
# Option 1: Railway dashboard → Deployments → Redeploy v1.0.0 (30s)
# Option 2:
git revert HEAD
git push origin main           # triggers CI → deploys clean state
```

---

## 7. Environment Variables Per Environment

| Variable | Local | Staging | Production |
|----------|-------|---------|-----------|
| `NODE_ENV` | development | staging | production |
| `MINIMAX_BASE_URL` | http://localhost:8999 (mock) | https://api.minimax.io | https://api.minimax.io |
| `DATABASE_URL` | local SQLite file | Turso staging DB | Turso production DB |
| `REDIS_URL` | localhost:6379 | Upstash staging | Upstash production |
| `STORAGE_BUCKET` | local disk | r2-redinside-staging | r2-redinside-prod |
| `CLERK_PUBLISHABLE_KEY` | dev key | staging key | prod key |

---

## Implementation Order

1. **Git branching setup** — protect main/develop, create develop branch
2. **Clerk auth** — install SDK, themed login page, protect routes, user_id multi-tenancy
3. **Turso DB** — swap SQLite driver, run migrations on Turso
4. **Cloudflare R2** — storage adapter swap, migrate existing 5 projects safely
5. **Upstash Redis** — swap Redis URL env var
6. **Railway deploy** — backend service, env vars, health check
7. **Vercel deploy** — frontend, env vars, preview on develop
8. **GitHub Actions** — full pipeline with branch-conditional jobs
9. **Smoke test end-to-end** — login → create project → generate track → play
