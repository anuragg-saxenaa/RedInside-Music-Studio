import { SocialExportController } from '../../modules/audio/social-export.controller.js';

export const SocialExportRoutes = [
  { method: 'post', path: '/api/audio/social-export', handler: SocialExportController.export },
];
