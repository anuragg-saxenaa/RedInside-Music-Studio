CREATE TABLE IF NOT EXISTS music_tags (
  music_id TEXT PRIMARY KEY REFERENCES music_generations(id) ON DELETE CASCADE,
  bpm REAL,
  key_signature TEXT,
  mood TEXT,
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
