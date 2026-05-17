import { VideoController } from '../../modules/video/video.controller.js';

export const VideoRoutes = [
  {
    method: 'post',
    path: '/api/video/generate',
    handler: VideoController.generate,
  },
  {
    method: 'get',
    path: '/api/video/poll/:taskId',
    handler: VideoController.pollStatus,
  },
  {
    method: 'get',
    path: '/api/video/:id',
    handler: VideoController.getById,
  },
  {
    // Spec §4.4: GET /api/video/:id/status — check generation status from DB record
    method: 'get',
    path: '/api/video/:id/status',
    handler: VideoController.getStatus,
  },
  {
    method: 'get',
    path: '/api/video/:id/file',
    handler: VideoController.getFile,
  },
  {
    // Spec §4.4: GET /api/video/:id/download — alias for /file
    method: 'get',
    path: '/api/video/:id/download',
    handler: VideoController.getFile,
  },
  {
    method: 'get',
    path: '/api/projects/:projectId/video',
    handler: VideoController.getByProject,
  },
  {
    method: 'get',
    path: '/api/music/:musicId/video',
    handler: VideoController.getByMusic,
  },
];