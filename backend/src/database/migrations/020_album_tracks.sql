CREATE TABLE IF NOT EXISTS album_tracks (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  music_id TEXT NOT NULL REFERENCES music_generations(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(album_id, music_id)
);
