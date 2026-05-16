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
      // Preserve MinimaxError structure for frontend
      if (error.name === 'MinimaxError') {
        throw error;
      }
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

  async editLyrics(lyricsId, edits) {
    try {
      const { prompt: editInstruction, stylePreset } = edits;

      // Load existing lyrics
      const existingLyrics = LyricsModel.findById(lyricsId);
      if (!existingLyrics) {
        const err = new Error(`Lyrics not found: ${lyricsId}`);
        err.statusCode = 404;
        throw err;
      }

      // Validate edit instruction
      if (!editInstruction || typeof editInstruction !== 'string') {
        throw new Error('Edit instruction (prompt) is required and must be a string');
      }
      if (editInstruction.length > 1000) {
        throw new Error('Edit instruction exceeds maximum length of 1000 characters');
      }

      // Build full prompt with style preset
      const stylePresetToUse = stylePreset || existingLyrics.style_preset || 'hinglish-urban';
      const fullPrompt = buildPrompt(stylePresetToUse, editInstruction);

      logger.info('Editing lyrics', { lyricsId, version: existingLyrics.version, stylePreset: stylePresetToUse });

      // Call MiniMax API with edit mode
      const response = await this.client.generateLyrics({
        mode: 'edit',
        prompt: fullPrompt,
        lyrics_id: lyricsId,
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
      const version = LyricsModel.getNextVersion(existingLyrics.project_id);

      // Save to database
      const lyricsRecord = LyricsModel.create({
        projectId: existingLyrics.project_id,
        version,
        prompt: fullPrompt,
        mode: 'edit',
        stylePreset: stylePresetToUse,
        content: lyrics,
        title: song_title,
        styleTags: style_tags,
        structureTags,
      });

      // Save to file
      storage.saveLyrics(existingLyrics.project_id, version, {
        id: lyricsRecord.id,
        title: song_title,
        lyrics,
        styleTags: style_tags,
        structureTags,
        prompt: fullPrompt,
        createdAt: lyricsRecord.created_at,
      });

      // Increment project version
      ProjectModel.incrementVersion(existingLyrics.project_id, 'lyrics');

      logger.info('Lyrics edited successfully', { lyricsId: lyricsRecord.id, version, originalLyricsId: lyricsId });

      return lyricsRecord;
    } catch (error) {
      logger.error('Failed to edit lyrics', { lyricsId, error: error.message });
      // Preserve MinimaxError structure for frontend
      if (error.name === 'MinimaxError' || error.statusCode) {
        throw error;
      }
      throw new Error(`Lyrics edit failed: ${error.message}`);
    }
  }

  async getLyricsVersions(lyricsId) {
    const lyrics = LyricsModel.findById(lyricsId);
    if (!lyrics) {
      throw new Error(`Lyrics not found: ${lyricsId}`);
    }
    return LyricsModel.findByProject(lyrics.project_id);
  }

  async getLyricsDiff(lyricsId, version) {
    const lyrics = LyricsModel.findById(lyricsId);
    if (!lyrics) {
      throw new Error(`Lyrics not found: ${lyricsId}`);
    }

    // Find the target version
    const versions = LyricsModel.findByProject(lyrics.project_id);
    const targetVersion = versions.find(v => v.version === parseInt(version, 10));

    if (!targetVersion) {
      throw new Error(`Version ${version} not found for lyrics ${lyricsId}`);
    }

    return {
      current: lyrics,
      target: targetVersion,
      diff: {
        title: lyrics.title !== targetVersion.title,
        content: lyrics.content !== targetVersion.content,
        stylePreset: lyrics.style_preset !== targetVersion.style_preset,
      },
    };
  }
}
