import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import logger from '../../utils/logger.js';

/**
 * Track options for medley tracks
 * @typedef {Object} TrackOptions
 * @property {number} [trimStart=0] - Start time in seconds
 * @property {number} [trimEnd] - End time in seconds (null = end of track)
 * @property {number} [speed=1.0] - Playback speed multiplier
 * @property {number} [volume=1.0] - Volume multiplier
 * @property {number} [fadeIn=0] - Fade in duration in seconds
 * @property {number} [fadeOut=0] - Fade out duration in seconds
 */

/**
 * Export options for medley export
 * @typedef {Object} ExportOptions
 * @property {string} [format='mp3'] - Output format (mp3, wav, aac, flac)
 * @property {string} [bitrate='320k'] - Audio bitrate
 * @property {boolean} [fadeOutFinal=0] - Final fade out duration in seconds
 */

/**
 * Export result object
 * @typedef {Object} ExportResult
 * @property {string} filePath - Path to exported file
 * @property {number} duration - Total duration in seconds
 * @property {number} trackCount - Number of tracks combined
 */

/**
 * MedleyProcessor - Combines multiple audio tracks into a single medley
 *
 * Usage:
 *   const processor = new MedleyProcessor();
 *   processor.addTrack('/path/to/track1.mp3', { trimStart: 10, trimEnd: 30 })
 *            .addTrack('/path/to/track2.mp3', { volume: 0.8 })
 *            .reorderTracks(0, 2);
 *   const result = await processor.exportMedley('/output/final.mp3');
 */
export class MedleyProcessor {
  /**
   * Create a MedleyProcessor instance
   */
  constructor() {
    /** @type {Array<{filePath: string, trimStart: number, trimEnd: number, speed: number, volume: number, fadeIn: number, fadeOut: number}>} */
    this.tracks = [];
  }

