import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';
import { AlbumModel } from '../../modules/album/album.model.js';
import db from '../../database/connection.js';

export const ProjectsController = {
  async create(req, res, next) {
    try {
      const userId = req.auth?.userId || 'dev-user';
      const { name, description, workflowMode } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          error: 'name is required and must be a string',
        });
      }

      const project = await ProjectModel.create({
        name,
        description,
        workflowMode,
        userId,
      });

      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const userId = req.auth?.userId || 'dev-user';
      const { id } = req.params;
      const result = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ? AND user_id = ?', args: [id, userId] });
      const project = result.rows[0];

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (error) {
      next(error);
    }
  },

  async getAll(req, res, next) {
    try {
      const userId = req.auth?.userId || 'dev-user';
      // Single-user studio — return all projects regardless of user_id
      // Also sync user_id so future creates use the right ID
      const result = await db.execute('SELECT * FROM projects ORDER BY updated_at DESC');
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const userId = req.auth?.userId || 'dev-user';
      const { id } = req.params;
      const { name, description, workflowMode } = req.body;

      const existingResult = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ? AND user_id = ?', args: [id, userId] });
      if (!existingResult.rows[0]) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = await ProjectModel.update(id, {
        name,
        description,
        workflowMode,
      });

      res.json(project);
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const userId = req.auth?.userId || 'dev-user';
      const { id } = req.params;

      const existingResult = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ? AND user_id = ?', args: [id, userId] });
      if (!existingResult.rows[0]) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await ProjectModel.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async fetchImage(req, res, next) {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required' });
      }

      // Server-side fetch avoids CORS restrictions
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(400).json({ error: 'Failed to fetch image from URL' });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/png';

      res.json({ imageData: `data:${mimeType};base64,${base64}` });
    } catch (error) {
      next(error);
    }
  },

  async getArtwork(req, res, next) {
    try {
      const { id } = req.params;

      const artworkDir = storage.getArtworkDir(id);
      const artworkPath = path.join(artworkDir, 'artwork');

      // Check for artwork files
      const extensions = ['.png', '.jpg', '.jpeg', '.webp'];
      let foundPath = null;

      for (const ext of extensions) {
        const testPath = artworkPath + ext;
        if (fs.existsSync(testPath)) {
          foundPath = testPath;
          break;
        }
      }

      if (!foundPath) {
        return res.status(204).send();
      }

      res.sendFile(foundPath);
    } catch (error) {
      next(error);
    }
  },

  async saveArtwork(req, res, next) {
    try {
      const { id } = req.params;
      const { imageUrl, musicId } = req.body;

      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required' });
      }

      // If musicId is provided, save per-song artwork instead of project artwork
      if (musicId) {
        // Get the music to find the project
        const { MusicModel } = await import('../../database/models/music.model.js');
        const music = await MusicModel.findById(musicId);
        if (!music) {
          return res.status(404).json({ error: 'Music not found' });
        }
        if (music.project_id !== id) {
          return res.status(400).json({ error: 'Music does not belong to this project' });
        }

        // Create project dirs if needed
        storage.createProjectDirs(id);
        const artworkDir = storage.getArtworkDir(id);

        // Handle base64 image data or URL
        let buffer;
        if (imageUrl.startsWith('data:')) {
          // Base64 image data
          const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
          buffer = Buffer.from(base64Data, 'base64');
        } else {
          // Download from URL
          const response = await fetch(imageUrl);
          if (!response.ok) {
            return res.status(400).json({ error: 'Failed to fetch image from URL' });
          }
          buffer = Buffer.from(await response.arrayBuffer());
        }

        const artworkFilename = `music-${musicId}.png`;
        const artworkKey = path.join(artworkDir, artworkFilename);

        // saveArtwork handles R2 upload (cloud) or local disk write
        await storage.saveArtwork(artworkKey, buffer, 'image/png');

        // Update music record with artwork URL
        const artworkUrl = `/api/projects/${id}/artwork/${musicId}`;
        await MusicModel.update(musicId, { artworkUrl });

        res.json({ success: true, path: artworkKey, artworkUrl });
        return;
      }

      // Default: save project-level artwork
      storage.createProjectDirs(id);
      const artworkDir = storage.getArtworkDir(id);

      let buffer;
      if (imageUrl.startsWith('data:')) {
        // Base64 image data
        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        // Download from URL
        const response = await fetch(imageUrl);
        if (!response.ok) {
          return res.status(400).json({ error: 'Failed to fetch image from URL' });
        }
        buffer = Buffer.from(await response.arrayBuffer());
      }

      const artworkKey = path.join(artworkDir, 'artwork.png');

      await storage.saveArtwork(artworkKey, buffer, 'image/png');

      res.json({ success: true, path: artworkKey });
    } catch (error) {
      next(error);
    }
  },

  async getMusicArtwork(req, res, next) {
    try {
      const { id, musicId } = req.params;

      const { MusicModel } = await import('../../database/models/music.model.js');
      const music = await MusicModel.findById(musicId);

      if (!music) {
        return res.status(404).json({ error: 'Music not found' });
      }

      if (music.project_id !== id) {
        return res.status(400).json({ error: 'Music does not belong to this project' });
      }

      // Stream bytes directly (same-origin, no redirect) — checks local disk then R2.
      // Try per-song artwork first, then project-level artwork as fallback.
      const buf =
        await storage.readBufferAnywhere(`projects/${id}/artwork/music-${musicId}.png`) ||
        await storage.readBufferAnywhere(`projects/${id}/artwork/artwork.png`);

      if (!buf) return res.status(204).send();

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.send(buf);
    } catch (error) {
      next(error);
    }
  },

  async saveAlbumArtwork(req, res, next) {
    try {
      const { id: projectId, albumId } = req.params;
      const { imageData } = req.body;
      if (!imageData) return res.status(400).json({ error: 'imageData is required' });

      const album = await AlbumModel.findById(albumId);
      if (!album) return res.status(404).json({ error: 'Album not found' });

      const buffer = Buffer.from(
        imageData.startsWith('data:') ? imageData.split(',')[1] : imageData,
        'base64'
      );

      const artworkDir = storage.getArtworkDir(projectId);
      const artworkPath = path.join(artworkDir, `album-${albumId}.png`);
      await storage.saveArtwork(artworkPath, buffer, 'image/png');

      await AlbumModel.update(albumId, { artworkPath });

      const artworkUrl = `/api/projects/${projectId}/albums/${albumId}/artwork`;
      res.json({ success: true, artworkUrl });
    } catch (err) { next(err); }
  },

  async getAlbumArtwork(req, res, next) {
    try {
      const { albumId } = req.params;
      const album = await AlbumModel.findById(albumId);
      if (!album || !album.artwork_path) return res.status(404).json({ error: 'No artwork' });

      const buf = await storage.readBufferAnywhere(album.artwork_path);
      if (!buf) return res.status(404).json({ error: 'File not found' });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.send(buf);
    } catch (err) { next(err); }
  },
};
