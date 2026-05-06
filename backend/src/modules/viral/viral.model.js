/**
 * Viral Optimizations Model
 * Database operations for viral toolkit optimizations
 */

import db from '../../database/connection.js';
import { nanoid } from 'nanoid';

export const ViralModel = {
  create(data) {
    try {
      // Validate required fields
      if (!data.generationId || typeof data.generationId !== 'string') {
        throw new Error('Generation ID is required and must be a string');
      }
      if (!data.generationType || !['lyrics', 'music', 'video'].includes(data.generationType)) {
        throw new Error('Generation type must be one of: lyrics, music, video');
      }

      const id = nanoid();
      const stmt = db.prepare(`
        INSERT INTO viral_optimizations (
          id, generation_id, generation_type, trends_used, hook_score,
          structure_template, reference_track_url, optimization_params
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.generationId,
        data.generationType,
        data.trendsUsed ? JSON.stringify(data.trendsUsed) : null,
        data.hookScore || null,
        data.structureTemplate || null,
        data.referenceTrackUrl || null,
        data.optimizationParams ? JSON.stringify(data.optimizationParams) : null
      );

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create viral optimization: ${error.message}`);
    }
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM viral_optimizations WHERE id = ?').get(id);
    if (!row) return null;

    // Parse JSON fields
    if (row.trends_used) {
      try {
        row.trends_used = JSON.parse(row.trends_used);
      } catch (e) {
        row.trends_used = null;
      }
    }
    if (row.optimization_params) {
      try {
        row.optimization_params = JSON.parse(row.optimization_params);
      } catch (e) {
        row.optimization_params = null;
      }
    }

    return row;
  },

  findByGeneration(generationId, generationType) {
    const row = db.prepare(
      'SELECT * FROM viral_optimizations WHERE generation_id = ? AND generation_type = ? ORDER BY applied_at DESC'
    ).get(generationId, generationType);

    if (!row) return null;

    // Parse JSON fields
    if (row.trends_used) {
      try {
        row.trends_used = JSON.parse(row.trends_used);
      } catch (e) {
        row.trends_used = null;
      }
    }
    if (row.optimization_params) {
      try {
        row.optimization_params = JSON.parse(row.optimization_params);
      } catch (e) {
        row.optimization_params = null;
      }
    }

    return row;
  },

  findByProject(projectId) {
    // Get optimizations for lyrics generations
    const lyricsRows = db.prepare(`
      SELECT vo.* FROM viral_optimizations vo
      INNER JOIN lyrics_generations g ON g.id = vo.generation_id
      WHERE g.project_id = ?
      ORDER BY vo.applied_at DESC
    `).all(projectId);

    // Get optimizations for music generations
    const musicRows = db.prepare(`
      SELECT vo.* FROM viral_optimizations vo
      INNER JOIN music_generations g ON g.id = vo.generation_id
      WHERE g.project_id = ?
      ORDER BY vo.applied_at DESC
    `).all(projectId);

    const allRows = [...lyricsRows, ...musicRows].sort((a, b) =>
      new Date(b.applied_at) - new Date(a.applied_at)
    );

    return allRows.map(row => {
      if (row.trends_used) {
        try {
          row.trends_used = JSON.parse(row.trends_used);
        } catch (e) {
          row.trends_used = null;
        }
      }
      if (row.optimization_params) {
        try {
          row.optimization_params = JSON.parse(row.optimization_params);
        } catch (e) {
          row.optimization_params = null;
        }
      }
      return row;
    });
  },

  getLatestByGeneration(generationId, generationType) {
    return this.findByGeneration(generationId, generationType);
  },

  update(id, data) {
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
      const stmt = db.prepare(`UPDATE viral_optimizations SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update viral optimization: ${error.message}`);
    }
  },

  delete(id) {
    try {
      const stmt = db.prepare('DELETE FROM viral_optimizations WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete viral optimization: ${error.message}`);
    }
  },
};

export default ViralModel;