import { MusicNotesController } from '../../modules/music/music-notes.controller.js';

export const MusicNotesRoutes = [
  { method: 'get',    path: '/api/music/:id/notes',          handler: MusicNotesController.list },
  { method: 'post',   path: '/api/music/:id/notes',          handler: MusicNotesController.create },
  { method: 'delete', path: '/api/music/:id/notes/:noteId',  handler: MusicNotesController.remove },
];
