import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';
import storage from '../../utils/storage.util.js';
import logger from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class FFmpegService {
  constructor() {
    // Set ffmpeg path if provided in config
    // fluent-ffmpeg will auto-detect system ffmpeg
  }

  /**
   * Convert audio file to 320kbps MP3
   * @param {string} inputPath - Path to input audio file
   * @param {string} outputPath - Path to output audio file
   * @returns {Promise<{duration: number, bitrate: number}>}
   */
  convertTo320kbps(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      logger.info('Converting audio to 320kbps', { inputPath, outputPath });

      ffmpeg(inputPath)
        .audioBitrate(320)
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('start', (commandLine) => {
          logger.debug('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            logger.debug(`FFmpeg progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', (stdout, stderr) => {
          logger.info('Audio conversion completed', { outputPath });
          resolve({
            duration: null, // Will be determined separately
            bitrate: 320,
          });
        })
        .on('error', (err, stdout, stderr) => {
          logger.error('FFmpeg conversion failed', { error: err.message });
          reject(new Error(`FFmpeg conversion failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  /**
   * Get audio metadata without transcoding
   * @param {string} filePath - Path to audio file
   * @returns {Promise<{duration: number, bitrate: number, format: string, sampleRate: number}>}
   */
  getMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.error('FFprobe failed', { error: err.message, filePath });
          reject(new Error(`Failed to get audio metadata: ${err.message}`));
          return;
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        if (!audioStream) {
          reject(new Error('No audio stream found in file'));
          return;
        }

        resolve({
          duration: metadata.format.duration || 0,
          bitrate: metadata.format.bit_rate || 0,
          format: metadata.format.format_name || 'unknown',
          sampleRate: audioStream.sample_rate || 44100,
        });
      });
    });
  }

  /**
   * Process music file: convert to 320kbps and update metadata
   * @param {string} projectId - Project ID
   * @param {string} musicId - Music generation ID
   * @param {string} inputPath - Path to original audio file
   * @returns {Promise<{processedFilePath: string, metadata: object}>}
   */
  async processMusicFile(projectId, musicId, inputPath) {
    try {
      const version = path.basename(inputPath, path.extname(inputPath)).split('-').pop() || '1';
      const outputPath = storage.getMusicFilePath(projectId, parseInt(version), 'processed');

      // Convert to 320kbps
      await this.convertTo320kbps(inputPath, outputPath);

      // Get metadata
      const metadata = await this.getMetadata(outputPath);

      logger.info('Music file processed', { musicId, outputPath, metadata });

      return {
        processedFilePath: outputPath,
        metadata,
      };
    } catch (error) {
      logger.error('Failed to process music file', { musicId, error: error.message });
      throw error;
    }
  }

  /**
   * Process music with version tracking
   * @param {object} params - Parameters
   * @param {string} params.projectId - Project ID
   * @param {string} params.musicId - Music generation ID
   * @param {string} params.originalFilePath - Path to original file
   * @returns {Promise<object>} - Updated music record
   */
  async processMusic(params) {
    const { projectId, musicId, originalFilePath } = params;

    // Get music record to verify
    const { MusicModel } = await import('../../database/models/music.model.js');
    const music = MusicModel.findById(musicId);

    if (!music) {
      throw new Error(`Music not found: ${musicId}`);
    }

    if (!originalFilePath && music.original_file_path) {
      originalFilePath = music.original_file_path;
    }

    // Process the file
    const result = await this.processMusicFile(projectId, musicId, originalFilePath);

    // Update music record with processed file info
    const updatedRecord = MusicModel.update(musicId, {
      processedFilePath: result.processedFilePath,
      durationSeconds: result.metadata.duration,
      bitrate: result.metadata.bitrate,
    });

    return updatedRecord;
  }
}

export default new FFmpegService();