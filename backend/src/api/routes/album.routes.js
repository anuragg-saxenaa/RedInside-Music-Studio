import { AlbumController } from '../../modules/album/album.controller.js';

export const AlbumRoutes = [
  { method: 'get',    path: '/api/projects/:id/albums',                          handler: AlbumController.list },
  { method: 'post',   path: '/api/projects/:id/albums',                          handler: AlbumController.create },
  { method: 'put',    path: '/api/projects/:id/albums/:albumId',                 handler: AlbumController.update },
  { method: 'delete', path: '/api/projects/:id/albums/:albumId',                 handler: AlbumController.remove },
  { method: 'get',    path: '/api/projects/:id/albums/:albumId/tracks',          handler: AlbumController.getTracks },
  { method: 'post',   path: '/api/projects/:id/albums/:albumId/tracks',          handler: AlbumController.addTrack },
  { method: 'delete', path: '/api/projects/:id/albums/:albumId/tracks/:musicId', handler: AlbumController.removeTrack },
  { method: 'put',    path: '/api/projects/:id/albums/:albumId/tracks/reorder',  handler: AlbumController.reorderTracks },
];
