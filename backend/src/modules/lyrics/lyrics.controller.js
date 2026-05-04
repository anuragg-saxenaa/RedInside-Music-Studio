import { LyricsService } from './lyrics.service.js';
import { STYLE_PRESETS } from './presets.js';
import logger from '../../utils/logger.js';

const lyricsService = new LyricsService();

export const LyricsController = {
  async generate(req, res, next) {
    try {
      const { projectId, prompt, stylePreset, mode } = req.body;

      if (!projectId || !prompt) {
        return res.status(400).json({
          error: 'projectId and prompt are required',
        });
      }

      const result = await lyricsService.generateLyrics({
        projectId,
        prompt,
        stylePreset,
        mode,
      });

      res.json(result);
    } catch (error) {
      logger.error('Error generating lyrics:', error);
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
};
