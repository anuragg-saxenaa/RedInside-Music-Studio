import { ImageService } from './image.service.js';

export class ImageController {
  constructor() {
    this.service = new ImageService();
  }

  async generate(req, res) {
    try {
      const { projectId, prompt, model, aspectRatio, width, height, responseFormat, seed, n, promptOptimizer } = req.body;
      if (!projectId || !prompt) {
        return res.status(400).json({ error: 'projectId and prompt are required' });
      }
      const result = await this.service.generateImage({
        projectId, prompt, model, aspectRatio, width, height, responseFormat, seed, n, promptOptimizer,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}