import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import logger from '../../utils/logger.js';

/**
 * AudioProcessor - Chainable audio processing operations using FFmpeg
 *
 * Usage:
 *   const result = await new AudioProcessor('input.mp3')
 *     .trim(10, 30)
 *     .speed(1.5)
 *     .volume(0.8)
 *     .fadeIn(3)
 *     .fadeOut(5)
 *     .export('output.mp3');
 */
export class AudioProcessor {
  /**
   * Create an AudioProcessor instance
   * @param {string} inputPath - Path to input audio file
   */
  constructor(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Input path is required and must be a string');
    }
    this.inputPath = inputPath;
    this._operations = [];
    this._filters = [];
  }

  /**
   * Trim audio to a specific segment
   * @param {number} startSec - Start time in seconds
   * @param {number} endSec - End time in seconds
   * @returns {AudioProcessor} - this (for chaining)
   */
  trim(startSec, endSec) {
    if (typeof startSec !== 'number' || startSec < 0) {
      throw new Error('startSec must be a non-negative number');
    }
    if (typeof endSec !== 'number' || endSec <= startSec) {
      throw new Error('endSec must be a number greater than startSec');
    }
    this._operations.push({ type: 'trim', startSec, endSec });
    return this;
  }

  /**
   * Change playback speed
   * @param {number} tempoFactor - Speed multiplier (0.5 = half speed, 2 = double speed)
   * @returns {AudioProcessor} - this (for chaining)
   */
  speed(tempoFactor) {
    if (typeof tempoFactor !== 'number' || tempoFactor <= 0 || tempoFactor > 10) {
      throw new Error('tempoFactor must be a number between 0.01 and 10');
    }
    this._operations.push({ type: 'speed', tempoFactor });
    return this;
  }

  /**
   * Adjust volume
   * @param {number} gain - Volume gain (1.0 = normal, 0.5 = half, 2.0 = double)
   * @returns {AudioProcessor} - this (for chaining)
   */
  volume(gain) {
    if (typeof gain !== 'number' || gain <= 0 || gain > 100) {
      throw new Error('gain must be a number between 0.01 and 100');
    }
    this._operations.push({ type: 'volume', gain });
    return this;
  }

  /**
   * Add fade in effect at the start
   * @param {number} durationSec - Fade in duration in seconds
   * @returns {AudioProcessor} - this (for chaining)
   */
  fadeIn(durationSec) {
    if (typeof durationSec !== 'number' || durationSec <= 0) {
      throw new Error('durationSec must be a positive number');
    }
    this._operations.push({ type: 'fadeIn', durationSec });
    return this;
  }

  /**
   * Add fade out effect at the end
   * @param {number} durationSec - Fade out duration in seconds
   * @returns {AudioProcessor} - this (for chaining)
   */
  fadeOut(durationSec) {
    if (typeof durationSec !== 'number' || durationSec <= 0) {
      throw new Error('durationSec must be a positive number');
    }
    this._operations.push({ type: 'fadeOut', durationSec });
    return this;
  }

  /**
   * Reverse audio playback (play backwards)
   * @returns {AudioProcessor} - this (for chaining)
   */
  reverse() {
    this._operations.push({ type: 'reverse' });
    return this;
  }

  normalize(targetLUFS = -14) {
    this._operations.push({ type: 'normalize', targetLUFS });
    return this;
  }

  reverb(roomScale = 50, damping = 50, wetLevel = 0.3) {
    this._operations.push({ type: 'reverb', roomScale, damping, wetLevel });
    return this;
  }

  echo(delay = 0.3, decay = 0.5) {
    this._operations.push({ type: 'echo', delay, decay });
    return this;
  }

  bassBoost(gainDb = 6) {
    this._operations.push({ type: 'bassBoost', gainDb });
    return this;
  }

  pitchShift(semitones) {
    if (typeof semitones !== 'number' || semitones < -12 || semitones > 12) {
      throw new Error('semitones must be a number between -12 and 12');
    }
    this._operations.push({ type: 'pitchShift', semitones });
    return this;
  }

  /**
   * Build FFmpeg command from operations
   * @param {string} outputPath - Output file path
   * @returns {ffmpeg.FfmpegCommand} - Configured FFmpeg command
   */
  _buildCommand(outputPath) {
    let command = ffmpeg(this.inputPath);

    // Track timing for filters that need absolute positions
    let currentTime = 0;
    let speedFactor = 1.0;

    for (const op of this._operations) {
      switch (op.type) {
        case 'trim':
          command = command.seekInput(op.startSec).duration(op.endSec - op.startSec);
          currentTime = op.startSec;
          break;

        case 'speed':
          speedFactor *= op.tempoFactor;
          break;

        case 'volume':
          this._filters.push(`volume=${op.gain}`);
          break;

        case 'fadeIn':
          // Fade in uses absolute time, need to account for any seek
          this._filters.push(`afade=t=in:st=${currentTime}:d=${op.durationSec}`);
          break;

        case 'fadeOut': {
          // For fade out, we need to know the total duration
          // We'll calculate this in export after we know duration
          this._fadeOutDuration = op.durationSec;
          this._fadeOutStartTime = currentTime;
          break;
        }

        case 'reverse':
          break;

        case 'normalize':
          this._filters.push(`loudnorm=I=${op.targetLUFS}:TP=-1.5:LRA=11`);
          break;

        case 'reverb': {
          const wet = Math.min(1, Math.max(0, op.wetLevel));
          const dry = 1 - wet;
          this._filters.push(`aecho=${dry}:${wet}:${Math.round(op.roomScale * 5)}:${1 - op.damping / 100}`);
          break;
        }

        case 'echo':
          this._filters.push(`aecho=0.8:0.9:${Math.round(op.delay * 1000)}:${op.decay}`);
          break;

        case 'bassBoost': {
          const freq = 100;
          const gain = op.gainDb;
          this._filters.push(`equalizer=f=${freq}:width_type=o:width=2:g=${gain}`);
          break;
        }

        case 'pitchShift': {
          const ratio = Math.pow(2, op.semitones / 12);
          const tempo = 1 / ratio;
          if (tempo >= 0.5 && tempo <= 2.0) {
            this._filters.push(`asetrate=44100*${ratio},atempo=${tempo}`);
          }
          break;
        }
      }
    }

    // Apply reverse FIRST if present (must happen before trim seek)
    const hasReverse = this._operations.some(op => op.type === 'reverse');
    if (hasReverse) {
      this._filters.unshift('areverse');
    }

    // Apply tempo filter if speed was changed
    if (speedFactor !== 1.0) {
      // atempo accepts 0.5 to 2.0, so for values outside range we chain multiple
      if (speedFactor >= 0.5 && speedFactor <= 2.0) {
        this._filters.push(`atempo=${speedFactor}`);
      } else if (speedFactor < 0.5) {
        // Chain multiple atempo for slower speeds
        const chainCount = Math.ceil(Math.log(0.5 / speedFactor) / Math.log(0.5));
        let remaining = speedFactor;
        for (let i = 0; i < chainCount; i++) {
          const factor = i === chainCount - 1 ? (0.5 / remaining) : 0.5;
          this._filters.push(`atempo=${factor}`);
          remaining /= factor;
        }
      } else {
        // Chain multiple atempo for faster speeds
        const chainCount = Math.ceil(Math.log(speedFactor / 2) / Math.log(2));
        let remaining = speedFactor;
        for (let i = 0; i < chainCount; i++) {
          const factor = i === chainCount - 1 ? (2 * remaining) : 2;
          this._filters.push(`atempo=${factor}`);
          remaining *= factor;
        }
      }
    }

    // Apply all filters
    if (this._filters.length > 0) {
      command = command.audioFilters(this._filters);
    }

    return command;
  }

  /**
   * Execute the chain and export the processed audio
   * @param {string} outputPath - Path for output file
   * @param {object} options - Export options
   * @param {string} options.format - Output format (mp3, wav, aac, flac)
   * @param {number} options.bitrate - Audio bitrate in kbps (e.g., 320)
   * @returns {Promise<{filePath: string, duration: number}>}
   */
  export(outputPath, options = {}) {
    const { format = 'mp3', bitrate = 320 } = options;

    // Validate format
    const validFormats = ['mp3', 'wav', 'aac', 'flac', 'mp4', 'ogg'];
    if (!validFormats.includes(format.toLowerCase())) {
      throw new Error(`Invalid format. Supported: ${validFormats.join(', ')}`);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);

    return new Promise(async (resolve, reject) => {
      try {
        await fs.mkdir(outputDir, { recursive: true });
      } catch (err) {
        // Directory may already exist
      }

      // Resolve fadeOut filter: need input duration to compute start time
      if (this._fadeOutDuration != null) {
        try {
          const metadata = await this._getMetadata(this.inputPath);
          const trimOp = this._operations.find(op => op.type === 'trim');
          const effectiveDuration = trimOp
            ? trimOp.endSec - trimOp.startSec
            : metadata.duration;
          const fadeStart = Math.max(0, effectiveDuration - this._fadeOutDuration);
          this._filters.push(`afade=t=out:st=${fadeStart}:d=${this._fadeOutDuration}`);
        } catch (e) {
          logger.warn('Could not resolve fadeOut duration, skipping', { error: e.message });
        }
      }

      let command = this._buildCommand(outputPath);

      // Set format and bitrate
      command = command.format(format);
      if (format !== 'wav') {
        command = command.audioBitrate(bitrate);
      }

      // Handle fade out - need to calculate start time based on final duration
      // We'll get duration after processing
      let finalDuration = 0;
      let fadeOutAdded = false;

      command
        .on('start', (commandLine) => {
          logger.debug('AudioProcessor FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            logger.debug(`AudioProcessor progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', async (stdout, stderr) => {
          logger.info('AudioProcessor export completed', { outputPath });

          // Get final duration
          try {
            const metadata = await this._getMetadata(outputPath);
            finalDuration = metadata.duration;
          } catch (err) {
            logger.warn('Could not get output duration', { error: err.message });
          }

          resolve({
            filePath: outputPath,
            duration: finalDuration,
          });
        })
        .on('error', (err, stdout, stderr) => {
          logger.error('AudioProcessor export failed', { error: err.message });
          reject(new Error(`AudioProcessor export failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  /**
   * Get audio metadata
   * @param {string} filePath - Path to audio file
   * @returns {Promise<{duration: number, bitrate: number, format: string, sampleRate: number}>}
   */
  _getMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get audio metadata: ${err.message}`));
          return;
        }

        const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');
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
   * Get metadata for the input file
   * @returns {Promise<{duration: number, bitrate: number, format: string, sampleRate: number}>}
   */
  getMetadata() {
    return this._getMetadata(this.inputPath);
  }
}

export default AudioProcessor;
