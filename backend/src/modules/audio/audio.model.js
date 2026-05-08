import db from '../connection.js';
import { nanoid } from 'nanoid';

export const AudioModel = {
  /**
   * Create a new audio track
   * @param {Object} data - Track data
   * @returns {Object} - Created track
   */
  create(data) {
    try {
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }
      if (!data.filePath || typeof data.filePath !== 'string') {
        throw new Error('File path is required and must be a string');
      }

      const id = nanoid();
      const stmt = db.prepare(`
        INSERT INTO audio_tracks (id, project_id, name, file_path, duration_seconds, sample_rate, bitrate, format)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.projectId,
        data.name || null,
        data.filePath,
        data.durationSeconds || null,
        data.sampleRate || null,
        data.bitrate || null,
        data.format || null
      );

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create audio track: ${error.message}`);
    }
  },

  /**
   * Find track by ID
   * @param {string} id - Track ID
   * @returns {Object|null} - Track object
   */
  findById(id) {
    const row = db.prepare('SELECT * FROM audio_tracks WHERE id = ?').get(id);
    return row || null;
  },

  /**
   * Find all tracks for a project
   * @param {string} projectId - Project ID
   * @returns {Array} - Array of tracks
   */
  findByProject(projectId) {
    return db.prepare('SELECT * FROM audio_tracks WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  },

  /**
   * Update track
   * @param {string} id - Track ID
   * @param {Object} data - Update data
   * @returns {Object} - Updated track
   */
  update(id, data) {
    try {
      const updates = [];
      const values = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.filePath !== undefined) {
        updates.push('file_path = ?');
        values.push(data.filePath);
      }
      if (data.durationSeconds !== undefined) {
        updates.push('duration_seconds = ?');
        values.push(data.durationSeconds);
      }
      if (data.sampleRate !== undefined) {
        updates.push('sample_rate = ?');
        values.push(data.sampleRate);
      }
      if (data.bitrate !== undefined) {
        updates.push('bitrate = ?');
        values.push(data.bitrate);
      }
      if (data.format !== undefined) {
        updates.push('format = ?');
        values.push(data.format);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const stmt = db.prepare(`UPDATE audio_tracks SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update audio track: ${error.message}`);
    }
  },

  /**
   * Delete track
   * @param {string} id - Track ID
   * @returns {boolean} - Success
   */
  delete(id) {
    const result = db.prepare('DELETE FROM audio_tracks WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Get next version for a track in project
   * @param {string} projectId - Project ID
   * @returns {number} - Next version number
   */
  getNextVersion(projectId) {
    const result = db.prepare('SELECT MAX(version) as max_version FROM audio_tracks WHERE project_id = ?').get(projectId);
    return (result?.max_version || 0) + 1;
  },
};

export default AudioModel;
