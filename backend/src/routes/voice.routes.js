import { VoiceController } from '../modules/voice/voice.controller.js';

export function registerVoiceRoutes(app) {
  const controller = new VoiceController();
  app.post('/api/voice/design', controller.design.bind(controller));
  app.get('/api/voices', controller.list.bind(controller));
  app.delete('/api/voice/:voiceId', controller.delete.bind(controller));
  app.post('/api/voice/clone', controller.clone.bind(controller));
  app.get('/api/voice/clones/:projectId', controller.listClones.bind(controller));
}