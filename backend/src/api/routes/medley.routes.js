import { MedleyController } from '../../modules/medley/medley.controller.js';

export const MedleyRoutes = [
  {
    method: 'get',
    path: '/api/projects/:projectId/medleys',
    handler: MedleyController.listByProject,
  },
  {
    method: 'post',
    path: '/api/medley',
    handler: MedleyController.create,
  },
  {
    method: 'get',
    path: '/api/medley/:id',
    handler: MedleyController.getById,
  },
  {
    method: 'put',
    path: '/api/medley/:id',
    handler: MedleyController.update,
  },
  {
    method: 'delete',
    path: '/api/medley/:id',
    handler: MedleyController.delete,
  },
  {
    method: 'post',
    path: '/api/medley/:id/tracks',
    handler: MedleyController.addTrack,
  },
  {
    method: 'put',
    path: '/api/medley/:id/tracks',
    handler: MedleyController.updateTracks,
  },
  {
    method: 'delete',
    path: '/api/medley/:id/tracks/:trackId',
    handler: MedleyController.removeTrack,
  },
  {
    method: 'post',
    path: '/api/medley/:id/export',
    handler: MedleyController.export,
  },
  {
    method: 'get',
    path: '/api/medley/:id/duration',
    handler: MedleyController.getDuration,
  },
];

export default MedleyRoutes;