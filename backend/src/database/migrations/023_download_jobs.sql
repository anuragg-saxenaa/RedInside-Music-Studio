-- Download job queue: clients (iOS/web) enqueue a YouTube download; a worker
-- running on a residential IP (the desktop app) claims it, downloads locally,
-- and uploads the result. Avoids YouTube's datacenter-IP block entirely.
CREATE TABLE IF NOT EXISTS download_jobs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | processing | done | failed
  music_id TEXT,
  title TEXT,
  error TEXT,
  claimed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_download_jobs_status ON download_jobs(status, created_at);
