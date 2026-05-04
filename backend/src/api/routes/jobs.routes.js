import { JobModel } from '../../queue/jobs.service.js';

export const JobsController = {
  async create(req, res, next) {
    try {
      const { projectId, type, inputParams } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }
      if (!type) {
        return res.status(400).json({ error: 'type is required' });
      }

      const validTypes = ['generate-lyrics', 'generate-music', 'ffmpeg-process'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `type must be one of: ${validTypes.join(', ')}`,
        });
      }

      const job = JobModel.create({ projectId, type, inputParams });
      res.status(201).json(job);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const job = JobModel.findById(id);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(job);
    } catch (error) {
      next(error);
    }
  },

  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const jobs = JobModel.findByProject(projectId);
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  },
};

export const JobsRoutes = [
  {
    method: 'post',
    path: '/api/jobs',
    handler: JobsController.create,
  },
  {
    method: 'get',
    path: '/api/jobs/:id',
    handler: JobsController.getById,
  },
  {
    method: 'get',
    path: '/api/projects/:projectId/jobs',
    handler: JobsController.getByProject,
  },
];