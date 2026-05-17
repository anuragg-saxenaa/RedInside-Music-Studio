import { MedleyProcessor } from './medley.processor.js';
import { MedleyModel } from '../../database/models/medley.model.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger.js';

async function resolveTrackFilePath(sourceFilePath) {
  if (!sourceFilePath) return null;
  if (sourceFilePath.startsWith('/api/music/')) {
    const match = sourceFilePath.match(/^\/api\/music\/([^/]+)\/file$/);
    if (match) {
      const { MusicModel } = await import('../../database/models/music.model.js');
      const music = MusicModel.findById(match[1]);
      if (music) {
        const fp = music.processed_file_path || music.original_file_path;
        if (fp && fs.existsSync(fp)) return fp;
      }
    }
    return null;
  }
  if (sourceFilePath.startsWith('/api/mastering/')) {
    const match = sourceFilePath.match(/^\/api\/mastering\/([^/]+)\/file\/([^/]+)$/);
    if (match) {
      const uploadDir = storage.getUploadDir(match[2]);
      try {
        const files = fs.readdirSync(uploadDir);
        const file = files.find(f => f.startsWith(match[1]));
        if (file) return path.join(uploadDir, file);
      } catch (_) {}
    }
    return null;
  }
  return fs.existsSync(sourceFilePath) ? sourceFilePath : null;
}

export class MedleyService {
  /**
   * Create a new medley project
   * @param {Object} params - Creation parameters
   * @returns {Object} - Created medley
   */
  async createMedley({ projectId, name, description }) {
    if (!projectId) {
      throw new Error('Project ID is required');
    }
    if (!name) {
      throw new Error('Medley name is required');
    }

    // Create storage directories
    storage.createProjectDirs(projectId);

    const medley = MedleyModel.create({
      projectId,
      name,
      description,
    });

    logger.info('Medley created', { medleyId: medley.id, projectId, name });
    return medley;
  }

  /**
   * Get medley by ID
   * @param {string} medleyId - Medley ID
   * @returns {Object} - Medley with tracks
   */
  async getMedley(medleyId) {
    const medley = MedleyModel.findByIdWithTracks(medleyId);
    if (!medley) {
      const err = new Error(`Medley not found: ${medleyId}`);
      err.statusCode = 404;
      throw err;
    }
    return medley;
  }

  /**
   * Update medley metadata
   * @param {string} medleyId - Medley ID
   * @param {Object} updates - Fields to update
   * @returns {Object} - Updated medley
   */
  async updateMedley(medleyId, updates) {
    const medley = MedleyModel.findById(medleyId);
    if (!medley) {
      const err = new Error(`Medley not found: ${medleyId}`);
      err.statusCode = 404;
      throw err;
    }

    const updated = MedleyModel.update(medleyId, {
      name: updates.name,
      description: updates.description,
    });

    logger.info('Medley updated', { medleyId, updates });
    return updated;
  }

  /**
   * Delete medley
   * @param {string} medleyId - Medley ID
   * @returns {boolean} - Success
   */
  async deleteMedley(medleyId) {
    const medley = MedleyModel.findById(medleyId);
    if (!medley) {
      const err = new Error(`Medley not found: ${medleyId}`);
      err.statusCode = 404;
      throw err;
    }

    // Delete output file if exists
    if (medley.output_file_path) {
      try {
        storage.deleteFile(medley.output_file_path);
      } catch (err) {
        logger.warn('Failed to delete output file', { error: err.message });
      }
    }

    const result = MedleyModel.delete(medleyId);
    logger.info('Medley deleted', { medleyId });
    return result;
  }

  /**
   * Add a track to medley
   * @param {string} medleyId - Medley ID
   * @param {Object} trackData - Track data
   * @returns {Object} - Created track
   */
  async addTrack(medleyId, trackData) {
    const medley = MedleyModel.findById(medleyId);
    if (!medley) {
      const err = new Error(`Medley not found: ${medleyId}`);
      err.statusCode = 404;
      throw err;
    }

    // Validate source file exists
    if (!trackData.sourceFilePath) {
      throw new Error('Source file path is required');
    }

    // Get next order index
    const existingTracks = MedleyModel.getTracks(medleyId);
    const orderIndex = existingTracks.length;

    const track = MedleyModel.addTrack({
      medleyId,
      sourceFilePath: trackData.sourceFilePath,
      orderIndex,
      trimStart: trackData.trimStart ?? 0,
      trimEnd: trackData.trimEnd ?? null,
      speed: trackData.speed ?? 1.0,
      volume: trackData.volume ?? 1.0,
      fadeIn: trackData.fadeIn ?? 0,
      fadeOut: trackData.fadeOut ?? 0,
      durationSeconds: trackData.durationSeconds ?? null,
    });

    logger.info('Track added to medley', { medleyId, trackId: track.id });
    return track;
  }

