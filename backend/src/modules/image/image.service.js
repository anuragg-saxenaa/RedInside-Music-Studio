import * as MinimaxClientModule from '../../utils/minimax.client.js';
import config from '../../config/env.config.js';
const MinimaxClient = MinimaxClientModule.default;

export class ImageService {
  constructor() {
    this.minimax = new MinimaxClient(config.minimax.apiKey, config.minimax.baseURL);
  }

  async generateImage({ projectId, prompt, model, aspectRatio, width, height, responseFormat, seed, n, promptOptimizer }) {
    const result = await this.minimax.generateImage({
      model: model || 'image-01',
      prompt,
      aspectRatio,
      width,
      height,
      responseFormat: responseFormat || 'url',
      seed,
      n: n || 1,
      promptOptimizer,
    });

    if (result.base_resp.status_code !== 0) {
      throw new Error(result.base_resp.status_msg || 'Image generation failed');
    }

    return {
      id: Date.now(),
      projectId,
      model,
      prompt,
      imageUrls: result.data?.image_urls || [],
      seed,
    };
  }
}