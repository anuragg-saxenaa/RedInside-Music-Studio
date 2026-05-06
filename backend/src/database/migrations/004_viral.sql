-- Viral Optimizations table
CREATE TABLE IF NOT EXISTS viral_optimizations (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  generation_type TEXT CHECK(generation_type IN ('lyrics', 'music', 'video')) NOT NULL,
  trends_used JSON,
  hook_score REAL,
  structure_template TEXT,
  reference_track_url TEXT,
  optimization_params JSON,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for viral optimizations
CREATE INDEX IF NOT EXISTS idx_viral_generation ON viral_optimizations(generation_id, generation_type);
CREATE INDEX IF NOT EXISTS idx_viral_applied_at ON viral_optimizations(applied_at);
