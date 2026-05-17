import medleyService from './medley.service.js';
import { MedleyModel } from '../../database/models/medley.model.js';
import logger from '../../utils/logger.js';
import fs from 'fs';

export class MedleyController {
  /**
   * Create a new medley
   * POST /api/medley
   */
  static async create(req, res) {
    try {
      const { projectId, name, description } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const medley = await medleyService.createMedley({ projectId, name, description });
      res.status(201).json(medley);
    } catch (error) {
      const status = error.statusCode || 500;
      if (status !== 500) return res.status(status).json({ error: error.message });
      logger.error('Failed to create medley', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * List all medleys for a project
   * GET /api/projects/:projectId/medleys
   */
  static async listByProject(req, res) {
    try {
      const { projectId } = req.params;
      const medleys = MedleyModel.findByProject(projectId);
      res.json(medleys);
    } catch (error) {
      logger.error('Failed to list medleys', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get medley by ID with tracks
   * GET /api/medley/:id
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const medley = await medleyService.getMedley(id);
      res.json(medley);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Failed to get medley', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update medley metadata
   * PUT /api/medley/:id
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const medley = await medleyService.updateMedley(id, { name, description });
      res.json(medley);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Failed to update medley', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete medley
   * DELETE /api/medley/:id
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      await medleyService.deleteMedley(id);
      res.status(204).send();
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Failed to delete medley', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Add track to medley
   * POST /api/medley/:id/tracks
   * Accepts: sourceFilePath (raw path) OR musicId (resolved via MusicModel)
   */
  static async addTrack(req, res) {
    try {
      const { id } = req.params;
      let { sourceFilePath, musicId, trimStart, trimEnd, speed, volume, fadeIn, fadeOut, durationSeconds } = req.body;

      // Resolve musicId to filesystem path if sourceFilePath not provided
      if (!sourceFilePath && musicId) {
        try {
          const { MusicModel } = await import('../../database/models/music.model.js');
          const music = MusicModel.findById(musicId);
          if (music) {
            const fp = music.processed_file_path || music.original_file_path;
            if (fp && fs.existsSync(fp)) {
              sourceFilePath = fp;
            }
          }
        } catch (_) {}
      }

      if (!sourceFilePath) {
        return res.status(400).json({ error: 'Source file path is required (provide sourceFilePath or a valid musicId)' });
      }

      const track = await medleyService.addTrack(id, {
        sourceFilePath,
        trimStart,
        trimEnd,
        speed,
        volume,
        fadeIn,
        fadeOut,
        durationSeconds,
      });
      res.status(201).json(track);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Failed to add track', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update or reorder tracks
   * PUT /api/medley/:id/tracks
   */
  static async updateTracks(req, res) {
    try {
      const { id } = req.params;
      const { orders, trackId, updates } = req.body;

      // If orders array provided, reorder
      if (Array.isArray(orders)) {
        await medleyService.reorderTracks(id, orders);
        return res.json({ success: true });
      }

      // Otherwise update a single track
      if (!trackId) {
        return res.status(400).json({ error: 'trackId is required for updates' });
      }

      const track = await medleyService.updateTrack(id, trackId, updates || {});
      res.json(track);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Failed to update tracks', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Remove track from medley
   * DELETE /api/medley/:id/tracks/:trackId
   */
  static async removeTrack(req, res) {
    try {
      const { id, trackId } = req.params;
      await medleyService.removeTrack(id, trackId);
      res.status(204).send();
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Failed to remove track', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Export medley
   * POST /api/medley/:id/export
   */
  static async export(req, res) {
    try {
      const { id } = req.params;
      const { format, bitrate, fadeOutFinal } = req.body;

      const result = await medleyService.exportMedley(id, { format, bitrate, fadeOutFinal });
      res.json(result);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('no tracks')) {
        return res.status(400).json({ error: error.message });
      }
      logger.error('Failed to export medley', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get total duration
   * GET /api/medley/:id/duration
   */
  static async getDuration(req, res) {
    try {
      const { id } = req.params;
      const duration = await medleyService.getTotalDuration(id);
      res.json({ duration });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Failed to get duration', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
}

export default MedleyController;