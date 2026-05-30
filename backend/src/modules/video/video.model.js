import db from '../../database/connection.js';
import { nanoid } from 'nanoid';

export const VideoModel = {
  async create(data) {
    try {
      // Validate required fields
      if (!data.model || typeof data.model !== 'string' || data.model.trim() === '') {
        throw new Error('Video model is required and must be a non-empty string');
      }
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      const id = nanoid();
      await db.execute({
        sql: `INSERT INTO video_generations (
          id, project_id, music_id, version, model, prompt,
          duration, resolution, task_id, status, file_id, file_path, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          data.projectId,
          data.musicId || null,
          data.version,
          data.model,
          data.prompt || null,
          data.duration || null,
          data.resolution || null,
          data.taskId || null,
          data.status || 'pending',
          data.fileId || null,
          data.filePath || null,
          data.errorMessage || null,
        ],
      });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create video generation: ${error.message}`);
    }
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM video_generations WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async findByProject(projectId) {
    const result = await db.execute({ sql: 'SELECT * FROM video_generations WHERE project_id = ? ORDER BY version DESC', args: [projectId] });
    return result.rows;
  },

  async findByMusic(musicId) {
    const result = await db.execute({ sql: 'SELECT * FROM video_generations WHERE music_id = ? ORDER BY version DESC', args: [musicId] });
    return result.rows;
  },

  async findByTaskId(taskId) {
    const result = await db.execute({ sql: 'SELECT * FROM video_generations WHERE task_id = ?', args: [taskId] });
    return result.rows[0] || null;
  },

  async update(id, data) {
    try {
      const updates = [];
      const values = [];

      if (data.taskId !== undefined) {
        updates.push('task_id = ?');
        values.push(data.taskId);
      }
      if (data.status !== undefined) {
        updates.push('status = ?');
        values.push(data.status);
      }
      if (data.fileId !== undefined) {
        updates.push('file_id = ?');
        values.push(data.fileId);
      }
      if (data.filePath !== undefined) {
        updates.push('file_path = ?');
        values.push(data.filePath);
      }
      if (data.errorMessage !== undefined) {
        updates.push('error_message = ?');
        values.push(data.errorMessage);
      }
      if (data.completedAt !== undefined) {
        updates.push('completed_at = ?');
        values.push(data.completedAt);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      await db.execute({ sql: `UPDATE video_generations SET ${updates.join(', ')} WHERE id = ?`, args: values });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update video generation: ${error.message}`);
    }
  },

  async updateStatus(id, status, errorMessage = null) {
    const updates = ['status = ?'];
    const values = [status];

    if (status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    if (errorMessage) {
      updates.push('error_message = ?');
      values.push(errorMessage);
    }

    values.push(id);
    await db.execute({ sql: `UPDATE video_generations SET ${updates.join(', ')} WHERE id = ?`, args: values });

    return this.findById(id);
  },

  async getNextVersion(projectId) {
    const result = await db.execute({ sql: 'SELECT MAX(version) as max_version FROM video_generations WHERE project_id = ?', args: [projectId] });
    return ((result.rows[0]?.max_version) || 0) + 1;
  },
};
