import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const PlaylistModel = {
  async create(name) {
    const id = uuidv4();
    await db.execute({ sql: 'INSERT INTO playlists (id, name) VALUES (?, ?)', args: [id, name] });
    return this.findById(id);
  },

  async findAll() {
    const result = await db.execute(`
      SELECT p.*, COUNT(pt.id) as track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    return result.rows;
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM playlists WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async update(id, name) {
    await db.execute({ sql: 'UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', args: [name, id] });
    return this.findById(id);
  },

  async delete(id) {
    await db.execute({ sql: 'DELETE FROM playlists WHERE id = ?', args: [id] });
  },

  async addTrack(playlistId, musicId) {
    const id = uuidv4();
    const maxPosResult = await db.execute({
      sql: 'SELECT COALESCE(MAX(position), -1) as m FROM playlist_tracks WHERE playlist_id = ?',
      args: [playlistId],
    });
    const maxPos = maxPosResult.rows[0].m;
    await db.execute({
      sql: 'INSERT OR IGNORE INTO playlist_tracks (id, playlist_id, music_id, position) VALUES (?, ?, ?, ?)',
      args: [id, playlistId, musicId, maxPos + 1],
    });
    return this.getTracks(playlistId);
  },

  async removeTrack(playlistId, musicId) {
    await db.execute({ sql: 'DELETE FROM playlist_tracks WHERE playlist_id = ? AND music_id = ?', args: [playlistId, musicId] });
  },

  async getTracks(playlistId) {
    const result = await db.execute({
      sql: `SELECT mg.*, pt.position, pt.added_at
            FROM playlist_tracks pt
            JOIN music_generations mg ON mg.id = pt.music_id
            WHERE pt.playlist_id = ?
            ORDER BY pt.position ASC`,
      args: [playlistId],
    });
    return result.rows;
  },
};
