-- Add 'vocal-removal' and 'youtube-download' to jobs.type CHECK constraint
-- SQLite cannot ALTER CHECK constraints, so recreate the table preserving data

BEGIN;

CREATE TABLE IF NOT EXISTS jobs_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('generate-lyrics', 'generate-music', 'generate-video', 'ffmpeg-process', 'vocal-removal', 'youtube-download')) NOT NULL,
  status TEXT CHECK(status IN ('queued', 'active', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  input_params TEXT,
  result TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

INSERT INTO jobs_new SELECT * FROM jobs;
DROP TABLE jobs;
ALTER TABLE jobs_new RENAME TO jobs;

COMMIT;
