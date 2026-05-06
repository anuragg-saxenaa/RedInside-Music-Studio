import db from '../../database/connection.js';
import { nanoid } from 'nanoid';

export const VideoModel = {
  create(data) {
    try {
      // Validate required fields
      if (!data.model || typeof data.model !== 'string' || data.model.trim() === '') {
        throw new Error('Video model is required and must be a non-empty string');
      }
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      const id = nanoid();
      const stmt = db.prepare(`
        INSERT INTO video_generations (
          id, project_id, music_id, version, model, prompt,
          duration, resolution, task_id, status, file_id, file_path, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
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
        data.errorMessage || null
      );

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create video generation: ${error.message}`);
    }
  },

  findById(id) {
    return db.prepare('SELECT * FROM video_generations WHERE id = ?').get(id);
  },

  findByProject(projectId) {
    return db.prepare('SELECT * FROM video_generations WHERE project_id = ? ORDER BY version DESC').all(projectId);
  },

  findByMusic(musicId) {
    return db.prepare('SELECT * FROM video_generations WHERE music_id = ? ORDER BY version DESC').all(musicId);
  },

  findByTaskId(taskId) {
    return db.prepare('SELECT * FROM video_generations WHERE task_id = ?').get(taskId);
  },

  update(id, data) {
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
      const stmt = db.prepare(`UPDATE video_generations SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update video generation: ${error.message}`);
    }
  },

  updateStatus(id, status, errorMessage = null) {
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
    const stmt = db.prepare(`UPDATE video_generations SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  },

  getNextVersion(projectId) {
    const result = db.prepare('SELECT MAX(version) as max_version FROM video_generations WHERE project_id = ?').get(projectId);
    return (result?.max_version || 0) + 1;
  },
};