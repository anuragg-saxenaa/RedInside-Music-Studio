/**
 * Viral Toolkit Service
 * Social sharing and viral optimization for desi hip-hop tracks
 */

import { ViralModel } from './viral.model.js';
import { fetchTrendingTopics, getTrendsByCategory } from './trends-scraper.js';
import { analyzeHook } from './hook-analyzer.js';
import { getAllTemplates, getTemplateById, getTemplatesByGenre, getStructureVisualization } from './structure-templates.js';
import { LyricsModel } from '../../database/models/lyrics.model.js';
import logger from '../../utils/logger.js';

export class ViralToolkitService {
  /**
   * Get trending topics relevant to desi hip-hop
   * Cached for 1 hour
   * @param {number} limit - Maximum number of trends to return
   * @returns {Promise<Array>} - Array of trending topics
   */
  async getTrendingTopics(limit = 10) {
    try {
      const trends = await fetchTrendingTopics(limit);

      logger.info('Fetched trending topics', { count: trends.length, limit });

      return {
        trends,
        cachedAt: trends[0]?.fetchedAt || new Date().toISOString(),
        expiresIn: 3600, // 1 hour in seconds
      };
    } catch (error) {
      logger.error('Failed to fetch trending topics', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze hook quality in lyrics
   * @param {string} lyrics - The lyrics content to analyze
   * @returns {Object} - { score: 0-100, suggestions: [...], details: {...} }
   */
  async analyzeHook(lyrics) {
    try {
      const analysis = analyzeHook(lyrics);

      logger.info('Hook analysis completed', {
        score: analysis.score,
        hasHook: analysis.details.hasHook,
        suggestionCount: analysis.suggestions.length,
      });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze hook', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all structure templates
   * @returns {Array} - Array of structure templates
   */
  async getStructureTemplates() {
    try {
      const templates = getAllTemplates();

      logger.info('Retrieved structure templates', { count: templates.length });

      return templates;
    } catch (error) {
      logger.error('Failed to get structure templates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get structure template by ID
   * @param {string} templateId - Template ID
   * @returns {Object|null} - Template with section details
   */
  async getStructureTemplateById(templateId) {
    try {
      const template = getTemplateById(templateId);

      if (template) {
        const visualization = getStructureVisualization(templateId);
        logger.info('Retrieved structure template', { templateId, sections: template.structure.length });
        return { ...template, visualization };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get structure template by ID', { error: error.message, templateId });
      throw error;
    }
  }

  /**
   * Get templates recommended for a genre
   * @param {string} genre - Genre to filter by
   * @returns {Array} - Matching templates
   */
  async getTemplatesByGenre(genre) {
    try {
      const templates = getTemplatesByGenre(genre);

      logger.info('Filtered templates by genre', { genre, count: templates.length });

      return templates;
    } catch (error) {
      logger.error('Failed to filter templates by genre', { error: error.message, genre });
      throw error;
    }
  }

  /**
   * Analyze reference track (YouTube/SoundCloud URL)
   * Note: This is a placeholder - real implementation would need audio fingerprinting
   * @param {string} url - YouTube or SoundCloud URL
   * @returns {Object} - { bpm, key, structure, hookRepetitions }
   */
  async analyzeReferenceTrack(url) {
    try {
      // Validate URL format
      if (!url || typeof url !== 'string') {
        throw new Error('Reference track URL is required');
      }

      const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
      const isSoundCloud = url.includes('soundcloud.com');

      if (!isYouTube && !isSoundCloud) {
        throw new Error('Only YouTube and SoundCloud URLs are supported');
      }

      // Placeholder implementation
      // Real implementation would:
      // 1. Download audio from URL
      // 2. Use audio fingerprinting (e.g., ACRCloud, AudD)
      // 3. Extract BPM, key, structure

      const analysis = {
        url,
        platform: isYouTube ? 'youtube' : 'soundcloud',
        status: 'placeholder',
        data: {
          bpm: null, // Would be extracted from audio
          key: null, // Would be detected from audio
          structure: null, // Would be analyzed from audio
          hookRepetitions: null, // Would be counted from audio
          estimatedDuration: null,
        },
        message: 'Audio fingerprinting placeholder - real implementation requires ACRCloud or similar service',
        note: 'For accurate analysis, please use a service like ACRCloud, AudD, or Chromaprint',
      };

      logger.info('Reference track analysis (placeholder)', { url, platform: analysis.platform });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze reference track', { error: error.message, url });
      throw error;
    }
  }

  /**
   * Apply viral optimizations to lyrics
   * @param {string} lyricsId - Lyrics generation ID
   * @param {Object} optimizations - Optimization parameters
   * @returns {Object} - Optimization record
   */
  async applyViralOptimization(lyricsId, optimizations) {
    try {
      const { trendsUsed, hookScore, structureTemplate, referenceTrackUrl, optimizationParams } = optimizations;

      // Validate lyrics exists
      const lyrics = await LyricsModel.findById(lyricsId);
      if (!lyrics) {
        const err = new Error(`Lyrics not found: ${lyricsId}`);
        err.statusCode = 404;
        throw err;
      }

      // Create optimization record
      const optimization = await ViralModel.create({
        generationId: lyricsId,
        generationType: 'lyrics',
        trendsUsed,
        hookScore,
        structureTemplate,
        referenceTrackUrl,
        optimizationParams,
      });

      logger.info('Viral optimization applied', {
        optimizationId: optimization.id,
        lyricsId,
        trendsUsed: trendsUsed?.length || 0,
        structureTemplate,
      });

      return optimization;
    } catch (error) {
      logger.error('Failed to apply viral optimization', { error: error.message, lyricsId });
      throw error;
    }
  }

  /**
   * Get optimization history for a lyrics generation
   * @param {string} lyricsId - Lyrics generation ID
   * @returns {Object|null} - Latest optimization record
   */
  async getOptimizationForLyrics(lyricsId) {
    try {
      return await ViralModel.getLatestByGeneration(lyricsId, 'lyrics');
    } catch (error) {
      logger.error('Failed to get optimization for lyrics', { error: error.message, lyricsId });
      throw error;
    }
  }

  /**
   * Get structure visualization for a template
   * @param {string} templateId - Template ID
   * @returns {Array|null} - Structure visualization
   */
  async getStructureVisualization(templateId) {
    try {
      return getStructureVisualization(templateId);
    } catch (error) {
      logger.error('Failed to get structure visualization', { error: error.message, templateId });
      throw error;
    }
  }
}

export default ViralToolkitService;