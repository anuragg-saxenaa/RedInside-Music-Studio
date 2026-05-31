import MinimaxClient from '../../utils/minimax.client.js';
import { MusicModel } from '../../database/models/music.model.js';
import { LyricsModel } from '../../database/models/lyrics.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import { SettingsModel } from '../../database/models/settings.model.js';
import storage from '../../utils/storage.util.js';
import config from '../../config/env.config.js';
import logger from '../../utils/logger.js';
import axios from 'axios';
import fs from 'fs';
import { execSync } from 'child_process';
import { AudioMasteringService } from '../mastering/mastering.service.js';

export class MusicService {
  constructor() {
    this.client = new MinimaxClient(config.minimax.apiKey, config.minimax.baseURL);
  }

  async generateMusic(params) {
    try {
      const { projectId, lyricsId, audioUrl: referenceAudioUrl, filePath, prompt, model = 'music-2.6',
        isInstrumental = false, audioSettings, voice, language } = params;

      // Validate projectId
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      // Validate lyricsId (optional for instrumental or cover mode)
      let lyricsContent = null;
      let lyricsTitle = null;
      if (lyricsId) {
        const lyrics = await LyricsModel.findById(lyricsId);
        if (!lyrics) {
          const err = new Error(`Lyrics not found: ${lyricsId}`);
          err.statusCode = 404;
          throw err;
        }
        lyricsContent = lyrics.content;
        // Name the track after the lyric (+ its song version) so origin is obvious
        if (lyrics.title) {
          lyricsTitle = (lyrics.song_version && lyrics.song_version > 1)
            ? `${lyrics.title} (v${lyrics.song_version})`
            : lyrics.title;
        }
      } else if (!isInstrumental && !referenceAudioUrl && !filePath) {
        throw new Error('Lyrics ID or audio URL/file is required for non-instrumental music');
      }

      // Validate model
      const validModels = ['music-2.6', 'music-cover'];
      if (!validModels.includes(model)) {
        throw new Error(`Invalid model. Must be one of: ${validModels.join(', ')}`);
      }

      logger.info('Generating music', { projectId, lyricsId, model, isInstrumental });

      // Build request to MiniMax with URL format
      const requestParams = {
        model,
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: 'wav',
        },
        output_format: 'url',
        ...(voice && { voice }),
        ...(language && { language }),
      };

      if (isInstrumental) {
        requestParams.is_instrumental = true;
        if (prompt) {
          requestParams.prompt = prompt;
        }
      } else if (model === 'music-cover') {
        // Cover mode: two-step process
        let coverFeatureId = null;
        if (filePath) {
          const fileBuffer = fs.readFileSync(filePath);
          const audioBase64 = fileBuffer.toString('base64');
          logger.info('Calling preprocess with base64 audio', { fileSize: fileBuffer.length });
          const preprocessResult = await this.client.musicCoverPreprocess({ audioBase64 });
          coverFeatureId = preprocessResult.data?.cover_feature_id;
          logger.info('Cover preprocess result', { coverFeatureId, preprocessResult });
        } else if (referenceAudioUrl) {
          const preprocessResult = await this.client.musicCoverPreprocess({ audioUrl: referenceAudioUrl });
          coverFeatureId = preprocessResult.data?.cover_feature_id;
        }

        if (!coverFeatureId) {
          throw new Error('Failed to preprocess audio for cover mode');
        }

        requestParams.audio_url = coverFeatureId;
        if (prompt) {
          requestParams.prompt = prompt;
        }
      } else {
        if (!lyricsContent) {
          throw new Error('Lyrics content is empty');
        }
        if (prompt) {
          requestParams.prompt = prompt;
        }
        requestParams.lyrics = lyricsContent;
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

      // Validate response
      if (!response || !response.data) {
        throw new Error('Invalid response from MiniMax API: missing data field');
      }

      if (response.data.status !== 2) {
        throw new Error(`Music generation not ready, status: ${response.data.status}`);
      }

      // Get audio URL from response
      const audioUrl = response.data.audio;
      if (!audioUrl || typeof audioUrl !== 'string') {
        throw new Error('Invalid response: audio URL not found');
      }

      logger.info('Downloading audio from URL', { audioUrl: audioUrl.substring(0, 50) + '...' });

      // Download file from URL
      const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
      const audioBuffer = Buffer.from(audioResponse.data);

      // Get next version number
      const version = await MusicModel.getNextVersion(projectId);

      // Create project directories if they don't exist
      storage.createProjectDirs(projectId);

      // Always use R2-key format so both local and cloud can serve the file
      const r2Key = `projects/${projectId}/generations/music/v${version}-original.mp3`;

      // Upload to R2 (always — so cloud can play locally-generated tracks)
      try { await storage.saveAudioFile(audioBuffer, r2Key); } catch (e) { logger.warn('R2 upload failed', { error: e.message }); }

      // Also save to local disk at matching path for local playback
      const { default: path } = await import('path');
      const localPath = path.join(storage.basePath, r2Key);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, audioBuffer);

      // Store R2 key in DB (works for both local and cloud serving)
      const originalFilePath = r2Key;

      // Resolve duration
      const extraInfo = response.extra_info;
      let durationSeconds = extraInfo?.music_duration
        ? extraInfo.music_duration / 1000
        : null;
      if (!durationSeconds) {
        try {
          const out = execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localPath}"`,
            { encoding: 'utf8' }
          ).trim();
          const parsed = parseFloat(out);
          if (!isNaN(parsed)) durationSeconds = parsed;
        } catch (_) { /* ffprobe unavailable — leave null */ }
      }

      // Create database record
      const musicRecord = await MusicModel.create({
        projectId,
        lyricsId: lyricsId || null,
        version,
        model,
        title: lyricsTitle || (isInstrumental ? `Instrumental v${version}` : null),
        prompt: prompt || null,
        audioSettings,
        isInstrumental,
        originalFilePath,
        durationSeconds,
        sampleRate: extraInfo?.music_sample_rate || 44100,
        bitrate: extraInfo?.bitrate || 256000,
        format: 'mp3',
      });

      // Auto-master to Spotify quality if setting enabled (default: true)
      const settingRow = await SettingsModel.get('auto_ffmpeg_320kbps');
      const autoMaster = settingRow?.value !== 'false';
      if (autoMaster) {
        const masterR2Key = `projects/${projectId}/masters/v${version}_spotify_master.wav`;
        const masterLocalPath = path.join(storage.basePath, masterR2Key);
        fs.mkdirSync(path.dirname(masterLocalPath), { recursive: true });
        const masteringService = new AudioMasteringService(storage.getMastersDir(projectId));

        try {
          await masteringService.masterToSpotify(localPath, masterLocalPath);
          // Upload mastered file to R2
          const masterBuf = fs.readFileSync(masterLocalPath);
          try { await storage.saveAudioFile(masterBuf, masterR2Key); } catch (e) { logger.warn('R2 master upload failed', { error: e.message }); }
          await MusicModel.update(musicRecord.id, { processedFilePath: masterR2Key });
        } catch (err) {
          console.error('Auto-mastering failed:', err);
        }
      }

      // Increment project version
      await ProjectModel.incrementVersion(projectId, 'music');

      logger.info('Music generated successfully', { musicId: musicRecord.id, version });

      return musicRecord;
    } catch (error) {
      logger.error('Failed to generate music', { projectId: params.projectId, error: error.message });
      if (error.name === 'MinimaxError' || error.statusCode) {
        throw error;
      }
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
    const { processedFilePath, durationSeconds, bitrate, title,
            artist, genre, year, trackNumber, composer, lyricsCredit } = metadata;

    return MusicModel.update(musicId, {
      processedFilePath,
      durationSeconds,
      bitrate,
      title,
      artist,
      genre,
      year,
      trackNumber,
      composer,
      lyricsCredit,
    });
  }

  async deleteMusic(musicId) {
    const music = await MusicModel.findById(musicId);
    if (!music) {
      const err = new Error('Music not found');
      err.statusCode = 404;
      throw err;
    }
    return MusicModel.delete(musicId);
  }
}
