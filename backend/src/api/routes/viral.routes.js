/**
 * Viral Routes
 * Express routes for viral toolkit endpoints
 */

import { ViralController } from '../modules/viral/viral.controller.js';

export const ViralRoutes = [
  {
    method: 'get',
    path: '/api/viral/trends',
    handler: ViralController.getTrendingTopics,
  },
  {
    method: 'post',
    path: '/api/viral/analyze-hook',
    handler: ViralController.analyzeHook,
  },
  {
    method: 'get',
    path: '/api/viral/templates',
    handler: ViralController.getTemplates,
  },
  {
    method: 'get',
    path: '/api/viral/templates/:id',
    handler: ViralController.getTemplateById,
  },
  {
    method: 'post',
    path: '/api/viral/analyze-reference',
    handler: ViralController.analyzeReference,
  },
  {
    method: 'post',
    path: '/api/viral/optimize',
    handler: ViralController.optimize,
  },
  {
    method: 'get',
    path: '/api/viral/optimize/:lyricsId',
    handler: ViralController.getOptimization,
  },
];

export default ViralRoutes;