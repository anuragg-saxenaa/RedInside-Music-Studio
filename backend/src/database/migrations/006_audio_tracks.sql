-- Audio tracks table for AudioProcessor
CREATE TABLE IF NOT EXISTS audio_tracks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT,
  file_path TEXT NOT NULL,
  duration_seconds REAL,
  sample_rate INTEGER,
  bitrate INTEGER,
  format TEXT,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audio_tracks_project ON audio_tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_version ON audio_tracks(project_id, version);
