import db from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export const AlbumModel = {
  create({ projectId, title, artist, year, genre, label }) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO albums (id, project_id, title, artist, year, genre, label)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, title, artist ?? null, year ?? null, genre ?? null, label ?? null);
    return this.findById(id);
  },

  findByProject(projectId) {
    return db.prepare(`
      SELECT a.*, COUNT(at.id) as track_count
      FROM albums a
      LEFT JOIN album_tracks at ON at.album_id = a.id
      WHERE a.project_id = ?
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `).all(projectId);
  },

  findById(id) {
    return db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
  },

  update(id, { title, artist, year, genre, label, artworkPath }) {
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
    db.prepare(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM albums WHERE id = ?').run(id);
  },

  getTracks(albumId) {
    return db.prepare(`
      SELECT mg.*, at.position
      FROM album_tracks at
      JOIN music_generations mg ON mg.id = at.music_id
      WHERE at.album_id = ?
      ORDER BY at.position ASC
    `).all(albumId);
  },

  addTrack(albumId, musicId) {
    const id = uuidv4();
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as m FROM album_tracks WHERE album_id = ?'
    ).get(albumId).m;
    db.prepare(`
      INSERT OR IGNORE INTO album_tracks (id, album_id, music_id, position)
      VALUES (?, ?, ?, ?)
    `).run(id, albumId, musicId, maxPos + 1);
  },

  removeTrack(albumId, musicId) {
    db.prepare('DELETE FROM album_tracks WHERE album_id = ? AND music_id = ?').run(albumId, musicId);
  },

  reorderTracks(albumId, orderedMusicIds) {
    const update = db.prepare(
      'UPDATE album_tracks SET position = ? WHERE album_id = ? AND music_id = ?'
    );
    const tx = db.transaction((ids) => {
      ids.forEach((musicId, idx) => update.run(idx, albumId, musicId));
    });
    tx(orderedMusicIds);
  },
};
