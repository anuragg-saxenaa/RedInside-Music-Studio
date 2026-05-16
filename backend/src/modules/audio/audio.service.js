import path from 'path';
import { AudioProcessor } from './audio.processor.js';
import storage from '../../utils/storage.util.js';
import logger from '../../utils/logger.js';

/**
 * AudioService - High-level audio processing operations
 *
 * Uses AudioProcessor for chainable audio transformations
 */
export class AudioService {
  /**
   * Process audio with given operations
   * @param {string} inputPath - Path to input audio file
   * @param {Array} operations - Array of operation descriptors
   * @param {string} outputPath - Path for output file
   * @param {object} options - Export options
   * @returns {Promise<{filePath: string, duration: number}>}
   */
  async processAudio(inputPath, operations, outputPath, options = {}) {
    logger.info('AudioService processing', { inputPath, operations, outputPath });

    const processor = new AudioProcessor(inputPath);

    for (const op of operations) {
      switch (op.type) {
        case 'trim':
          processor.trim(op.startSec, op.endSec);
          break;
        case 'speed':
          processor.speed(op.tempoFactor);
          break;
        case 'volume':
          processor.volume(op.gain);
          break;
        case 'fadeIn':
          processor.fadeIn(op.durationSec);
          break;
        case 'fadeOut':
          processor.fadeOut(op.durationSec);
          break;
        case 'reverse':
          processor.reverse();
          break;
        case 'normalize':
          processor.normalize(op.targetLUFS);
          break;
        case 'reverb':
          processor.reverb(op.roomScale, op.damping, op.wetLevel);
          break;
        case 'echo':
          processor.echo(op.delay, op.decay);
          break;
        case 'bassBoost':
          processor.bassBoost(op.gainDb);
          break;
        case 'pitchShift':
          processor.pitchShift(op.semitones);
          break;
        default:
          logger.warn('Unknown operation type', { type: op.type });
      }
    }

    const result = await processor.export(outputPath, options);
    logger.info('AudioService processing completed', result);

    return result;
  }

  /**
   * Trim audio segment
   * @param {string} inputPath - Input file path
   * @param {number} startSec - Start time in seconds
   * @param {number} endSec - End time in seconds
   * @param {string} outputPath - Output file path
   * @param {object} options - Export options
   * @returns {Promise<{filePath: string, duration: number}>}
   */
  async trimAudio(inputPath, startSec, endSec, outputPath, options = {}) {
    return new AudioProcessor(inputPath)
      .trim(startSec, endSec)
      .export(outputPath, options);
  }

  /**
   * Change audio speed
   * @param {string} inputPath - Input file path
   * @param {number} tempoFactor - Speed multiplier
   * @param {string} outputPath - Output file path
   * @param {object} options - Export options
   * @returns {Promise<{filePath: string, duration: number}>}
   */
  async changeSpeed(inputPath, tempoFactor, outputPath, options = {}) {
    return new AudioProcessor(inputPath)
      .speed(tempoFactor)
      .export(outputPath, options);
  }

  /**
   * Adjust audio volume
   * @param {string} inputPath - Input file path
   * @param {number} gain - Volume gain (1.0 = normal)
   * @param {string} outputPath - Output file path
   * @param {object} options - Export options
   * @returns {Promise<{filePath: string, duration: number}>}
   */
  async adjustVolume(inputPath, gain, outputPath, options = {}) {
    return new AudioProcessor(inputPath)
      .volume(gain)
      .export(outputPath, options);
  }

  /**
   * Add fade in effect
   * @param {string} inputPath - Input file path
   * @param {number} durationSec - Fade in duration in seconds
   * @param {string} outputPath - Output file path
   * @param {object} options - Export options
   * @returns {Promise<{filePath: string, duration: number}>}
   */
  async fadeIn(inputPath, durationSec, outputPath, options = {}) {
    return new AudioProcessor(inputPath)
      .fadeIn(durationSec)
      .export(outputPath, options);
  }

  /**
   * Add fade out effect
   * @param {string} inputPath - Input file path
   * @param {number} durationSec - Fade out duration in seconds
   * @param {string} outputPath - Output file path
   * @param {object} options - Export options
   * @returns {Promise<{filePath: string, duration: number}>}
   */
  async fadeOut(inputPath, durationSec, outputPath, options = {}) {
    return new AudioProcessor(inputPath)
      .fadeOut(durationSec)
      .export(outputPath, options);
  }

  /**
   * Reverse audio
   * @param {string} inputPath - Input file path
   * @param {string} outputPath - Output file path
   * @param {object} options - Export options
   * @returns {Promise<{filePath: string, duration: number}>}
   */
  async reverseAudio(inputPath, outputPath, options = {}) {
    return new AudioProcessor(inputPath)
      .reverse()
      .export(outputPath, options);
  }

  async normalizeAudio(inputPath, outputPath, options = {}) {
    const { targetLUFS = -14, ...exportOptions } = options;
    return new AudioProcessor(inputPath)
      .normalize(targetLUFS)
      .export(outputPath, exportOptions);
  }

  async applyReverb(inputPath, outputPath, options = {}) {
    const { roomScale = 50, damping = 50, wetLevel = 0.3, ...exportOptions } = options;
    return new AudioProcessor(inputPath)
      .reverb(roomScale, damping, wetLevel)
      .export(outputPath, exportOptions);
  }

  async applyEcho(inputPath, outputPath, options = {}) {
    const { delay = 0.3, decay = 0.5, ...exportOptions } = options;
    return new AudioProcessor(inputPath)
      .echo(delay, decay)
      .export(outputPath, exportOptions);
  }

  async applyBassBoost(inputPath, outputPath, options = {}) {
    const { gainDb = 6, ...exportOptions } = options;
    return new AudioProcessor(inputPath)
      .bassBoost(gainDb)
      .export(outputPath, exportOptions);
  }

  async applyPitchShift(inputPath, outputPath, options = {}) {
    const { semitones = 0, ...exportOptions } = options;
    return new AudioProcessor(inputPath)
      .pitchShift(semitones)
      .export(outputPath, exportOptions);
  }

  /**
   * Get audio metadata
   * @param {string} filePath - Path to audio file
   * @returns {Promise<{duration: number, bitrate: number, format: string, sampleRate: number}>}
   */
  async getMetadata(filePath) {
    return new AudioProcessor(filePath).getMetadata();
  }

  /**
   * Generate a unique output path for processed audio
   * @param {string} projectId - Project ID
   * @param {string} suffix - Optional suffix (e.g., 'trimmed', 'reversed')
   * @returns {string} - Generated file path
   */
  generateOutputPath(projectId, suffix = 'processed') {
    const timestamp = Date.now();
    return storage.getMusicFilePath(projectId, 1, suffix);
  }
}

export default new AudioService();
