import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';

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
        return res.status(404).json({ error: 'Artwork not found' });
      }

      res.sendFile(foundPath);
    } catch (error) {
      next(error);
    }
  },

  async saveArtwork(req, res, next) {
    try {
      const { id } = req.params;
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required' });
      }

      // Ensure artwork directory exists
      storage.createProjectDirs(id);
      const artworkDir = storage.getArtworkDir(id);

      // Download image from URL and save locally
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(400).json({ error: 'Failed to fetch image from URL' });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = '.png'; // Default to png
      const artworkPath = path.join(artworkDir, 'artwork' + ext);

      fs.writeFileSync(artworkPath, buffer);

      res.json({ success: true, path: artworkPath });
    } catch (error) {
      next(error);
    }
  },
};
