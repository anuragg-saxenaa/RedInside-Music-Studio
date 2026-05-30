/**
 * Viral Optimizations Model
 * Database operations for viral toolkit optimizations
 */

import db from '../../database/connection.js';
import { nanoid } from 'nanoid';

function parseJsonFields(row) {
  if (!row) return null;
  if (row.trends_used) {
    try { row.trends_used = JSON.parse(row.trends_used); } catch (e) { row.trends_used = null; }
  }
  if (row.optimization_params) {
    try { row.optimization_params = JSON.parse(row.optimization_params); } catch (e) { row.optimization_params = null; }
  }
  return row;
}

export const ViralModel = {
  async create(data) {
    try {
      // Validate required fields
      if (!data.generationId || typeof data.generationId !== 'string') {
        throw new Error('Generation ID is required and must be a string');
      }
      if (!data.generationType || !['lyrics', 'music', 'video'].includes(data.generationType)) {
        throw new Error('Generation type must be one of: lyrics, music, video');
      }

      const id = nanoid();
      await db.execute({
        sql: `INSERT INTO viral_optimizations (
          id, generation_id, generation_type, trends_used, hook_score,
          structure_template, reference_track_url, optimization_params
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          data.generationId,
          data.generationType,
          data.trendsUsed ? JSON.stringify(data.trendsUsed) : null,
          data.hookScore || null,
          data.structureTemplate || null,
          data.referenceTrackUrl || null,
          data.optimizationParams ? JSON.stringify(data.optimizationParams) : null,
        ],
      });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create viral optimization: ${error.message}`);
    }
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM viral_optimizations WHERE id = ?', args: [id] });
    return parseJsonFields(result.rows[0] || null);
  },

  async findByGeneration(generationId, generationType) {
    const result = await db.execute({
      sql: 'SELECT * FROM viral_optimizations WHERE generation_id = ? AND generation_type = ? ORDER BY applied_at DESC',
      args: [generationId, generationType],
    });
    return parseJsonFields(result.rows[0] || null);
  },

  async findByProject(projectId) {
    const lyricsResult = await db.execute({
      sql: `SELECT vo.* FROM viral_optimizations vo
            INNER JOIN lyrics_generations g ON g.id = vo.generation_id
            WHERE g.project_id = ?
            ORDER BY vo.applied_at DESC`,
      args: [projectId],
    });

    const musicResult = await db.execute({
      sql: `SELECT vo.* FROM viral_optimizations vo
            INNER JOIN music_generations g ON g.id = vo.generation_id
            WHERE g.project_id = ?
            ORDER BY vo.applied_at DESC`,
      args: [projectId],
    });

    const allRows = [...lyricsResult.rows, ...musicResult.rows].sort((a, b) =>
      new Date(b.applied_at) - new Date(a.applied_at)
    );

    return allRows.map(parseJsonFields);
  },

  getLatestByGeneration(generationId, generationType) {
    return this.findByGeneration(generationId, generationType);
  },

  async update(id, data) {
    try {
      const updates = [];
      const values = [];

      if (data.trendsUsed !== undefined) {
        updates.push('trends_used = ?');
        values.push(data.trendsUsed ? JSON.stringify(data.trendsUsed) : null);
      }
      if (data.hookScore !== undefined) {
        updates.push('hook_score = ?');
        values.push(data.hookScore);
      }
      if (data.structureTemplate !== undefined) {
        updates.push('structure_template = ?');
        values.push(data.structureTemplate);
      }
      if (data.referenceTrackUrl !== undefined) {
        updates.push('reference_track_url = ?');
        values.push(data.referenceTrackUrl);
      }
      if (data.optimizationParams !== undefined) {
        updates.push('optimization_params = ?');
        values.push(data.optimizationParams ? JSON.stringify(data.optimizationParams) : null);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      await db.execute({ sql: `UPDATE viral_optimizations SET ${updates.join(', ')} WHERE id = ?`, args: values });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update viral optimization: ${error.message}`);
    }
  },

  async delete(id) {
    try {
      const result = await db.execute({ sql: 'DELETE FROM viral_optimizations WHERE id = ?', args: [id] });
      return result.rowsAffected > 0;
    } catch (error) {
      throw new Error(`Failed to delete viral optimization: ${error.message}`);
    }
  },
};

export default ViralModel;
