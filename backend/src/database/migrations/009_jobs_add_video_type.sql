-- Add generate-video to jobs type constraint
-- SQLite cannot ALTER CHECK constraint, so recreate the table preserving data

CREATE TABLE IF NOT EXISTS jobs_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('generate-lyrics', 'generate-music', 'generate-video', 'ffmpeg-process')) NOT NULL,
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

INSERT OR IGNORE INTO jobs_new SELECT * FROM jobs;
DROP TABLE jobs;
ALTER TABLE jobs_new RENAME TO jobs;

CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
