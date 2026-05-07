-- Generation chains table links all generations
CREATE TABLE IF NOT EXISTS generation_chains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lyrics_id TEXT,
  music_id TEXT,
  video_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (lyrics_id) REFERENCES lyrics_generations(id) ON DELETE SET NULL,
  FOREIGN KEY (music_id) REFERENCES music_generations(id) ON DELETE SET NULL,
  FOREIGN KEY (video_id) REFERENCES video_generations(id) ON DELETE SET NULL
);

-- Indexes for generation chains
CREATE INDEX IF NOT EXISTS idx_chains_project ON generation_chains(project_id);
CREATE INDEX IF NOT EXISTS idx_chains_lyrics ON generation_chains(lyrics_id);
CREATE INDEX IF NOT EXISTS idx_chains_music ON generation_chains(music_id);
CREATE INDEX IF NOT EXISTS idx_chains_video ON generation_chains(video_id);