import { ImageController } from '../modules/image/image.controller.js';

export function registerImageRoutes(app) {
  const controller = new ImageController();
  app.post('/api/image/generate', controller.generate.bind(controller));
}
