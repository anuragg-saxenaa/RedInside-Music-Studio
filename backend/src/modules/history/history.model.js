import db from '../../database/connection.js';
import { nanoid } from 'nanoid';

export const HistoryModel = {
  async create(data) {
    try {
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      const id = nanoid();
      await db.execute({
        sql: `INSERT INTO generation_chains (id, project_id, lyrics_id, music_id, video_id) VALUES (?, ?, ?, ?, ?)`,
        args: [id, data.projectId, data.lyricsId || null, data.musicId || null, data.videoId || null],
      });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create generation chain: ${error.message}`);
    }
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM generation_chains WHERE id = ?', args: [id] });
    return result.rows[0] || null;
  },

  async findByProject(projectId) {
    const result = await db.execute({ sql: 'SELECT * FROM generation_chains WHERE project_id = ? ORDER BY created_at DESC', args: [projectId] });
    return result.rows;
  },

  async findByLyricsId(lyricsId) {
    const result = await db.execute({ sql: 'SELECT * FROM generation_chains WHERE lyrics_id = ?', args: [lyricsId] });
    return result.rows[0] || null;
  },

  async findByMusicId(musicId) {
    const result = await db.execute({ sql: 'SELECT * FROM generation_chains WHERE music_id = ?', args: [musicId] });
    return result.rows[0] || null;
  },

  async findByVideoId(videoId) {
    const result = await db.execute({ sql: 'SELECT * FROM generation_chains WHERE video_id = ?', args: [videoId] });
    return result.rows[0] || null;
  },

  async update(id, data) {
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
      await db.execute({ sql: `UPDATE generation_chains SET ${updates.join(', ')} WHERE id = ?`, args: values });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to update generation chain: ${error.message}`);
    }
  },

  async delete(id) {
    // Soft delete: unlink all references instead of actual deletion
    await db.execute({ sql: 'UPDATE generation_chains SET lyrics_id = NULL, music_id = NULL, video_id = NULL WHERE id = ?', args: [id] });
  },

  // Get all generations for a project grouped by type
  async getProjectGenerations(projectId) {
    const chains = await this.findByProject(projectId);

    const result = {
      lyrics: [],
      music: [],
      video: [],
      chains: [],
    };

    for (const chain of chains) {
      if (chain.lyrics_id) {
        const lyricsResult = await db.execute({ sql: 'SELECT * FROM lyrics_generations WHERE id = ?', args: [chain.lyrics_id] });
        const lyrics = lyricsResult.rows[0];
        if (lyrics) result.lyrics.push(lyrics);
      }
      if (chain.music_id) {
        const musicResult = await db.execute({ sql: 'SELECT * FROM music_generations WHERE id = ?', args: [chain.music_id] });
        const music = musicResult.rows[0];
        if (music) result.music.push(music);
      }
      if (chain.video_id) {
        const videoResult = await db.execute({ sql: 'SELECT * FROM video_generations WHERE id = ?', args: [chain.video_id] });
        const video = videoResult.rows[0];
        if (video) result.video.push(video);
      }
      result.chains.push(chain);
    }

    // Also get generations not linked to any chain
    const unlinkedLyricsResult = await db.execute({
      sql: `SELECT * FROM lyrics_generations WHERE project_id = ?
            AND id NOT IN (SELECT lyrics_id FROM generation_chains WHERE lyrics_id IS NOT NULL)
            ORDER BY version DESC`,
      args: [projectId],
    });

    const unlinkedMusicResult = await db.execute({
      sql: `SELECT * FROM music_generations WHERE project_id = ?
            AND id NOT IN (SELECT music_id FROM generation_chains WHERE music_id IS NOT NULL)
            ORDER BY version DESC`,
      args: [projectId],
    });

    const unlinkedVideosResult = await db.execute({
      sql: `SELECT * FROM video_generations WHERE project_id = ?
            AND id NOT IN (SELECT video_id FROM generation_chains WHERE video_id IS NOT NULL)
            ORDER BY version DESC`,
      args: [projectId],
    });

    result.lyrics.push(...unlinkedLyricsResult.rows);
    result.music.push(...unlinkedMusicResult.rows);
    result.video.push(...unlinkedVideosResult.rows);

    // Sort each type by version descending
    result.lyrics.sort((a, b) => b.version - a.version);
    result.music.sort((a, b) => b.version - a.version);
    result.video.sort((a, b) => b.version - a.version);

    return result;
  },
};
