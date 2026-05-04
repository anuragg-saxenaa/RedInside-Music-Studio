import { MusicController } from '../../modules/music/music.controller.js';

export const MusicRoutes = [
  {
    method: 'post',
    path: '/api/music/generate',
    handler: MusicController.generate,
  },
  {
    method: 'get',
    path: '/api/music/:id',
    handler: MusicController.getById,
  },
  {
    method: 'get',
    path: '/api/projects/:projectId/music',
    handler: MusicController.getByProject,
  },
];