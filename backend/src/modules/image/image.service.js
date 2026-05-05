import * as MinimaxClientModule from '../../utils/minimax.client.js';
import config from '../../config/env.config.js';
import db from '../../database/connection.js';
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

    const imageUrls = result.data?.image_urls || [];
    const id = Date.now();

    // Store in database
    const stmt = db.prepare(`
      INSERT INTO image_generations (id, project_id, model, prompt, aspect_ratio, width, height, image_urls, seed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, projectId, model || 'image-01', prompt, aspectRatio || '1:1', width, height, JSON.stringify(imageUrls), seed, new Date().toISOString());

    return {
      id,
      projectId,
      model,
      prompt,
      imageUrls,
      seed,
    };
  }

  getByProject(projectId) {
    const stmt = db.prepare('SELECT * FROM image_generations WHERE project_id = ? ORDER BY created_at DESC');
    return stmt.all(projectId).map(row => ({
      ...row,
      imageUrls: JSON.parse(row.image_urls || '[]'),
    }));
  }
}