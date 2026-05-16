-- Add current_video_version to projects table
ALTER TABLE projects ADD COLUMN current_video_version INTEGER DEFAULT 0;

-- Settings table for app configuration (API keys, preferences)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FFmpeg operations audit log
CREATE TABLE IF NOT EXISTS ffmpeg_operations (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  music_id TEXT,
  operation TEXT NOT NULL,
  input_params TEXT,
  output_path TEXT,
  duration_ms INTEGER,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
