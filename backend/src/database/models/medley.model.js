import db from '../connection.js';
import { nanoid } from 'nanoid';

export const MedleyModel = {
  /**
   * Create a new medley
   * @param {Object} data - Medley data
   * @returns {Object} - Created medley
   */
  create(data) {
    try {
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }
      if (!data.name || typeof data.name !== 'string') {
        throw new Error('Name is required and must be a string');
      }

      const id = nanoid();
      const stmt = db.prepare(`
        INSERT INTO medleys (id, project_id, name, description, output_file_path, total_duration, track_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.projectId,
        data.name,
        data.description || null,
        data.outputFilePath || null,
        data.totalDuration || null,
        data.trackCount || 0
      );

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create medley: ${error.message}`);
    }
  },

  /**
   * Find medley by ID
   * @param {string} id - Medley ID
   * @returns {Object|null} - Medley object
   */
  findById(id) {
    const row = db.prepare('SELECT * FROM medleys WHERE id = ?').get(id);
    return row || null;
  },

  /**
   * Find medley by ID with tracks
   * @param {string} id - Medley ID
   * @returns {Object|null} - Medley with tracks
   */
  findByIdWithTracks(id) {
    const medley = this.findById(id);
    if (!medley) return null;

    const tracks = db.prepare(
      'SELECT * FROM medley_tracks WHERE medley_id = ? ORDER BY order_index ASC'
    ).all(id);

    return {
      ...medley,
      tracks,
    };
  },

  /**
   * Find all medleys for a project
   * @param {string} projectId - Project ID
   * @returns {Array} - Array of medleys
   */
  findByProject(projectId) {
    return db.prepare('SELECT * FROM medleys WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  },

  /**
   * Update medley
   * @param {string} id - Medley ID
   * @param {Object} data - Update data
   * @returns {Object} - Updated medley
   */
  update(id, data) {
    try {
      const updates = [];
      const values = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }
      if (data.outputFilePath !== undefined) {
        updates.push('output_file_path = ?');
        values.push(data.outputFilePath);
      }
      if (data.totalDuration !== undefined) {
        updates.push('total_duration = ?');
        values.push(data.totalDuration);
      }
      if (data.trackCount !== undefined) {
        updates.push('track_count = ?');
        values.push(data.trackCount);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const stmt = db.prepare(`UPDATE medleys SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update medley: ${error.message}`);
    }
  },

  /**
   * Delete medley and its tracks
   * @param {string} id - Medley ID
   * @returns {boolean} - Success
   */
  delete(id) {
    // Tracks are deleted via CASCADE
    const result = db.prepare('DELETE FROM medleys WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Add a track to medley
   * @param {Object} data - Track data
   * @returns {Object} - Created track
   */
  addTrack(data) {
    try {
      if (!data.medleyId || typeof data.medleyId !== 'string') {
        throw new Error('Medley ID is required and must be a string');
      }
      if (!data.sourceFilePath || typeof data.sourceFilePath !== 'string') {
        throw new Error('Source file path is required and must be a string');
      }
      if (typeof data.orderIndex !== 'number') {
        throw new Error('Order index is required and must be a number');
      }

      const id = nanoid();
      const stmt = db.prepare(`
        INSERT INTO medley_tracks (id, medley_id, source_file_path, order_index, trim_start, trim_end, speed, volume, fade_in, fade_out, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.medleyId,
        data.sourceFilePath,
        data.orderIndex,
        data.trimStart ?? 0,
        data.trimEnd ?? null,
        data.speed ?? 1.0,
        data.volume ?? 1.0,
        data.fadeIn ?? 0,
        data.fadeOut ?? 0,
        data.durationSeconds ?? null
      );

      // Update track count
      this.updateTrackCount(data.medleyId);

      return this.findTrackById(id);
    } catch (error) {
      throw new Error(`Failed to add track: ${error.message}`);
    }
  },

  /**
   * Find track by ID
   * @param {string} id - Track ID
   * @returns {Object|null} - Track object
   */
  findTrackById(id) {
    const row = db.prepare('SELECT * FROM medley_tracks WHERE id = ?').get(id);
    return row || null;
  },

  /**
   * Get all tracks for a medley
   * @param {string} medleyId - Medley ID
   * @returns {Array} - Array of tracks
   */
  getTracks(medleyId) {
    return db.prepare('SELECT * FROM medley_tracks WHERE medley_id = ? ORDER BY order_index ASC').all(medleyId);
  },

  /**
   * Update a track
   * @param {string} id - Track ID
   * @param {Object} data - Update data
   * @returns {Object} - Updated track
   */
  updateTrack(id, data) {
    try {
      const updates = [];
      const values = [];

      if (data.orderIndex !== undefined) {
        updates.push('order_index = ?');
        values.push(data.orderIndex);
      }
      if (data.trimStart !== undefined) {
        updates.push('trim_start = ?');
        values.push(data.trimStart);
      }
      if (data.trimEnd !== undefined) {
        updates.push('trim_end = ?');
        values.push(data.trimEnd);
      }
      if (data.speed !== undefined) {
        updates.push('speed = ?');
        values.push(data.speed);
      }
      if (data.volume !== undefined) {
        updates.push('volume = ?');
        values.push(data.volume);
      }
      if (data.fadeIn !== undefined) {
        updates.push('fade_in = ?');
        values.push(data.fadeIn);
      }
      if (data.fadeOut !== undefined) {
        updates.push('fade_out = ?');
        values.push(data.fadeOut);
      }
      if (data.durationSeconds !== undefined) {
        updates.push('duration_seconds = ?');
        values.push(data.durationSeconds);
      }

      if (updates.length === 0) {
        return this.findTrackById(id);
      }

      values.push(id);
      const stmt = db.prepare(`UPDATE medley_tracks SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findTrackById(id);
    } catch (error) {
      throw new Error(`Failed to update track: ${error.message}`);
    }
  },

  /**
   * Delete a track
   * @param {string} id - Track ID
   * @returns {boolean} - Success
   */
  deleteTrack(id) {
    const track = this.findTrackById(id);
    if (!track) return false;

    const result = db.prepare('DELETE FROM medley_tracks WHERE id = ?').run(id);

    // Update track count
    if (result.changes > 0) {
      this.updateTrackCount(track.medley_id);
    }

    return result.changes > 0;
  },

  /**
   * Reorder tracks for a medley
   * @param {string} medleyId - Medley ID
   * @param {Array<{trackId: string, orderIndex: number}>} orders - New order mapping
   */
  reorderTracks(medleyId, orders) {
    const stmt = db.prepare('UPDATE medley_tracks SET order_index = ? WHERE id = ? AND medley_id = ?');

    for (const { trackId, orderIndex } of orders) {
      stmt.run(orderIndex, trackId, medleyId);
    }
  },

  /**
   * Update track count for a medley
   * @param {string} medleyId - Medley ID
   */
  updateTrackCount(medleyId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM medley_tracks WHERE medley_id = ?').get(medleyId);
    db.prepare('UPDATE medleys SET track_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(result.count, medleyId);
  },
};

export default MedleyModel;