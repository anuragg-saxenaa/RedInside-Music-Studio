import { AudioController } from '../../modules/audio/audio.controller.js';

export const AudioRoutes = [
  {
    method: 'post',
    path: '/api/audio/process',
    handler: AudioController.process,
  },
  {
    method: 'post',
    path: '/api/audio/trim',
    handler: AudioController.trim,
  },
  {
    method: 'post',
    path: '/api/audio/speed',
    handler: AudioController.changeSpeed,
  },
  {
    method: 'post',
    path: '/api/audio/volume',
    handler: AudioController.adjustVolume,
  },
  {
    method: 'post',
    path: '/api/audio/fade-in',
    handler: AudioController.fadeIn,
  },
  {
    method: 'post',
    path: '/api/audio/fade-out',
    handler: AudioController.fadeOut,
  },
  {
    method: 'post',
    path: '/api/audio/reverse',
    handler: AudioController.reverse,
  },
  {
    method: 'get',
    path: '/api/audio/:id/metadata',
    handler: AudioController.getMetadata,
  },
];
