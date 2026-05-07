import * as MinimaxClientModule from '../../utils/minimax.client.js';
import config from '../../config/env.config.js';
import db from '../../database/connection.js';
import storage from '../../utils/storage.util.js';
import fs from 'fs';
import path from 'path';

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

    // Ensure artwork directory exists
    storage.createProjectDirs(projectId);

    // Download and save first image as artwork
    let savedArtworkPath = null;
    if (imageUrls.length > 0) {
      try {
        const artworkDir = storage.getArtworkDir(projectId);
        const ext = '.png'; // Default to png
        const artworkPath = path.join(artworkDir, 'artwork' + ext);

        // Download the image
        const response = await fetch(imageUrls[0]);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(artworkPath, buffer);
        savedArtworkPath = artworkPath;
        console.log('Artwork saved to:', artworkPath);
      } catch (err) {
        console.error('Failed to save artwork locally:', err);
      }
    }

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
