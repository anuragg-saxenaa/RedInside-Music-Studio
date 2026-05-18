import medleyService from './medley.service.js';
import { MedleyModel } from '../../database/models/medley.model.js';
import logger from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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
   * Serve exported medley file
   * GET /api/medley/:id/file
   */
  static async serveFile(req, res) {
    try {
      const { id } = req.params;
      const medley = MedleyModel.findById(id);
      if (!medley) return res.status(404).json({ error: 'Medley not found' });
      if (!medley.output_file_path || !fs.existsSync(medley.output_file_path)) {
        return res.status(404).json({ error: 'Exported file not found — export the medley first' });
      }
      const ext = path.extname(medley.output_file_path).toLowerCase();
      const contentType = ext === '.wav' ? 'audio/wav' : ext === '.flac' ? 'audio/flac' : 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(medley.output_file_path)}"`);
      fs.createReadStream(medley.output_file_path).pipe(res);
    } catch (error) {
      logger.error('Failed to serve medley file', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Save exported medley as a Music library record
   * POST /api/medley/:id/save-to-music
   */
  static async saveToMusic(req, res) {
    try {
      const { id } = req.params;
      const medley = MedleyModel.findById(id);
      if (!medley) return res.status(404).json({ error: 'Medley not found' });
      if (!medley.output_file_path || !fs.existsSync(medley.output_file_path)) {
        return res.status(400).json({ error: 'Export the medley before saving to Music' });
      }

      let durationSeconds = medley.total_duration || 0;
      if (!durationSeconds) {
        try {
          const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${medley.output_file_path}"`, { encoding: 'utf8' });
          durationSeconds = parseFloat(out.trim()) || 0;
        } catch (_) {}
      }

      const { MusicModel } = await import('../../database/models/music.model.js');
      const { ProjectModel } = await import('../../database/models/project.model.js');

      const version = MusicModel.getNextVersion(medley.project_id);
      const music = MusicModel.create({
        projectId: medley.project_id,
        version,
        originalFilePath: medley.output_file_path,
        processedFilePath: medley.output_file_path,
        title: medley.name,
        model: 'medley',
        durationSeconds,
      });
      ProjectModel.incrementVersion(medley.project_id, 'music');

      logger.info('Medley saved to music library', { medleyId: id, musicId: music.id });
      res.json({ musicId: music.id, version, title: medley.name });
    } catch (error) {
      logger.error('Failed to save medley to music', { error: error.message });
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