import db from '../connection.js';
import { nanoid } from 'nanoid';

export const ProjectModel = {
  async create(data) {
    try {
      // Validate input
      if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        throw new Error('Project name is required and must be a non-empty string');
      }

      const id = nanoid();
      const userId = data.userId || 'admin';
      await db.execute({
        sql: `INSERT INTO projects (id, name, description, workflow_mode, user_id)
              VALUES (?, ?, ?, ?, ?)`,
        args: [id, data.name, data.description || null, data.workflowMode || 'hybrid', userId],
      });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async findAll() {
    const result = await db.execute('SELECT * FROM projects ORDER BY created_at DESC');
    return result.rows;
  },

  async update(id, data) {
    try {
      const updates = [];
      const values = [];

      if (data.name !== undefined) {
        if (typeof data.name !== 'string' || data.name.trim() === '') {
          throw new Error('Project name must be a non-empty string');
        }
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }
      if (data.workflowMode !== undefined) {
        updates.push('workflow_mode = ?');
        values.push(data.workflowMode);
      }
      if (data.current_lyrics_version !== undefined) {
        updates.push('current_lyrics_version = ?');
        values.push(data.current_lyrics_version);
      }
      if (data.current_music_version !== undefined) {
        updates.push('current_music_version = ?');
        values.push(data.current_music_version);
      }

      // Check if there are any updates to apply
      if (updates.length === 0) {
        return this.findById(id);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await db.execute({ sql: `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, args: values });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }
  },

  async incrementVersion(id, type) {
    try {
      // Add validation to prevent SQL injection
      if (!['lyrics', 'music', 'video'].includes(type)) {
        throw new Error(`Invalid version type: ${type}`);
      }
      const field = `current_${type}_version`;
      await db.execute({ sql: `UPDATE projects SET ${field} = ${field} + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, args: [id] });
    } catch (error) {
      throw new Error(`Failed to increment version: ${error.message}`);
    }
  },

  async delete(id) {
    await db.execute({ sql: 'DELETE FROM voice_clones WHERE project_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [id] });
  },
};
