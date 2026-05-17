import MinimaxClient from '../../utils/minimax.client.js';
import { VideoModel } from './video.model.js';
import { MusicModel } from '../../database/models/music.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import config from '../../config/env.config.js';
import logger from '../../utils/logger.js';
import axios from 'axios';

export class VideoService {
  constructor() {
    this.client = new MinimaxClient(config.minimax.apiKey, config.minimax.baseURL);
  }

  /**
   * Start video generation - calls MiniMax API to initiate async generation
   * @param {Object} params - { projectId, musicId, prompt, model, duration, resolution }
   * @returns {Object} - { videoId, taskId, status: 'processing' }
   */
  async generateVideo(params) {
    try {
      const { projectId, musicId, prompt, model = 'MiniMax-Hailuo-2.3',
        duration = 6, resolution = '1080P' } = params;

      // Validate projectId
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Project ID is required and must be a string');
      }

      // Validate model
      const validModels = ['MiniMax-Hailuo-2.3', 'MiniMax-Hailuo-02'];
      if (!validModels.includes(model)) {
        throw new Error(`Invalid model. Must be one of: ${validModels.join(', ')}`);
      }

      // Validate duration (MiniMax supports 5s or 6s)
      if (![5, 6].includes(duration)) {
        throw new Error('Duration must be 5 or 6 seconds');
      }

      // Validate resolution
      const validResolutions = ['1080P', '720P'];
      if (!validResolutions.includes(resolution)) {
        throw new Error(`Invalid resolution. Must be one of: ${validResolutions.join(', ')}`);
      }

      // Get music file if musicId provided
      let musicFilePath = null;
      if (musicId) {
        const music = MusicModel.findById(musicId);
        if (!music) {
          const err = new Error(`Music not found: ${musicId}`);
          err.statusCode = 404;
          throw err;
        }
        // Use processed file if available, otherwise original
        musicFilePath = music.processed_file_path || music.original_file_path;
        if (!musicFilePath) {
          throw new Error('Music file not available yet');
        }
      }

      logger.info('Starting video generation', { projectId, musicId, model, duration, resolution });

      // Build request to MiniMax
      const requestParams = {
        model,
        duration,
        resolution,
      };

      // Add prompt if provided
      if (prompt) {
        requestParams.prompt = prompt;
      }

      // Add music reference if available
      if (musicFilePath) {
        // Read music file and upload to MiniMax for audio-aware video generation
        const musicBuffer = storage.readFile(musicFilePath);
        const musicBase64 = musicBuffer.toString('base64');
        requestParams.audio_file = musicBase64;
      }

      logger.info('MiniMax video request', {
        endpoint: '/v1/video_generation',
        model: requestParams.model,
        duration: requestParams.duration,
        resolution: requestParams.resolution,
        hasPrompt: !!requestParams.prompt,
        hasAudio: !!requestParams.audio_file,
      });

      // Call MiniMax API (async - returns task_id immediately)
      const response = await this.client.generateVideo(requestParams);

      logger.info('MiniMax response received', { responseKeys: Object.keys(response || {}) });

      // Validate response — client returns axios response.data directly (no extra .data nesting)
      if (!response) {
        throw new Error('Invalid response from MiniMax API: empty response');
      }

      const taskId = response.task_id;
      if (!taskId) {
        throw new Error('Invalid response: task_id not found');
      }

      // Get next version number
      const version = VideoModel.getNextVersion(projectId);

      // Create database record
      const videoRecord = VideoModel.create({
        projectId,
        musicId: musicId || null,
        version,
        model,
        prompt: prompt || null,
        duration,
        resolution,
        taskId,
        status: 'processing',
      });

      // Increment project version
      ProjectModel.incrementVersion(projectId, 'video');

      logger.info('Video generation started', { videoId: videoRecord.id, taskId, version });

      return {
        videoId: videoRecord.id,
        taskId,
        status: 'processing',
      };
    } catch (error) {
      logger.error('Failed to start video generation', { projectId: params.projectId, error: error.message });
      if (error.name === 'MinimaxError' || error.statusCode) {
        throw error;
      }
      throw new Error(`Video generation failed: ${error.message}`);
    }
  }

  /**
   * Poll video status until completed
   * @param {string} taskId - MiniMax task ID
   * @returns {Object} - { status, progress, fileId, filePath }
   */
  async pollStatus(taskId) {
    if (!taskId || typeof taskId !== 'string') {
      throw new Error('taskId must be a non-empty string');
    }

    logger.info('Polling video status', { taskId });

    try {
      const response = await this.client.queryVideoStatus(taskId);

      if (!response) {
        throw new Error('Invalid response from MiniMax API');
      }

      // Client returns axios response.data directly — no nested .data
      const statusData = response;
      const status = statusData.status;

      // Find video record by task_id
      const videoRecord = VideoModel.findByTaskId(taskId);

      if (!videoRecord) {
        throw new Error(`Video record not found for task: ${taskId}`);
      }

      // Map MiniMax status to our status
      let ourStatus = 'processing';
      let progress = 0;
      let fileId = null;
      let filePath = null;
      let errorMessage = null;

      if (status && status.toUpperCase() === 'SUCCESS') {
        ourStatus = 'completed';
        progress = 100;
        fileId = statusData.file_id;

        // Download the video file
        if (fileId) {
          const projectId = videoRecord.project_id;
          const version = videoRecord.version;
          const outputPath = storage.getVideoFilePath(projectId, version);
          await this.downloadVideo(fileId, outputPath);
          filePath = outputPath;
        }
      } else if (status && (status.toUpperCase() === 'FAIL' || status.toUpperCase() === 'FAILED')) {
        ourStatus = 'failed';
        errorMessage = statusData.error_message || 'Video generation failed';
      } else {
        // Still processing - estimate progress based on status
        ourStatus = 'processing';
        progress = statusData.progress || 50;
      }

      // Update video record
      VideoModel.update(videoRecord.id, {
        status: ourStatus,
        fileId,
        filePath,
        errorMessage,
        completedAt: ourStatus === 'completed' ? new Date().toISOString() : null,
      });

      logger.info('Video status updated', { taskId, status: ourStatus, progress });

      return {
        status: ourStatus,
        progress,
        fileId,
        filePath,
        errorMessage,
      };
    } catch (error) {
      logger.error('Failed to poll video status', { taskId, error: error.message });
      throw error;
    }
  }

  /**
   * Download video from MiniMax and save locally
   * @param {string} fileId - MiniMax file ID
   * @param {string} outputPath - Local path to save the file
   * @returns {string} - Local file path
   */
  async downloadVideo(fileId, outputPath) {
    if (!fileId || typeof fileId !== 'string') {
      throw new Error('fileId must be a non-empty string');
    }
    if (!outputPath || typeof outputPath !== 'string') {
      throw new Error('outputPath must be a non-empty string');
    }

    logger.info('Downloading video', { fileId, outputPath });

    try {
      const response = await this.client.retrieveFile(fileId);

      // Client returns axios response.data — response.file.download_url has the URL
      if (!response || !response.file) {
        throw new Error('Invalid response from MiniMax file retrieve API');
      }

      const downloadUrl = response.file.download_url;
      if (!downloadUrl) {
        throw new Error('No download_url in file retrieve response');
      }

      // Download video from URL
      const videoResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
      const videoBuffer = Buffer.from(videoResponse.data);

      // Ensure output directory exists
      const fs = await import('fs');
      const dir = outputPath.substring(0, outputPath.lastIndexOf('/'));
      fs.default.mkdirSync(dir, { recursive: true });
      fs.default.writeFileSync(outputPath, videoBuffer);

      logger.info('Video downloaded successfully', { fileId, size: videoBuffer.length });

      return outputPath;
    } catch (error) {
      logger.error('Failed to download video', { fileId, error: error.message });
      throw new Error(`Video download failed: ${error.message}`);
    }
  }

  /**
   * Get video by ID
   */
  getVideo(videoId) {
    return VideoModel.findById(videoId);
  }

  /**
   * Get all videos for a project
   */
  getProjectVideos(projectId) {
    return VideoModel.findByProject(projectId);
  }

  /**
   * Get all videos for a music track
   */
  getMusicVideos(musicId) {
    return VideoModel.findByMusic(musicId);
  }
}