  /**
   * Update track options
   * @param {string} medleyId - Medley ID
   * @param {string} trackId - Track ID
   * @param {Object} updates - Track options to update
   * @returns {Object} - Updated track
   */
  async updateTrack(medleyId, trackId, updates) {
    const track = MedleyModel.findTrackById(trackId);
    if (!track || track.medley_id !== medleyId) {
      const err = new Error(`Track not found: ${trackId}`);
      err.statusCode = 404;
      throw err;
    }

    const updated = MedleyModel.updateTrack(trackId, {
      trimStart: updates.trimStart,
      trimEnd: updates.trimEnd,
      speed: updates.speed,
      volume: updates.volume,
      fadeIn: updates.fadeIn,
      fadeOut: updates.fadeOut,
    });

    logger.info('Track updated', { medleyId, trackId, updates });
    return updated;
  }

  /**
   * Reorder tracks in medley
   * @param {string} medleyId - Medley ID
   * @param {Array<{trackId: string, orderIndex: number}>} orders - New order
   */
  async reorderTracks(medleyId, orders) {
    const medley = MedleyModel.findById(medleyId);
    if (!medley) {
      const err = new Error(`Medley not found: ${medleyId}`);
      err.statusCode = 404;
      throw err;
    }

    MedleyModel.reorderTracks(medleyId, orders);
    logger.info('Tracks reordered', { medleyId, orders });
  }

  /**
   * Remove a track from medley
   * @param {string} medleyId - Medley ID
   * @param {string} trackId - Track ID
   * @returns {boolean} - Success
   */
  async removeTrack(medleyId, trackId) {
    const track = MedleyModel.findTrackById(trackId);
    if (!track || track.medley_id !== medleyId) {
      const err = new Error(`Track not found: ${trackId}`);
      err.statusCode = 404;
      throw err;
    }

    const result = MedleyModel.deleteTrack(trackId);
    logger.info('Track removed from medley', { medleyId, trackId });
    return result;
  }

  /**
   * Export medley - combine all tracks into final file
   * @param {string} medleyId - Medley ID
   * @param {Object} options - Export options
   * @returns {Object} - Export result
   */
  async exportMedley(medleyId, options = {}) {
    const medley = MedleyModel.findByIdWithTracks(medleyId);
    if (!medley) {
      const err = new Error(`Medley not found: ${medleyId}`);
      err.statusCode = 404;
      throw err;
    }

    if (medley.tracks.length === 0) {
      throw new Error('Medley has no tracks');
    }

    // Build output path
    const outputPath = storage.getMedleyFilePath
      ? storage.getMedleyFilePath(medley.project_id, medleyId)
      : path.join(storage.getMusicDir(medley.project_id), `medley-${medleyId}.mp3`);

    // Create processor and add tracks
    const processor = new MedleyProcessor();

    for (const track of medley.tracks) {
      const resolvedPath = await resolveTrackFilePath(track.source_file_path);
      if (!resolvedPath) {
        const err = new Error(`Track file not found or not accessible: ${track.source_file_path}`);
        err.statusCode = 400;
        throw err;
      }
      processor.addTrack(resolvedPath, {
        trimStart: track.trim_start,
        trimEnd: track.trim_end,
        speed: track.speed,
        volume: track.volume,
        fadeIn: track.fade_in,
        fadeOut: track.fade_out,
      });
    }

    // Export
    logger.info('Starting medley export', { medleyId, trackCount: medley.tracks.length });
    const result = await processor.exportMedley(outputPath, {
      format: options.format || 'mp3',
      bitrate: options.bitrate || '320k',
      fadeOutFinal: options.fadeOutFinal || 0,
    });

    // Update medley with output info
    MedleyModel.update(medleyId, {
      outputFilePath: result.filePath,
      totalDuration: result.duration,
    });

    logger.info('Medley export completed', {
      medleyId,
      filePath: result.filePath,
      duration: result.duration,
    });

    return result;
  }

  /**
   * Get total duration of medley
   * @param {string} medleyId - Medley ID
   * @returns {number} - Total duration in seconds
   */
  async getTotalDuration(medleyId) {
    const medley = MedleyModel.findByIdWithTracks(medleyId);
    if (!medley) {
      const err = new Error(`Medley not found: ${medleyId}`);
      err.statusCode = 404;
      throw err;
    }

    if (medley.tracks.length === 0) {
      return 0;
    }

    const processor = new MedleyProcessor();
    for (const track of medley.tracks) {
      processor.addTrack(track.source_file_path, {
        trimStart: track.trim_start,
        trimEnd: track.trim_end,
        speed: track.speed,
      });
    }

    return processor.getTotalDuration();
  }
}

export default new MedleyService();