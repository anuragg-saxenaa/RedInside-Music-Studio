import MinimaxClient from '../../utils/minimax.client.js';
import { LyricsModel } from '../../database/models/lyrics.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import config from '../../config/env.config.js';
import logger from '../../utils/logger.js';
import { buildPrompt, STYLE_PRESETS } from './presets.js';

export class LyricsService {
  constructor() {
    this.client = new MinimaxClient(config.minimax.apiKey, config.minimax.baseURL);
  }

  async generateLyrics(params) {
    try {
      const { projectId, prompt, stylePreset = 'hinglish-urban', mode = 'write_full_song' } = params;

      // Validate prompt
      if (!prompt || typeof prompt !== 'string') {
        throw new Error('Prompt must be a non-empty string');
      }
      if (prompt.length > 2000) {
        throw new Error('Prompt exceeds maximum length of 2000 characters');
      }

      // Validate stylePreset
      const validPresets = Object.keys(STYLE_PRESETS);
      if (!validPresets.includes(stylePreset)) {
        throw new Error(`Invalid stylePreset. Must be one of: ${validPresets.join(', ')}`);
      }

      // Validate mode
      if (!['write_full_song', 'edit'].includes(mode)) {
        throw new Error('Invalid mode. Must be write_full_song or edit');
      }

      logger.info('Generating lyrics', { projectId, stylePreset, mode });

      // Build full prompt with style preset
      const fullPrompt = buildPrompt(stylePreset, prompt);

      // Call MiniMax API
      const response = await this.client.generateLyrics({
        mode,
        prompt: fullPrompt,
      });

      // Validate response
      if (!response || !response.lyrics || !response.song_title) {
        throw new Error('Invalid response from MiniMax API: missing required fields');
      }

      // Parse response
      const { song_title, lyrics, style_tags } = response;

      // Parse structure tags from lyrics
      const structureTags = this.parseStructureTags(lyrics);

      // Get next version number
      const version = LyricsModel.getNextVersion(projectId);

      // Save to database
      const lyricsRecord = LyricsModel.create({
        projectId,
        version,
        prompt: fullPrompt,
        mode,
        stylePreset,
        content: lyrics,
        title: song_title,
        styleTags: style_tags,
        structureTags,
      });

      // Save to file
      storage.saveLyrics(projectId, version, {
        id: lyricsRecord.id,
        title: song_title,
        lyrics,
        styleTags: style_tags,
        structureTags,
        prompt: fullPrompt,
        createdAt: lyricsRecord.created_at,
      });

      // Increment project version
      ProjectModel.incrementVersion(projectId, 'lyrics');

      logger.info('Lyrics generated successfully', { lyricsId: lyricsRecord.id, version });

      return lyricsRecord;
    } catch (error) {
      logger.error('Failed to generate lyrics', { projectId: params.projectId, error: error.message });
      throw new Error(`Lyrics generation failed: ${error.message}`);
    }
  }

  parseStructureTags(lyrics) {
    const tagRegex = /\[(.*?)\]/g;
    const tags = [];
    let match;

    while ((match = tagRegex.exec(lyrics)) !== null) {
      const tag = match[1];
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }

  async getLyrics(lyricsId) {
    return LyricsModel.findById(lyricsId);
  }

  async getProjectLyrics(projectId) {
    return LyricsModel.findByProject(projectId);
  }
}
