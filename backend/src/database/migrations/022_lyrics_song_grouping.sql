-- Per-song grouping for lyrics: song_id groups versions of the same song,
-- song_version is the 1-based sequence within that song.
ALTER TABLE lyrics_generations ADD COLUMN song_id TEXT;
ALTER TABLE lyrics_generations ADD COLUMN song_version INTEGER DEFAULT 1;

-- Backfill: each existing lyrics row becomes its own song, version 1
UPDATE lyrics_generations SET song_id = id WHERE song_id IS NULL;
UPDATE lyrics_generations SET song_version = 1 WHERE song_version IS NULL;
