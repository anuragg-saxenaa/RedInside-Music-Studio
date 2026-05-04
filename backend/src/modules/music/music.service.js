import MinimaxClient from '../../utils/minimax.client.js';
import { MusicModel } from '../../database/models/music.model.js';
import { LyricsModel } from '../../database/models/lyrics.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import config from '../../config/env.config.js';
import logger from '../../utils/logger.js';

export class MusicService {
  constructor() {
    this.client = new MinimaxClient(config.minimax.apiKey, config.minimax.baseURL);
  }

  async generateMusic(params) {
    try {
      const { projectId, lyricsId, prompt, model = 'music-2.6',
        isInstrumental = false, audioSettings } = params;

      // Validate projectId
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      // Validate lyricsId (optional for instrumental)
      let lyricsContent = null;
      if (lyricsId) {
        const lyrics = LyricsModel.findById(lyricsId);
        if (!lyrics) {
          throw new Error(`Lyrics not found: ${lyricsId}`);
        }
        lyricsContent = lyrics.content;
      } else if (!isInstrumental) {
        throw new Error('Lyrics ID is required for non-instrumental music');
      }

      // Validate model
      const validModels = ['music-2.6', 'music-cover'];
      if (!validModels.includes(model)) {
        throw new Error(`Invalid model. Must be one of: ${validModels.join(', ')}`);
      }

      logger.info('Generating music', { projectId, lyricsId, model, isInstrumental });

      // Build request to MiniMax
      const requestParams: any = {
        model,
        audio_setting: audioSettings || {},
      };

      if (isInstrumental) {
        requestParams.is_instrumental = true;
        if (prompt) {
          requestParams.prompt = prompt;
        }
      } else {
        if (!lyricsContent) {
          throw new Error('Lyrics content is empty');
        }
        requestParams.lyrics = lyricsContent;
        if (prompt) {
          requestParams.prompt = prompt;
        }
      }

      logger.info('MiniMax request', {
        endpoint: '/v1/music_generation',
        model: requestParams.model,
        hasLyrics: !!requestParams.lyrics,
        lyricsLength: requestParams.lyrics?.length || 0,
        hasPrompt: !!requestParams.prompt,
        isInstrumental: requestParams.is_instrumental || false,
      });

      // Call MiniMax API
      const response = await this.client.generateMusic(requestParams);

      logger.info('MiniMax response received', { responseKeys: Object.keys(response || {}) });
        model,
        audio_setting: audioSettings || {},
      };

      if (isInstrumental) {
        requestParams.is_instrumental = true;
        if (prompt) {
          requestParams.prompt = prompt;
        }
      } else {
        if (!lyricsContent) {
          throw new Error('Lyrics content is empty');
        }
        requestParams.lyrics = lyricsContent;
        if (prompt) {
          requestParams.prompt = prompt;
        }
      }

      // Call MiniMax API
      const response = await this.client.generateMusic(requestParams);

      // Validate response - API returns data.audio (hex) directly
      if (!response || !response.data) {
        throw new Error('Invalid response from MiniMax API: missing data field');
      }

      if (response.data.status !== 2) {
        throw new Error(`Music generation not ready, status: ${response.data.status}`);
      }

      // Get next version number
      const version = MusicModel.getNextVersion(projectId);

      // Convert hex audio to buffer and save
      const audioBuffer = Buffer.from(response.data.audio, 'hex');

      // Save original file
      const originalFilePath = storage.getMusicFilePath(projectId, version, 'original');
      storage.saveAudioFile(audioBuffer, originalFilePath);

      // Create database record
      const musicRecord = MusicModel.create({
        projectId,
        lyricsId: lyricsId || null,
        version,
        model,
        prompt: prompt || null,
        audioSettings,
        isInstrumental,
        originalFilePath,
        durationSeconds: response.extra_info?.music_duration || null,
        sampleRate: response.extra_info?.music_sample_rate || 44100,
        bitrate: response.extra_info?.bitrate || 256000,
        format: 'mp3',
      });

      // Increment project version
      ProjectModel.incrementVersion(projectId, 'music');

      logger.info('Music generated successfully', { musicId: musicRecord.id, version });

      return musicRecord;
    } catch (error) {
      logger.error('Failed to generate music', { projectId: params.projectId, error: error.message });
      throw new Error(`Music generation failed: ${error.message}`);
    }
  }

  async getMusic(musicId) {
    return MusicModel.findById(musicId);
  }

  async getProjectMusic(projectId) {
    return MusicModel.findByProject(projectId);
  }

  async updateMusicMetadata(musicId, metadata) {
    const { processedFilePath, durationSeconds, bitrate } = metadata;

    return MusicModel.update(musicId, {
      processedFilePath,
      durationSeconds,
      bitrate,
    });
  }
}