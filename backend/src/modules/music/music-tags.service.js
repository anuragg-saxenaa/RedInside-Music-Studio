import { parseFile } from 'music-metadata';
import db from '../../database/connection.js';
import { MusicModel } from '../../database/models/music.model.js';
import fs from 'fs';

export const MusicTagsService = {
  async getTags(musicId) {
    const cachedResult = await db.execute({ sql: 'SELECT * FROM music_tags WHERE music_id = ?', args: [musicId] });
    const cached = cachedResult.rows[0];
    if (cached) return { bpm: cached.bpm, key: cached.key_signature, mood: cached.mood };

    const music = await MusicModel.findById(musicId);
    if (!music) return { bpm: null, key: null, mood: null };

    const filePath = music.processed_file_path || music.original_file_path;
    if (!filePath || !fs.existsSync(filePath)) return { bpm: null, key: null, mood: null };

    let bpm = null;
    let key = null;

    try {
      const meta = await parseFile(filePath, { duration: true });
      bpm = meta.common?.bpm ?? null;
      key = meta.common?.key ?? null;
    } catch (e) {
      // File unreadable — return nulls gracefully
    }

    await db.execute({
      sql: 'INSERT OR REPLACE INTO music_tags (music_id, bpm, key_signature, computed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      args: [musicId, bpm, key],
    });

    return { bpm, key, mood: null };
  },
};
