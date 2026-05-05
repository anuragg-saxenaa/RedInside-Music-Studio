-- Image generations table
CREATE TABLE IF NOT EXISTS image_generations (
  id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  aspect_ratio TEXT,
  width INTEGER,
  height INTEGER,
  image_urls TEXT,
  seed INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_image_project ON image_generations(project_id);
