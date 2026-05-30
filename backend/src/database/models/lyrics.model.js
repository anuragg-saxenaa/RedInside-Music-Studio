import db from '../connection.js';
import { nanoid } from 'nanoid';

export const LyricsModel = {
  async create(data) {
    try {
      // Validate input
      if (!data.content || typeof data.content !== 'string' || data.content.trim() === '') {
        throw new Error('Lyrics content is required and must be a non-empty string');
      }
      if (!data.projectId || typeof data.projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      const id = nanoid();
      await db.execute({
        sql: `INSERT INTO lyrics_generations (
          id, project_id, version, prompt, mode, style_preset,
          content, title, style_tags, structure_tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          data.projectId,
          data.version,
          data.prompt || null,
          data.mode || 'write_full_song',
          data.stylePreset || null,
          data.content,
          data.title || null,
          data.styleTags || null,
          data.structureTags ? JSON.stringify(data.structureTags) : null,
        ],
      });

      return this.findById(id);
    } catch (error) {
      throw new Error(`Failed to create lyrics: ${error.message}`);
    }
  },

  async findById(id) {
    const result = await db.execute({ sql: 'SELECT * FROM lyrics_generations WHERE id = ?', args: [id] });
    const row = result.rows[0];
    if (!row) return null;
    if (row.structure_tags) {
      try {
        row.structure_tags = JSON.parse(row.structure_tags);
      } catch (e) {
        row.structure_tags = null;
      }
    }
    return row;
  },

  async findByProject(projectId) {
    const result = await db.execute({ sql: 'SELECT * FROM lyrics_generations WHERE project_id = ? ORDER BY version DESC', args: [projectId] });
    return result.rows.map(row => {
      if (row.structure_tags) {
        try {
          row.structure_tags = JSON.parse(row.structure_tags);
        } catch (e) {
          row.structure_tags = null;
        }
      }
      return row;
    });
  },

  async getNextVersion(projectId) {
    const result = await db.execute({ sql: 'SELECT MAX(version) as max_version FROM lyrics_generations WHERE project_id = ?', args: [projectId] });
    return ((result.rows[0]?.max_version) || 0) + 1;
  },
};
