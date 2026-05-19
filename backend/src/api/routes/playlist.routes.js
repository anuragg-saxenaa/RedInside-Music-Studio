import { PlaylistController } from '../../modules/playlist/playlist.controller.js';

export const PlaylistRoutes = [
  { method: 'get',    path: '/api/playlists',                       handler: PlaylistController.list },
  { method: 'post',   path: '/api/playlists',                       handler: PlaylistController.create },
  { method: 'put',    path: '/api/playlists/:id',                   handler: PlaylistController.update },
  { method: 'delete', path: '/api/playlists/:id',                   handler: PlaylistController.remove },
  { method: 'get',    path: '/api/playlists/:id/tracks',            handler: PlaylistController.getTracks },
  { method: 'post',   path: '/api/playlists/:id/tracks',            handler: PlaylistController.addTrack },
  { method: 'delete', path: '/api/playlists/:id/tracks/:musicId',   handler: PlaylistController.removeTrack },
];
