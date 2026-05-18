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
    method: 'post',
    path: '/api/audio/normalize',
    handler: AudioController.normalize,
  },
  {
    method: 'post',
    path: '/api/audio/reverb',
    handler: AudioController.reverb,
  },
  {
    method: 'post',
    path: '/api/audio/echo',
    handler: AudioController.echo,
  },
  {
    method: 'post',
    path: '/api/audio/bass-boost',
    handler: AudioController.bassBoost,
  },
  {
    method: 'post',
    path: '/api/audio/pitch-shift',
    handler: AudioController.pitchShift,
  },
  {
    method: 'get',
    path: '/api/audio/:id/metadata',
    handler: AudioController.getMetadata,
  },
  {
    method: 'get',
    path: '/api/audio/download/:filename',
    handler: AudioController.download,
  },
  {
    method: 'get',
    path: '/api/audio/file/*',
    handler: AudioController.getFile,
  },
  {
    method: 'post',
    path: '/api/audio/remove-vocals',
    handler: AudioController.removeVocals,
  },
];
