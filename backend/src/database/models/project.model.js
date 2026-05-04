import db from '../connection.js';
import { nanoid } from 'nanoid';

export const ProjectModel = {
  create(data) {
    const id = nanoid();
    const stmt = db.prepare(`
      INSERT INTO projects (id, name, description, workflow_mode)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, data.name, data.description || null, data.workflowMode || 'hybrid');

    return this.findById(id);
  },

  findById(id) {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  },

  findAll() {
    return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  },

  update(id, data) {
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
    if (data.workflowMode !== undefined) {
      updates.push('workflow_mode = ?');
      values.push(data.workflowMode);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  },

  incrementVersion(id, type) {
    const field = `current_${type}_version`;
    db.prepare(`UPDATE projects SET ${field} = ${field} + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  },

  delete(id) {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  },
};