  /**
   * Add a track to the medley
   * @param {string} filePath - Path to audio file
   * @param {TrackOptions} [options={}] - Track options
   * @returns {MedleyProcessor} - this (for chaining)
   */
  addTrack(filePath, options = {}) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('filePath is required and must be a string');
    }

    const track = {
      filePath,
      trimStart: options.trimStart ?? 0,
      trimEnd: options.trimEnd ?? null,
      speed: options.speed ?? 1.0,
      volume: options.volume ?? 1.0,
      fadeIn: options.fadeIn ?? 0,
      fadeOut: options.fadeOut ?? 0,
    };

    this.tracks.push(track);
    return this;
  }

  /**
   * Remove a track by index
   * @param {number} index - Track index to remove
   * @returns {MedleyProcessor} - this (for chaining)
   */
  removeTrack(index) {
    if (index < 0 || index >= this.tracks.length) {
      throw new Error(`Invalid track index: ${index}`);
    }
    this.tracks.splice(index, 1);
    return this;
  }

  /**
   * Reorder tracks by moving from one index to another
   * @param {number} fromIndex - Source track index
   * @param {number} toIndex - Destination track index
   * @returns {MedleyProcessor} - this (for chaining)
   */
  reorderTracks(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.tracks.length) {
      throw new Error(`Invalid fromIndex: ${fromIndex}`);
    }
    if (toIndex < 0 || toIndex >= this.tracks.length) {
      throw new Error(`Invalid toIndex: ${toIndex}`);
    }
    if (fromIndex === toIndex) {
      return this;
    }

    const [track] = this.tracks.splice(fromIndex, 1);
    this.tracks.splice(toIndex, 0, track);
    return this;
  }

  /**
   * Update track options
   * @param {number} index - Track index to update
   * @param {Partial<TrackOptions>} options - Options to update
   * @returns {MedleyProcessor} - this (for chaining)
   */
  updateTrack(index, options) {
    if (index < 0 || index >= this.tracks.length) {
      throw new Error(`Invalid track index: ${index}`);
    }

    const track = this.tracks[index];
    if (options.trimStart !== undefined) track.trimStart = options.trimStart;
    if (options.trimEnd !== undefined) track.trimEnd = options.trimEnd;
    if (options.speed !== undefined) track.speed = options.speed;
    if (options.volume !== undefined) track.volume = options.volume;
    if (options.fadeIn !== undefined) track.fadeIn = options.fadeIn;
    if (options.fadeOut !== undefined) track.fadeOut = options.fadeOut;

    return this;
  }

  /**
   * Clear all tracks
   * @returns {MedleyProcessor} - this (for chaining)
   */
  clearTracks() {
    this.tracks = [];
    return this;
  }

  /**
   * Get duration of a single track with options applied
   * @param {Object} track - Track object
   * @returns {Promise<number>} - Duration in seconds
   */
  async _getTrackDuration(track) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(track.filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get track duration: ${err.message}`));
          return;
        }
        let duration = metadata.format.duration || 0;

        // Apply trim
        if (track.trimEnd !== null) {
          duration = track.trimEnd - track.trimStart;
        } else {
          duration -= track.trimStart;
        }

        // Apply speed (duration / speed = actual duration after speed change)
        duration = duration / track.speed;

        resolve(Math.max(0, duration));
      });
    });
  }

  /**
   * Process individual track with all options applied
   * @param {Object} track - Track object
   * @param {string} outputPath - Output path for processed track
   * @returns {Promise<string>} - Path to processed file
   */
  async _processTrack(track, outputPath) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(track.filePath);

      const filters = [];

      // Apply trim via seekInput and duration
      const startTime = track.trimStart || 0;
      let duration;
      if (track.trimEnd !== null) {
        duration = track.trimEnd - startTime;
      }

      if (duration !== undefined) {
        command = command.seekInput(startTime).duration(duration);
      } else if (startTime > 0) {
        command = command.seekInput(startTime);
      }

      // Apply speed
      if (track.speed !== 1.0) {
        const speedFactor = track.speed;
        if (speedFactor >= 0.5 && speedFactor <= 2.0) {
          filters.push(`atempo=${speedFactor}`);
        } else if (speedFactor < 0.5) {
          const chainCount = Math.ceil(Math.log(0.5 / speedFactor) / Math.log(0.5));
          let remaining = speedFactor;
          for (let i = 0; i < chainCount; i++) {
            const factor = i === chainCount - 1 ? (0.5 / remaining) : 0.5;
            filters.push(`atempo=${factor}`);
            remaining /= factor;
          }
        } else {
          const chainCount = Math.ceil(Math.log(speedFactor / 2) / Math.log(2));
          let remaining = speedFactor;
          for (let i = 0; i < chainCount; i++) {
            const factor = i === chainCount - 1 ? (2 * remaining) : 2;
            filters.push(`atempo=${factor}`);
            remaining *= factor;
          }
        }
      }

      // Apply volume
      if (track.volume !== 1.0) {
        filters.push(`volume=${track.volume}`);
      }

      // Apply fade in
      if (track.fadeIn > 0) {
        filters.push(`afade=t=in:st=0:d=${track.fadeIn}`);
      }

      // Apply fade out
      if (track.fadeOut > 0) {
        // For fade out, we need to know the duration
        // We'll handle this after we know duration
        command = command.on('end', () => {
          // After processing, add fade out if needed
          resolve(outputPath);
        });
      }

      // Apply filters
      if (filters.length > 0) {
        command = command.audioFilters(filters);
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      fsSync.mkdirSync(outputDir, { recursive: true });

      command
        .on('start', (commandLine) => {
          logger.debug('MedleyProcessor track command:', commandLine);
        })
        .on('error', (err, stdout, stderr) => {
          logger.error('MedleyProcessor track processing failed', { error: err.message });
          reject(new Error(`Track processing failed: ${err.message}`));
        })
        .on('end', () => {
          logger.info('Track processed successfully', { outputPath });
          resolve(outputPath);
        })
        .save(outputPath);
    });
  }

  /**
   * Export the medley by combining all tracks
   * @param {string} outputPath - Path for output file
   * @param {ExportOptions} [options={}] - Export options
   * @returns {Promise<ExportResult>} - Export result
   */
  async exportMedley(outputPath, options = {}) {
    const { format = 'mp3', bitrate = '320k', fadeOutFinal = 0 } = options;

    if (this.tracks.length === 0) {
      throw new Error('No tracks to export');
    }

    logger.info('Starting medley export', {
      trackCount: this.tracks.length,
      outputPath,
      format,
    });

    // Create temp directory
    const tempDir = path.join(os.tmpdir(), `medley-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Process each track and store paths
      const processedTracks = [];

      for (let i = 0; i < this.tracks.length; i++) {
        const track = this.tracks[i];
        const processedPath = path.join(tempDir, `track-${i}.${format}`);

        logger.info(`Processing track ${i + 1}/${this.tracks.length}`, {
          filePath: track.filePath,
          trimStart: track.trimStart,
          trimEnd: track.trimEnd,
          speed: track.speed,
          volume: track.volume,
        });

        await this._processTrack(track, processedPath);
        processedTracks.push(processedPath);
      }

      // Create concat file for FFmpeg
      const concatFilePath = path.join(tempDir, 'concat.txt');
      let concatContent = '';
      for (const trackPath of processedTracks) {
        // Escape single quotes in path
        const escapedPath = trackPath.replace(/'/g, "'\\''");
        concatContent += `file '${escapedPath}'\n`;
      }
      await fs.writeFile(concatFilePath, concatContent);

      // Concatenate all tracks
      const finalOutputPath = outputPath;
      const outputDir = path.dirname(finalOutputPath);
      await fs.mkdir(outputDir, { recursive: true });

      logger.info('Concatenating tracks', { trackCount: processedTracks.length });

      await new Promise((resolve, reject) => {
        let command = ffmpeg()
          .input(concatFilePath)
          .inputFormat('concat')
          .audioCodec('libmp3lame');

        if (bitrate) {
          command = command.audioBitrate(bitrate);
        }

        // Apply final fade out if specified
        if (fadeOutFinal > 0) {
          // We need to calculate when to start fade out based on total duration
          // We'll add it as a filter
          command = command.audioFilters(`afade=t=out:st=-${fadeOutFinal}:d=${fadeOutFinal}`);
        }

        command
          .on('start', (commandLine) => {
            logger.debug('MedleyProcessor concat command:', commandLine);
          })
          .on('error', (err, stdout, stderr) => {
            logger.error('MedleyProcessor concat failed', { error: err.message });
            reject(new Error(`Concat failed: ${err.message}`));
          })
          .on('end', () => {
            logger.info('Medley export completed', { outputPath: finalOutputPath });
            resolve();
          })
          .save(finalOutputPath);
      });

      // Get final duration
      const finalDuration = await this._getFinalDuration(finalOutputPath);

      return {
        filePath: finalOutputPath,
        duration: finalDuration,
        trackCount: this.tracks.length,
      };
    } finally {
      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        logger.warn('Failed to clean up temp directory', { error: err.message });
      }
    }
  }

  /**
   * Get final duration of exported file
   * @param {string} filePath - Path to file
   * @returns {Promise<number>} - Duration in seconds
   */
  _getFinalDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get final duration: ${err.message}`));
          return;
        }
        resolve(metadata.format.duration || 0);
      });
    });
  }

  /**
   * Get total duration of the medley without exporting
   * @returns {Promise<number>} - Total duration in seconds
   */
  async getTotalDuration() {
    let total = 0;
    for (const track of this.tracks) {
      const duration = await this._getTrackDuration(track);
      total += duration;
    }
    return total;
  }

  /**
   * Get information about all tracks
   * @returns {Promise<Array<Object>>} - Array of track info
   */
  async getTrackInfo() {
    const infos = [];
    for (const track of this.tracks) {
      const duration = await this._getTrackDuration(track);
      infos.push({
        filePath: track.filePath,
        originalDuration: await this._getOriginalDuration(track.filePath),
        effectiveDuration: duration,
        trimStart: track.trimStart,
        trimEnd: track.trimEnd,
        speed: track.speed,
        volume: track.volume,
        fadeIn: track.fadeIn,
        fadeOut: track.fadeOut,
      });
    }
    return infos;
  }

  /**
   * Get original duration of a file
   * @param {string} filePath - Path to file
   * @returns {Promise<number>} - Duration in seconds
   */
  _getOriginalDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get duration: ${err.message}`));
          return;
        }
        resolve(metadata.format.duration || 0);
      });
    });
  }
}

export default MedleyProcessor;