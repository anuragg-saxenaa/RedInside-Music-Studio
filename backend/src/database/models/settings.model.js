import db from '../connection.js';

const DEFAULTS = [
  ['minimax_api_key', ''],
  ['default_workflow_mode', 'hybrid'],
  ['auto_ffmpeg_320kbps', 'true'],
  ['default_music_model', 'music-2.6'],
  ['default_video_model', 'MiniMax-Hailuo-2.3'],
];

function ensureDefaults() {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r[0], r[1])));
  insertMany(DEFAULTS);
}

ensureDefaults();

export const SettingsModel = {
  getAll() {
    return db.prepare('SELECT key, value, updated_at FROM settings').all();
  },

  get(key) {
    return db.prepare('SELECT key, value, updated_at FROM settings WHERE key = ?').get(key);
  },

  set(key, value) {
    db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    ).run(key, value);
    return this.get(key);
  },

  setMany(updates) {
    const upsert = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    );
    const tx = db.transaction((pairs) => pairs.forEach(([k, v]) => upsert.run(k, v)));
    tx(Object.entries(updates));
    return this.getAll();
  },
};
