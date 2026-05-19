import { ShareController } from '../../modules/share/share.controller.js';

export const ShareRoutes = [
  { method: 'post', path: '/api/projects/:id/share',  handler: ShareController.create },
  { method: 'get',  path: '/api/share/:token',         handler: ShareController.view },
];
