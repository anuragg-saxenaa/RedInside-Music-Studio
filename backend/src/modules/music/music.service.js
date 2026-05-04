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
      const { projectId, lyricsId, prompt, model = 'M2',
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
      const validModels = ['M2', 'M2-raw'];
      if (!validModels.includes(model)) {
        throw new Error(`Invalid model. Must be one of: ${validModels.join(', ')}`);
      }

      logger.info('Generating music', { projectId, lyricsId, model, isInstrumental });

      // Build request to MiniMax
      const requestParams = {
        model,
        audio_setting: audioSettings || {},
      };

      if (isInstrumental) {
        requestParams.instrumental = true;
        if (prompt) {
          requestParams.prompt = prompt;
        }
      } else {
        requestParams.lyrics = lyricsContent;
        if (prompt) {
          requestParams.prompt = prompt;
        }
      }

      // Call MiniMax API
      const response = await this.client.generateMusic(requestParams);

      // Validate response
      if (!response || !response.audio_file || !response.task_id) {
        throw new Error('Invalid response from MiniMax API: missing required fields');
      }

      // Get next version number
      const version = MusicModel.getNextVersion(projectId);

      // Download audio file
      const audioFileId = response.audio_file.file_id;
      const fileResponse = await this.client.retrieveFile(audioFileId);

      if (!fileResponse || !fileResponse.audio_content) {
        throw new Error('Failed to retrieve audio file from MiniMax API');
      }

      // Convert base64 to buffer and save
      const audioBuffer = Buffer.from(fileResponse.audio_content, 'base64');

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
        durationSeconds: response.audio_file.duration || null,
        sampleRate: response.audio_file.sample_rate || 44100,
        bitrate: response.audio_file.bitrate || 256000,
        format: response.audio_file.format || 'mp3',
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