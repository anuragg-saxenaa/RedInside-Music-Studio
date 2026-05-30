import db from '../connection.js';
import { nanoid } from 'nanoid';

export const MedleyModel = {
  async create(data) {
    try {
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }
      if (!data.name || typeof data.name !== 'string') {
        throw new Error('Name is required and must be a string');
      }

      const id = nanoid();
      await db.execute({
        sql: `INSERT INTO medleys (id, project_id, name, description, output_file_path, total_duration, track_count)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          data.projectId,
          data.name,
          data.description || null,
          data.outputFilePath || null,
          data.totalDuration || null,
          data.trackCount || 0,
        ],
      });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create medley: ${error.message}`);
    }
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM medleys WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async findByIdWithTracks(id) {
    const medley = await this.findById(id);
    if (!medley) return null;

    const tracks = await this.getTracks(id);

    return {
      ...medley,
      tracks,
    };
  },

  async findByProject(projectId) {
    const result = await db.execute({ sql: 'SELECT * FROM medleys WHERE project_id = ? ORDER BY created_at DESC', args: [projectId] });
    return result.rows;
  },

  async update(id, data) {
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

      await db.execute({ sql: `UPDATE medleys SET ${updates.join(', ')} WHERE id = ?`, args: values });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update medley: ${error.message}`);
    }
  },

  async delete(id) {
    // Tracks are deleted via CASCADE
    const result = await db.execute({ sql: 'DELETE FROM medleys WHERE id = ?', args: [id] });
    return result.rowsAffected > 0;
  },

  async addTrack(data) {
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
      await db.execute({
        sql: `INSERT INTO medley_tracks (id, medley_id, source_file_path, order_index, trim_start, trim_end, speed, volume, fade_in, fade_out, duration_seconds)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
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
          data.durationSeconds ?? null,
        ],
      });

      // Update track count
      await this.updateTrackCount(data.medleyId);

      return this.findTrackById(id);
    } catch (error) {
      throw new Error(`Failed to add track: ${error.message}`);
    }
  },

  async findTrackById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM medley_tracks WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async getTracks(medleyId) {
    const result = await db.execute({ sql: 'SELECT * FROM medley_tracks WHERE medley_id = ? ORDER BY order_index ASC', args: [medleyId] });
    return result.rows;
  },

  async updateTrack(id, data) {
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
      await db.execute({ sql: `UPDATE medley_tracks SET ${updates.join(', ')} WHERE id = ?`, args: values });

      return this.findTrackById(id);
    } catch (error) {
      throw new Error(`Failed to update track: ${error.message}`);
    }
  },

  async deleteTrack(id) {
    const track = await this.findTrackById(id);
    if (!track) return false;

    const result = await db.execute({ sql: 'DELETE FROM medley_tracks WHERE id = ?', args: [id] });

    // Update track count
    if (result.rowsAffected > 0) {
      await this.updateTrackCount(track.medley_id);
    }

    return result.rowsAffected > 0;
  },

  async reorderTracks(medleyId, orders) {
    for (const { trackId, orderIndex } of orders) {
      await db.execute({ sql: 'UPDATE medley_tracks SET order_index = ? WHERE id = ? AND medley_id = ?', args: [orderIndex, trackId, medleyId] });
    }
  },

  async updateTrackCount(medleyId) {
    const result = await db.execute({ sql: 'SELECT COUNT(*) as count FROM medley_tracks WHERE medley_id = ?', args: [medleyId] });
    await db.execute({ sql: 'UPDATE medleys SET track_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', args: [result.rows[0].count, medleyId] });
  },
};

export default MedleyModel;
