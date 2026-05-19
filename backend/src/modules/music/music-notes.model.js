import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const MusicNotesModel = {
  findByMusic(musicId) {
    return db.prepare(
      `SELECT * FROM music_notes WHERE music_id = ? ORDER BY timestamp_sec ASC`
    ).all(musicId);
  },

  create(musicId, timestampSec, text) {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO music_notes (id, music_id, timestamp_sec, text) VALUES (?, ?, ?, ?)`
    ).run(id, musicId, timestampSec, text);
    return db.prepare(`SELECT * FROM music_notes WHERE id = ?`).get(id);
  },

  delete(id) {
    db.prepare(`DELETE FROM music_notes WHERE id = ?`).run(id);
  },
};
