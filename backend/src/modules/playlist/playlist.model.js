import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const PlaylistModel = {
  create(name) {
    const id = uuidv4();
    db.prepare(`INSERT INTO playlists (id, name) VALUES (?, ?)`).run(id, name);
    return this.findById(id);
  },

  findAll() {
    return db.prepare(`
      SELECT p.*, COUNT(pt.id) as track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();
  },

  findById(id) {
    return db.prepare(`SELECT * FROM playlists WHERE id = ?`).get(id);
  },

  update(id, name) {
    db.prepare(`UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(name, id);
    return this.findById(id);
  },

  delete(id) {
    db.prepare(`DELETE FROM playlists WHERE id = ?`).run(id);
  },

  addTrack(playlistId, musicId) {
    const id = uuidv4();
    const maxPos = db.prepare(
      `SELECT COALESCE(MAX(position), -1) as m FROM playlist_tracks WHERE playlist_id = ?`
    ).get(playlistId).m;
    db.prepare(`
      INSERT OR IGNORE INTO playlist_tracks (id, playlist_id, music_id, position)
      VALUES (?, ?, ?, ?)
    `).run(id, playlistId, musicId, maxPos + 1);
    return this.getTracks(playlistId);
  },

  removeTrack(playlistId, musicId) {
    db.prepare(`DELETE FROM playlist_tracks WHERE playlist_id = ? AND music_id = ?`).run(playlistId, musicId);
  },

  getTracks(playlistId) {
    return db.prepare(`
      SELECT mg.*, pt.position, pt.added_at
      FROM playlist_tracks pt
      JOIN music_generations mg ON mg.id = pt.music_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position ASC
    `).all(playlistId);
  },
};
