import db from '../connection.js';
import { nanoid } from 'nanoid';

export const AudioModel = {
  async create(data) {
    try {
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }
      if (!data.filePath || typeof data.filePath !== 'string') {
        throw new Error('File path is required and must be a string');
      }

      const id = nanoid();
      await db.execute({
        sql: `INSERT INTO audio_tracks (id, project_id, name, file_path, duration_seconds, sample_rate, bitrate, format)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          data.projectId,
          data.name || null,
          data.filePath,
          data.durationSeconds || null,
          data.sampleRate || null,
          data.bitrate || null,
          data.format || null,
        ],
      });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create audio track: ${error.message}`);
    }
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM audio_tracks WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async findByProject(projectId) {
    const result = await db.execute({ sql: 'SELECT * FROM audio_tracks WHERE project_id = ? ORDER BY created_at DESC', args: [projectId] });
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

      await db.execute({ sql: `UPDATE audio_tracks SET ${updates.join(', ')} WHERE id = ?`, args: values });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update audio track: ${error.message}`);
    }
  },

  async delete(id) {
    const result = await db.execute({ sql: 'DELETE FROM audio_tracks WHERE id = ?', args: [id] });
    return result.rowsAffected > 0;
  },

  async getNextVersion(projectId) {
    const result = await db.execute({ sql: 'SELECT MAX(version) as max_version FROM audio_tracks WHERE project_id = ?', args: [projectId] });
    return ((result.rows[0]?.max_version) || 0) + 1;
  },
};

export default AudioModel;
