import MinimaxClient from '../../utils/minimax.client.js';
import { LyricsModel } from '../../database/models/lyrics.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import config from '../../config/env.config.js';
import logger from '../../utils/logger.js';
import { buildPrompt } from './presets.js';

export class LyricsService {
  constructor() {
    this.client = new MinimaxClient(config.minimax.apiKey, config.minimax.baseURL);
  }

  async generateLyrics(params) {
    const { projectId, prompt, stylePreset = 'hinglish-urban', mode = 'write_full_song' } = params;

    logger.info('Generating lyrics', { projectId, stylePreset, mode });

    // Build full prompt with style preset
    const fullPrompt = buildPrompt(stylePreset, prompt);

    // Call MiniMax API
    const response = await this.client.generateLyrics({
      mode,
      prompt: fullPrompt,
    });

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
