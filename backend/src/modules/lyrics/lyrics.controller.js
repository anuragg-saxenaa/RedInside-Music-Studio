import { LyricsService } from './lyrics.service.js';
import { HistoryService } from '../history/history.service.js';
import { STYLE_PRESETS } from './presets.js';
import { ProjectModel } from '../../database/models/project.model.js';
import { LyricsModel } from '../../database/models/lyrics.model.js';
import logger from '../../utils/logger.js';

const lyricsService = new LyricsService();
const historyService = new HistoryService();

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

      // Validate project exists before calling MiniMax API
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const result = await lyricsService.generateLyrics({
        projectId,
        prompt,
        stylePreset,
        mode,
      });

      // Link into generation chain (start of lyrics → music → video chain)
      try {
        await historyService.linkGeneration(projectId, { type: 'lyrics', id: result.id });
      } catch (linkErr) {
        logger.warn('Failed to link lyrics into generation chain', { error: linkErr.message });
      }

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

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const ok = await LyricsModel.delete(id);
      if (!ok) return res.status(404).json({ error: 'Lyrics not found' });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async updateTitle(req, res, next) {
    try {
      const { id } = req.params;
      const { title } = req.body;
      if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' });
      const updated = await LyricsModel.updateTitle(id, title.trim());
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
};
