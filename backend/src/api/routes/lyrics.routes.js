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
    path: '/api/lyrics/presets',
    handler: (req, res) => res.json(STYLE_PRESETS),
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
    method: 'post',
    path: '/api/lyrics/edit/:id',
    handler: LyricsController.edit,
  },
  {
    method: 'get',
    path: '/api/lyrics/:id/versions',
    handler: LyricsController.getVersions,
  },
  {
    method: 'get',
    path: '/api/lyrics/:id/diff/:version',
    handler: LyricsController.getDiff,
  },
  {
    method: 'delete',
    path: '/api/lyrics/:id',
    handler: LyricsController.delete,
  },
  {
    method: 'patch',
    path: '/api/lyrics/:id',
    handler: LyricsController.updateTitle,
  },
];