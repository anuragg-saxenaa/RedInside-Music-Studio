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
  type TEXT CHECK(type IN ('generate-lyrics', 'generate-music', 'generate-video', 'ffmpeg-process')) NOT NULL,
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
