-- Medley table
CREATE TABLE IF NOT EXISTS medleys (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  output_file_path TEXT,
  total_duration REAL,
  track_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Medley tracks table
CREATE TABLE IF NOT EXISTS medley_tracks (
  id TEXT PRIMARY KEY,
  medley_id TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  trim_start REAL DEFAULT 0,
  trim_end REAL,
  speed REAL DEFAULT 1.0,
  volume REAL DEFAULT 1.0,
  fade_in REAL DEFAULT 0,
  fade_out REAL DEFAULT 0,
  duration_seconds REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medley_id) REFERENCES medleys(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_medley_project ON medleys(project_id);
CREATE INDEX IF NOT EXISTS idx_medley_tracks_medley ON medley_tracks(medley_id);
CREATE INDEX IF NOT EXISTS idx_medley_tracks_order ON medley_tracks(medley_id, order_index);