import db from '../database/connection.js';
import { nanoid } from 'nanoid';

export const JobModel = {
  async create(data) {
    const id = nanoid();
    await db.execute({
      sql: `INSERT INTO jobs (id, project_id, type, status, progress, input_params, result, error_message)
            VALUES (?, ?, ?, 'queued', 0, ?, NULL, NULL)`,
      args: [id, data.projectId, data.type, data.inputParams ? JSON.stringify(data.inputParams) : null],
    });

    return this.findById(id);
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [id] });
    const row = result.rows[0];
    if (!row) return null;
    if (row.input_params) {
      try {
        row.input_params = JSON.parse(row.input_params);
      } catch (e) {
        row.input_params = null;
      }
    }
    if (row.result) {
      try {
        row.result = JSON.parse(row.result);
      } catch (e) {
        row.result = null;
      }
    }
    return row;
  },

  async findByProject(projectId) {
    const result = await db.execute({ sql: 'SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at DESC', args: [projectId] });
    return result.rows;
  },

  async update(id, data) {
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
    await db.execute({ sql: `UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`, args: values });

    return this.findById(id);
  },

  async updateStatus(id, status, errorMessage = null) {
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
    await db.execute({ sql: `UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`, args: values });

    return this.findById(id);
  },
};
