ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL DEFAULT 'admin';

CREATE TABLE IF NOT EXISTS user_settings (
  user_id        TEXT PRIMARY KEY,
  minimax_key    TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
