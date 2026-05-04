import { ProjectModel } from '../../database/models/project.model.js';

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
};