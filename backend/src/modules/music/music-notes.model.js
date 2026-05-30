import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const MusicNotesModel = {
  async findByMusic(musicId) {
    const result = await db.execute({
      sql: 'SELECT * FROM music_notes WHERE music_id = ? ORDER BY timestamp_sec ASC',
      args: [musicId],
    });
    return result.rows;
  },

  async create(musicId, timestampSec, text) {
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO music_notes (id, music_id, timestamp_sec, text) VALUES (?, ?, ?, ?)',
      args: [id, musicId, timestampSec, text],
    });
    const result = await db.execute({ sql: 'SELECT * FROM music_notes WHERE id = ?', args: [id] });
    return result.rows[0];
  },

  async delete(id) {
    await db.execute({ sql: 'DELETE FROM music_notes WHERE id = ?', args: [id] });
  },
};
