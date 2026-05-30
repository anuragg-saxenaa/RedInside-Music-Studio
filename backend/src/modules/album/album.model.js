import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const AlbumModel = {
  async create({ projectId, title, artist, year, genre, label }) {
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO albums (id, project_id, title, artist, year, genre, label) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, projectId, title, artist ?? null, year ?? null, genre ?? null, label ?? null],
    });
    return this.findById(id);
  },

  async findByProject(projectId) {
    const result = await db.execute({
      sql: `SELECT a.*, COUNT(at.id) as track_count
            FROM albums a
            LEFT JOIN album_tracks at ON at.album_id = a.id
            WHERE a.project_id = ?
            GROUP BY a.id
            ORDER BY a.created_at DESC`,
      args: [projectId],
    });
    return result.rows;
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM albums WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async update(id, { title, artist, year, genre, label, artworkPath }) {
    const updates = [];
    const values = [];
    if (title !== undefined)       { updates.push('title = ?');        values.push(title); }
    if (artist !== undefined)      { updates.push('artist = ?');       values.push(artist); }
    if (year !== undefined)        { updates.push('year = ?');         values.push(year); }
    if (genre !== undefined)       { updates.push('genre = ?');        values.push(genre); }
    if (label !== undefined)       { updates.push('label = ?');        values.push(label); }
    if (artworkPath !== undefined) { updates.push('artwork_path = ?'); values.push(artworkPath); }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    await db.execute({ sql: `UPDATE albums SET ${updates.join(', ')} WHERE id = ?`, args: values });
    return this.findById(id);
  },

  async delete(id) {
    await db.execute({ sql: 'DELETE FROM albums WHERE id = ?', args: [id] });
  },

  async getTracks(albumId) {
    const result = await db.execute({
      sql: `SELECT mg.*, at.position
            FROM album_tracks at
            JOIN music_generations mg ON mg.id = at.music_id
            WHERE at.album_id = ?
            ORDER BY at.position ASC`,
      args: [albumId],
    });
    return result.rows;
  },

  async addTrack(albumId, musicId) {
    const id = uuidv4();
    const maxPosResult = await db.execute({
      sql: 'SELECT COALESCE(MAX(position), -1) as m FROM album_tracks WHERE album_id = ?',
      args: [albumId],
    });
    const maxPos = maxPosResult.rows[0].m;
    await db.execute({
      sql: 'INSERT OR IGNORE INTO album_tracks (id, album_id, music_id, position) VALUES (?, ?, ?, ?)',
      args: [id, albumId, musicId, maxPos + 1],
    });
  },

  async removeTrack(albumId, musicId) {
    await db.execute({ sql: 'DELETE FROM album_tracks WHERE album_id = ? AND music_id = ?', args: [albumId, musicId] });
  },

  async reorderTracks(albumId, orderedMusicIds) {
    for (let idx = 0; idx < orderedMusicIds.length; idx++) {
      await db.execute({ sql: 'UPDATE album_tracks SET position = ? WHERE album_id = ? AND music_id = ?', args: [idx, albumId, orderedMusicIds[idx]] });
    }
  },
};
