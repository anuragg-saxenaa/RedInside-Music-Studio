import { LyricsService } from './lyrics.service.js';
import { STYLE_PRESETS } from './presets.js';
import logger from '../../utils/logger.js';

const lyricsService = new LyricsService();

export const LyricsController = {
  async generate(req, res, next) {
    try {
      const { projectId, prompt, stylePreset, mode } = req.body;

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ error: 'projectId is required and must be a string' });
      }

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'prompt is required and must be a string' });
      }

      // Service will validate stylePreset and mode

      const result = await lyricsService.generateLyrics({
        projectId,
        prompt,
        stylePreset,
        mode,
      });

      res.json(result);
    } catch (error) {
      // Log without exposing full error
      logger.error('Lyrics generation error:', {
        message: error.message,
        projectId: req.body.projectId
      });
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const lyrics = await lyricsService.getLyrics(id);

      if (!lyrics) {
        return res.status(404).json({ error: 'Lyrics not found' });
      }

      res.json(lyrics);
    } catch (error) {
      next(error);
    }
  },

  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const lyrics = await lyricsService.getProjectLyrics(projectId);
      res.json(lyrics);
    } catch (error) {
      next(error);
    }
  },

  async getPresets(req, res) {
    res.json(STYLE_PRESETS);
  },

  async edit(req, res, next) {
    try {
      const { id } = req.params;
      const { prompt, stylePreset } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'prompt (edit instruction) is required and must be a string' });
      }

      const result = await lyricsService.editLyrics(id, {
        prompt,
        stylePreset,
      });

      res.json(result);
    } catch (error) {
      logger.error('Lyrics edit error:', {
        message: error.message,
        lyricsId: req.params.id
      });
      next(error);
    }
  },

  async getVersions(req, res, next) {
    try {
      const { id } = req.params;
      const versions = await lyricsService.getLyricsVersions(id);
      res.json(versions);
    } catch (error) {
      next(error);
    }
  },

  async getDiff(req, res, next) {
    try {
      const { id, version } = req.params;
      const diff = await lyricsService.getLyricsDiff(id, version);
      res.json(diff);
    } catch (error) {
      next(error);
    }
  },
};
