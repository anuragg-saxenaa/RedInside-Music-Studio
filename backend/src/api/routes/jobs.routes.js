import { JobModel } from '../../queue/jobs.service.js';
import { addFfmpegJob } from '../../queue/workers/ffmpeg.worker.js';

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

      // Add to appropriate queue
      if (type === 'ffmpeg-process' && inputParams?.musicId) {
        const { MusicModel } = await import('../../database/models/music.model.js');
        const music = MusicModel.findById(inputParams.musicId);
        if (music) {
          await addFfmpegJob({
            projectId,
            musicId: music.id,
            originalFilePath: music.original_file_path,
            jobId: job.id,
          });
        }
      }

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

  async cancel(req, res, next) {
    try {
      const { id } = req.params;
      const job = JobModel.findById(id);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return res.status(400).json({ error: 'Cannot cancel a finished job' });
      }

      JobModel.updateStatus(id, 'cancelled');
      res.json({ message: 'Job cancelled', jobId: id });
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
    method: 'post',
    path: '/api/jobs/:id/cancel',
    handler: JobsController.cancel,
  },
  {
    method: 'get',
    path: '/api/projects/:projectId/jobs',
    handler: JobsController.getByProject,
  },
];