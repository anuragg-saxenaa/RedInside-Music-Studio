import { LyricsController } from '../../modules/lyrics/lyrics.controller.js';
import { STYLE_PRESETS } from '../../modules/lyrics/presets.js';

export const LyricsRoutes = [
  {
    method: 'post',
    path: '/api/lyrics/generate',
    handler: LyricsController.generate,
  },
  {
    method: 'get',
    path: '/api/lyrics/:id',
    handler: LyricsController.getById,
  },
  {
    method: 'get',
    path: '/api/projects/:projectId/lyrics',
    handler: LyricsController.getByProject,
  },
  {
    method: 'get',
    path: '/api/lyrics/presets',
    handler: (req, res) => res.json(STYLE_PRESETS),
  },
];