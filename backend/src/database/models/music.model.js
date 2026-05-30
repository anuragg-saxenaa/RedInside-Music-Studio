import db from '../connection.js';
import { nanoid } from 'nanoid';
import fs from 'fs';

export const MusicModel = {
  async create(data) {
    try {
      // Validate input
      if (!data.model || typeof data.model !== 'string' || data.model.trim() === '') {
        throw new Error('Music model is required and must be a non-empty string');
      }
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      const id = nanoid();
      await db.execute({
        sql: `INSERT INTO music_generations (
          id, project_id, lyrics_id, version, model, prompt,
          audio_settings, is_instrumental, original_file_path,
          processed_file_path, duration_seconds, sample_rate, bitrate, format, artwork_url, title
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
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
          data.format || null,
          data.artworkUrl || null,
          data.title || null,
        ],
      });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create music generation: ${error.message}`);
    }
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM music_generations WHERE id = ?', args: [id] });
    const row = result.rows[0];
    if (!row) return null;
    if (row.audio_settings) {
      try {
        row.audio_settings = JSON.parse(row.audio_settings);
      } catch (e) {
        row.audio_settings = null;
      }
    }
    row.is_instrumental = Boolean(row.is_instrumental);
    return row;
  },

  async findByProject(projectId) {
    const result = await db.execute({ sql: 'SELECT * FROM music_generations WHERE project_id = ? ORDER BY version DESC', args: [projectId] });
    return result.rows.map(row => {
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
      // R2 keys (relative paths) and remote URLs are always valid — skip fs check
      const isRemote = (p) => p && (p.startsWith('http://') || p.startsWith('https://') || !p.startsWith('/'));
      if (isRemote(row.original_file_path) || isRemote(row.processed_file_path)) return true;
      // Local absolute paths: check file exists on disk
      const hasOriginal = row.original_file_path && fs.existsSync(row.original_file_path);
      const hasProcessed = row.processed_file_path && fs.existsSync(row.processed_file_path);
      return hasOriginal || hasProcessed;
    });
  },

  async update(id, data) {
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
      if (data.artworkUrl !== undefined) {
        updates.push('artwork_url = ?');
        values.push(data.artworkUrl);
      }
      if (data.title !== undefined) {
        updates.push('title = ?');
        values.push(data.title);
      }
      if (data.artist !== undefined) {
        updates.push('artist = ?');
        values.push(data.artist);
      }
      if (data.genre !== undefined) {
        updates.push('genre = ?');
        values.push(data.genre);
      }
      if (data.year !== undefined) {
        updates.push('year = ?');
        values.push(data.year);
      }
      if (data.trackNumber !== undefined) {
        updates.push('track_number = ?');
        values.push(data.trackNumber);
      }
      if (data.composer !== undefined) {
        updates.push('composer = ?');
        values.push(data.composer);
      }
      if (data.lyricsCredit !== undefined) {
        updates.push('lyrics_credit = ?');
        values.push(data.lyricsCredit);
      }

      // Check if there are any updates to apply
      if (updates.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      await db.execute({ sql: `UPDATE music_generations SET ${updates.join(', ')} WHERE id = ?`, args: values });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update music generation: ${error.message}`);
    }
  },

  async getNextVersion(projectId) {
    const result = await db.execute({ sql: 'SELECT MAX(version) as max_version FROM music_generations WHERE project_id = ?', args: [projectId] });
    return ((result.rows[0]?.max_version) || 0) + 1;
  },

  async delete(id) {
    const music = await this.findById(id);
    if (!music) {
      const err = new Error('Music not found');
      err.statusCode = 404;
      throw err;
    }

    // Delete files from disk
    if (music.original_file_path && fs.existsSync(music.original_file_path)) {
      fs.unlinkSync(music.original_file_path);
    }
    if (music.processed_file_path && fs.existsSync(music.processed_file_path)) {
      fs.unlinkSync(music.processed_file_path);
    }

    // Delete from database
    await db.execute({ sql: 'DELETE FROM music_generations WHERE id = ?', args: [id] });
    return true;
  },
};
