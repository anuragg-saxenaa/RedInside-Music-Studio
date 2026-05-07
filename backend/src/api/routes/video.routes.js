import { VideoController } from '../../modules/video/video.controller.js';

export const VideoRoutes = [
  {
    method: 'post',
    path: '/api/video/generate',
    handler: VideoController.generate,
  },
  {
    method: 'get',
    path: '/api/video/:id',
    handler: VideoController.getById,
  },
  {
    method: 'get',
    path: '/api/video/:id/file',
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
  {
    method: 'get',
    path: '/api/video/poll/:taskId',
    handler: VideoController.pollStatus,
  },
];