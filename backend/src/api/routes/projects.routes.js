import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';
import { AlbumModel } from '../../modules/album/album.model.js';

export const ProjectsController = {
  async create(req, res, next) {
    try {
      const { name, description, workflowMode } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          error: 'name is required and must be a string',
        });
      }

      const project = ProjectModel.create({
        name,
        description,
        workflowMode,
      });

      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const project = ProjectModel.findById(id);

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
      const projects = ProjectModel.findAll();
      res.json(projects);
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, workflowMode } = req.body;

      const existing = ProjectModel.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = ProjectModel.update(id, {
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
      const { id } = req.params;

      const existing = ProjectModel.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Project not found' });
      }

      ProjectModel.delete(id);
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
        const music = MusicModel.findById(musicId);
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

        const ext = '.png';
        const artworkFilename = `music-${musicId}.png`;
        const artworkPath = path.join(artworkDir, artworkFilename);

        fs.writeFileSync(artworkPath, buffer);

        // Update music record with artwork URL
        const artworkUrl = `/api/projects/${id}/artwork/${musicId}`;
        MusicModel.update(musicId, { artworkUrl });

        res.json({ success: true, path: artworkPath, artworkUrl });
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

      const ext = '.png';
      const artworkPath = path.join(artworkDir, 'artwork' + ext);

      fs.writeFileSync(artworkPath, buffer);

      res.json({ success: true, path: artworkPath });
    } catch (error) {
      next(error);
    }
  },

  async getMusicArtwork(req, res, next) {
    try {
      const { id, musicId } = req.params;

      const { MusicModel } = await import('../../database/models/music.model.js');
      const music = MusicModel.findById(musicId);

      if (!music) {
        return res.status(404).json({ error: 'Music not found' });
      }

      if (music.project_id !== id) {
        return res.status(400).json({ error: 'Music does not belong to this project' });
      }

      // Try music-specific artwork first
      const artworkDir = storage.getArtworkDir(id);
      const musicArtworkPath = path.join(artworkDir, `music-${musicId}.png`);

      if (fs.existsSync(musicArtworkPath)) {
        return res.sendFile(musicArtworkPath);
      }

      // Fall back to project artwork
      const extensions = ['.png', '.jpg', '.jpeg', '.webp'];
      for (const ext of extensions) {
        const testPath = path.join(artworkDir, 'artwork' + ext);
        if (fs.existsSync(testPath)) {
          return res.sendFile(testPath);
        }
      }

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async saveAlbumArtwork(req, res, next) {
    try {
      const { id: projectId, albumId } = req.params;
      const { imageData } = req.body;
      if (!imageData) return res.status(400).json({ error: 'imageData is required' });

      const album = AlbumModel.findById(albumId);
      if (!album) return res.status(404).json({ error: 'Album not found' });

      const buffer = Buffer.from(
        imageData.startsWith('data:') ? imageData.split(',')[1] : imageData,
        'base64'
      );

      const artworkDir = storage.getArtworkDir(projectId);
      fs.mkdirSync(artworkDir, { recursive: true });
      const artworkPath = path.join(artworkDir, `album-${albumId}.png`);
      fs.writeFileSync(artworkPath, buffer);

      AlbumModel.update(albumId, { artworkPath });

      const artworkUrl = `/api/projects/${projectId}/albums/${albumId}/artwork`;
      res.json({ success: true, artworkUrl });
    } catch (err) { next(err); }
  },

  async getAlbumArtwork(req, res, next) {
    try {
      const { id: projectId, albumId } = req.params;
      const album = AlbumModel.findById(albumId);
      if (!album || !album.artwork_path) return res.status(404).json({ error: 'No artwork' });
      if (!fs.existsSync(album.artwork_path)) return res.status(404).json({ error: 'File not found' });
      res.setHeader('Content-Type', 'image/png');
      res.sendFile(album.artwork_path);
    } catch (err) { next(err); }
  },
};
