import db from '../connection.js';

const DEFAULTS = [
  ['minimax_api_key', ''],
  ['default_workflow_mode', 'hybrid'],
  ['auto_ffmpeg_320kbps', 'true'],
  ['default_music_model', 'music-2.6'],
  ['default_video_model', 'MiniMax-Hailuo-2.3'],
];

async function ensureDefaults() {
  for (const [key, value] of DEFAULTS) {
    await db.execute({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: [key, value] });
  }
}

await ensureDefaults();

export const SettingsModel = {
  async getAll() {
    const result = await db.execute('SELECT key, value, updated_at FROM settings');
    return result.rows;
  },

  async get(key) {
    const result = await db.execute({ sql: 'SELECT key, value, updated_at FROM settings WHERE key = ?', args: [key] });
    return result.rows[0] || null;
  },

  async set(key, value) {
    await db.execute({
      sql: 'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
      args: [key, value],
    });
    return this.get(key);
  },

  async setMany(updates) {
    for (const [k, v] of Object.entries(updates)) {
      await db.execute({
        sql: 'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
        args: [k, v],
      });
    }
    return this.getAll();
  },
};
