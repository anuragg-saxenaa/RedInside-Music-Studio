import db from '../database/connection.js';
import { nanoid } from 'nanoid';

export const JobModel = {
  create(data) {
    const id = nanoid();
    const stmt = db.prepare(`
      INSERT INTO jobs (id, project_id, type, status, progress, input_params, result, error_message)
      VALUES (?, ?, ?, 'queued', 0, ?, NULL, NULL)
    `);

    stmt.run(
      id,
      data.projectId,
      data.type,
      data.inputParams ? JSON.stringify(data.inputParams) : null
    );

    return this.findById(id);
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (row && row.input_params) {
      try {
        row.input_params = JSON.parse(row.input_params);
      } catch (e) {
        row.input_params = null;
      }
    }
    if (row && row.result) {
      try {
        row.result = JSON.parse(row.result);
      } catch (e) {
        row.result = null;
      }
    }
    return row;
  },

  findByProject(projectId) {
    return db.prepare('SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  },

  update(id, data) {
    const updates = [];
    const values = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.progress !== undefined) {
      updates.push('progress = ?');
      values.push(data.progress);
    }
    if (data.result !== undefined) {
      updates.push('result = ?');
      values.push(data.result ? JSON.stringify(data.result) : null);
    }
    if (data.errorMessage !== undefined) {
      updates.push('error_message = ?');
      values.push(data.errorMessage);
    }
    if (data.startedAt !== undefined) {
      updates.push('started_at = ?');
      values.push(data.startedAt);
    }
    if (data.completedAt !== undefined) {
      updates.push('completed_at = ?');
      values.push(data.completedAt);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  },

  updateStatus(id, status, errorMessage = null) {
    const updates = ['status = ?'];
    const values = [status];

    if (status === 'active') {
      updates.push('started_at = CURRENT_TIMESTAMP');
    } else if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    if (errorMessage) {
      updates.push('error_message = ?');
      values.push(errorMessage);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  },
};