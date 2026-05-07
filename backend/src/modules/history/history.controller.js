import historyService from './history.service.js';
import logger from '../../utils/logger.js';

export const HistoryController = {
  /**
   * GET /api/history/:projectId
   * Get all generations for a project grouped by type
   */
  async getProjectHistory(req, res, next) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }

      const history = await historyService.getProjectHistory(projectId);
      res.json(history);
    } catch (error) {
      logger.error('Error getting project history:', error);
      next(error);
    }
  },

  /**
   * GET /api/history/chain/:id
   * Get generation chain (lyrics → music → video)
   */
  async getVersionChain(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'Generation ID is required' });
      }

      const chain = await historyService.getVersionChain(id);
      res.json(chain);
    } catch (error) {
      logger.error('Error getting version chain:', error);
      next(error);
    }
  },

  /**
   * POST /api/history/replay/:id
   * Replay a version with its settings
   */
  async replayVersion(req, res, next) {
    try {
      const { id } = req.params;
      const { type } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Generation ID is required' });
      }

      const result = await historyService.replayVersion(id, type);
      res.json(result);
    } catch (error) {
      logger.error('Error replaying version:', error);
      next(error);
    }
  },

  /**
   * POST /api/history/compare
   * Compare two versions
   * Body: { id1, id2, type }
   */
  async compareVersions(req, res, next) {
    try {
      const { id1, id2, type } = req.body;

      if (!id1 || !id2) {
        return res.status(400).json({ error: 'id1 and id2 are required' });
      }

      if (!type) {
        return res.status(400).json({ error: 'type is required (lyrics, music, video)' });
      }

      const comparison = await historyService.compareVersions(id1, id2, type);
      res.json(comparison);
    } catch (error) {
      logger.error('Error comparing versions:', error);
      next(error);
    }
  },

  /**
   * DELETE /api/history/:id
   * Soft delete a version (unlink from chain)
   * Query param: type (lyrics, music, video)
   */
  async deleteVersion(req, res, next) {
    try {
      const { id } = req.params;
      const { type } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Generation ID is required' });
      }

      if (!type) {
        return res.status(400).json({ error: 'type query parameter is required (lyrics, music, video)' });
      }

      const result = await historyService.deleteVersion(id, type);
      res.json(result);
    } catch (error) {
      logger.error('Error deleting version:', error);
      next(error);
    }
  },
};