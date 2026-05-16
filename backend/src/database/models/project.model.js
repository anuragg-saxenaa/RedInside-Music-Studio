import db from '../connection.js';
import { nanoid } from 'nanoid';

export const ProjectModel = {
  create(data) {
    try {
      // Validate input
      if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        throw new Error('Project name is required and must be a non-empty string');
      }

      const id = nanoid();
      const stmt = db.prepare(`
        INSERT INTO projects (id, name, description, workflow_mode)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(id, data.name, data.description || null, data.workflowMode || 'hybrid');

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
  },

  findById(id) {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  },

  findAll() {
    return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  },

  update(id, data) {
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

      const stmt = db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }
  },

  incrementVersion(id, type) {
    try {
      // Add validation to prevent SQL injection
      if (!['lyrics', 'music', 'video'].includes(type)) {
        throw new Error(`Invalid version type: ${type}`);
      }
      const field = `current_${type}_version`;
      db.prepare(`UPDATE projects SET ${field} = ${field} + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    } catch (error) {
      throw new Error(`Failed to increment version: ${error.message}`);
    }
  },

  delete(id) {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  },
};
