-- Video generations table
CREATE TABLE IF NOT EXISTS video_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  music_id TEXT,
  version INTEGER NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  duration INTEGER,
  resolution TEXT,
  task_id TEXT,
  status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  file_id TEXT,
  file_path TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (music_id) REFERENCES music_generations(id) ON DELETE SET NULL,
  UNIQUE(project_id, version)
);

-- Indexes for video_generations
CREATE INDEX IF NOT EXISTS idx_video_project ON video_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_video_music ON video_generations(music_id);
CREATE INDEX IF NOT EXISTS idx_video_task ON video_generations(task_id);