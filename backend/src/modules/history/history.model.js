import db from '../../database/connection.js';
import { nanoid } from 'nanoid';

export const HistoryModel = {
  create(data) {
    try {
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      const id = nanoid();
      const stmt = db.prepare(`
        INSERT INTO generation_chains (
          id, project_id, lyrics_id, music_id, video_id
        ) VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.projectId,
        data.lyricsId || null,
        data.musicId || null,
        data.videoId || null
      );

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create generation chain: ${error.message}`);
    }
  },

  findById(id) {
    return db.prepare('SELECT * FROM generation_chains WHERE id = ?').get(id);
  },

  findByProject(projectId) {
    return db.prepare('SELECT * FROM generation_chains WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  },

  findByLyricsId(lyricsId) {
    return db.prepare('SELECT * FROM generation_chains WHERE lyrics_id = ?').get(lyricsId);
  },

  findByMusicId(musicId) {
    return db.prepare('SELECT * FROM generation_chains WHERE music_id = ?').get(musicId);
  },

  findByVideoId(videoId) {
    return db.prepare('SELECT * FROM generation_chains WHERE video_id = ?').get(videoId);
  },

  update(id, data) {
    try {
      const updates = [];
      const values = [];

      if (data.lyricsId !== undefined) {
        updates.push('lyrics_id = ?');
        values.push(data.lyricsId);
      }
      if (data.musicId !== undefined) {
        updates.push('music_id = ?');
        values.push(data.musicId);
      }
      if (data.videoId !== undefined) {
        updates.push('video_id = ?');
        values.push(data.videoId);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const stmt = db.prepare(`UPDATE generation_chains SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update generation chain: ${error.message}`);
    }
  },

  delete(id) {
    // Soft delete: unlink all references instead of actual deletion
    db.prepare('UPDATE generation_chains SET lyrics_id = NULL, music_id = NULL, video_id = NULL WHERE id = ?').run(id);
  },

  // Get all generations for a project grouped by type
  getProjectGenerations(projectId) {
    const chains = this.findByProject(projectId);

    const result = {
      lyrics: [],
      music: [],
      video: [],
      chains: [],
    };

    for (const chain of chains) {
      if (chain.lyrics_id) {
        const lyrics = db.prepare('SELECT * FROM lyrics_generations WHERE id = ?').get(chain.lyrics_id);
        if (lyrics) result.lyrics.push(lyrics);
      }
      if (chain.music_id) {
        const music = db.prepare('SELECT * FROM music_generations WHERE id = ?').get(chain.music_id);
        if (music) result.music.push(music);
      }
      if (chain.video_id) {
        const video = db.prepare('SELECT * FROM video_generations WHERE id = ?').get(chain.video_id);
        if (video) result.video.push(video);
      }
      result.chains.push(chain);
    }

    // Also get generations not linked to any chain
    const unlinkedLyrics = db.prepare(`
      SELECT * FROM lyrics_generations WHERE project_id = ?
      AND id NOT IN (SELECT lyrics_id FROM generation_chains WHERE lyrics_id IS NOT NULL)
      ORDER BY version DESC
    `).all(projectId);

    const unlinkedMusic = db.prepare(`
      SELECT * FROM music_generations WHERE project_id = ?
      AND id NOT IN (SELECT music_id FROM generation_chains WHERE music_id IS NOT NULL)
      ORDER BY version DESC
    `).all(projectId);

    const unlinkedVideos = db.prepare(`
      SELECT * FROM video_generations WHERE project_id = ?
      AND id NOT IN (SELECT video_id FROM generation_chains WHERE video_id IS NOT NULL)
      ORDER BY version DESC
    `).all(projectId);

    result.lyrics.push(...unlinkedLyrics);
    result.music.push(...unlinkedMusic);
    result.video.push(...unlinkedVideos);

    // Sort each type by version descending
    result.lyrics.sort((a, b) => b.version - a.version);
    result.music.sort((a, b) => b.version - a.version);
    result.video.sort((a, b) => b.version - a.version);

    return result;
  },
};