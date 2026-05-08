import db from '../connection.js';
import { nanoid } from 'nanoid';
import fs from 'fs';

export const MusicModel = {
  create(data) {
    try {
      // Validate input
      if (!data.model || typeof data.model !== 'string' || data.model.trim() === '') {
        throw new Error('Music model is required and must be a non-empty string');
      }
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      const id = nanoid();
      const stmt = db.prepare(`
        INSERT INTO music_generations (
          id, project_id, lyrics_id, version, model, prompt,
          audio_settings, is_instrumental, original_file_path,
          processed_file_path, duration_seconds, sample_rate, bitrate, format
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.projectId,
        data.lyricsId || null,
        data.version,
        data.model,
        data.prompt || null,
        data.audioSettings ? JSON.stringify(data.audioSettings) : null,
        data.isInstrumental ? 1 : 0,
        data.originalFilePath || null,
        data.processedFilePath || null,
        data.durationSeconds || null,
        data.sampleRate || null,
        data.bitrate || null,
        data.format || null
      );

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create music generation: ${error.message}`);
    }
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM music_generations WHERE id = ?').get(id);
    if (row && row.audio_settings) {
      try {
        row.audio_settings = JSON.parse(row.audio_settings);
      } catch (e) {
        row.audio_settings = null;
      }
    }
    if (row) {
      row.is_instrumental = Boolean(row.is_instrumental);
    }
    return row;
  },

  findByProject(projectId) {
    const rows = db.prepare('SELECT * FROM music_generations WHERE project_id = ? ORDER BY version DESC').all(projectId);
    return rows.map(row => {
      if (row.audio_settings) {
        try {
          row.audio_settings = JSON.parse(row.audio_settings);
        } catch (e) {
          row.audio_settings = null;
        }
      }
      row.is_instrumental = Boolean(row.is_instrumental);
      return row;
    }).filter(row => {
      // Orphan protection: only return records where at least one file exists on disk
      const hasOriginal = row.original_file_path && fs.existsSync(row.original_file_path);
      const hasProcessed = row.processed_file_path && fs.existsSync(row.processed_file_path);
      return hasOriginal || hasProcessed;
    });
  },

  update(id, data) {
    try {
      const updates = [];
      const values = [];

      if (data.originalFilePath !== undefined) {
        updates.push('original_file_path = ?');
        values.push(data.originalFilePath);
      }
      if (data.processedFilePath !== undefined) {
        updates.push('processed_file_path = ?');
        values.push(data.processedFilePath);
      }
      if (data.durationSeconds !== undefined) {
        updates.push('duration_seconds = ?');
        values.push(data.durationSeconds);
      }
      if (data.bitrate !== undefined) {
        updates.push('bitrate = ?');
        values.push(data.bitrate);
      }

      // Check if there are any updates to apply
      if (updates.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const stmt = db.prepare(`UPDATE music_generations SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update music generation: ${error.message}`);
    }
  },

  getNextVersion(projectId) {
    const result = db.prepare('SELECT MAX(version) as max_version FROM music_generations WHERE project_id = ?').get(projectId);
    return (result?.max_version || 0) + 1;
  },
};
