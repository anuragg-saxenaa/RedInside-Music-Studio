/**
 * Viral Toolkit Controller
 * HTTP handlers for viral toolkit endpoints
 */

import { ViralToolkitService } from './viral.service.js';

const viralService = new ViralToolkitService();

export const ViralController = {
  /**
   * GET /api/viral/trends
   * Get trending topics relevant to desi hip-hop
   */
  async getTrendingTopics(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const result = await viralService.getTrendingTopics(limit);

      res.json({
        success: true,
        data: result.trends,
        meta: {
          cachedAt: result.cachedAt,
          expiresIn: result.expiresIn,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/viral/analyze-hook
   * Analyze hook quality in lyrics
   */
  async analyzeHook(req, res, next) {
    try {
      const { lyrics } = req.body;

      if (!lyrics || typeof lyrics !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'lyrics is required and must be a string',
        });
      }

      const analysis = await viralService.analyzeHook(lyrics);

      res.json({
        success: true,
        ...analysis,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/viral/templates
   * Get all structure templates
   */
  async getTemplates(req, res, next) {
    try {
      const templates = await viralService.getStructureTemplates();

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/viral/templates/:id
   * Get structure template by ID with visualization
   */
  async getTemplateById(req, res, next) {
    try {
      const { id } = req.params;
      const template = await viralService.getStructureTemplateById(id);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/viral/analyze-reference
   * Analyze reference track from YouTube/SoundCloud
   */
  async analyzeReference(req, res, next) {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'url is required and must be a string',
        });
      }

      let analysis;
      try {
        analysis = await viralService.analyzeReferenceTrack(url);
      } catch (svcError) {
        // Service throws for unsupported URLs — return 422, not 500
        return res.status(422).json({ success: false, error: svcError.message });
      }

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/viral/optimize
   * Apply viral optimizations to lyrics
   */
  async optimize(req, res, next) {
    try {
      const { lyricsId, trendsUsed, hookScore, structureTemplate, referenceTrackUrl, optimizationParams } = req.body;

      if (!lyricsId) {
        return res.status(400).json({
          success: false,
          error: 'lyricsId is required',
        });
      }

      const optimization = await viralService.applyViralOptimization(lyricsId, {
        trendsUsed,
        hookScore,
        structureTemplate,
        referenceTrackUrl,
        optimizationParams,
      });

      res.json({
        success: true,
        data: optimization,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/viral/optimize/:lyricsId
   * Get optimization record for lyrics
   */
  async getOptimization(req, res, next) {
    try {
      const { lyricsId } = req.params;
      const optimization = await viralService.getOptimizationForLyrics(lyricsId);

      if (!optimization) {
        return res.status(404).json({
          success: false,
          error: 'No optimization found for this lyrics',
        });
      }

      res.json({
        success: true,
        data: optimization,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default ViralController;