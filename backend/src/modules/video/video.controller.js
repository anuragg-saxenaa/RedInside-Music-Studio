import { VideoService } from './video.service.js';
import { JobModel } from '../../queue/jobs.service.js';
import { addVideoJob } from '../../queue/workers/video.worker.js';
import logger from '../../utils/logger.js';
import storage from '../../utils/storage.util.js';

const videoService = new VideoService();

export const VideoController = {
  async generate(req, res, next) {
    try {
      const { projectId, musicId, prompt, model, duration, resolution } = req.body;

      if (!projectId) {
        return res.status(400).json({
          error: 'projectId is required',
        });
      }

      if (!model) {
        return res.status(400).json({
          error: 'model is required (MiniMax-Hailuo-2.3 or MiniMax-Hailuo-02)',
        });
      }

      // Create job record in DB
      const job = JobModel.create({
        projectId,
        type: 'generate-video',
        inputParams: { musicId, prompt, model, duration, resolution },
      });

      // Add to BullMQ queue (async processing)
      addVideoJob({
        projectId,
        musicId,
        prompt,
        model,
        duration,
        resolution,
        jobId: job.id,
      });

      logger.info('Video job queued', { jobId: job.id, projectId });

      res.status(202).json({
        message: 'Video generation queued',
        jobId: job.id,
        status: job.status,
      });
    } catch (error) {
      logger.error('Error generating video:', error);
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const video = videoService.getVideo(id);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json(video);
    } catch (error) {
      next(error);
    }
  },

  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const videos = videoService.getProjectVideos(projectId);
      res.json(videos);
    } catch (error) {
      next(error);
    }
  },

  async getByMusic(req, res, next) {
    try {
      const { musicId } = req.params;
      const videos = videoService.getMusicVideos(musicId);
      res.json(videos);
    } catch (error) {
      next(error);
    }
  },

  async getFile(req, res, next) {
    try {
      const { id } = req.params;
      const video = videoService.getVideo(id);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (!video.file_path) {
        return res.status(404).json({ error: 'Video file not available yet' });
      }

      const fileBuffer = storage.readFile(video.file_path);

      res.set({
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="video-v${video.version}.mp4"`,
        'Content-Length': fileBuffer.length,
      });

      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  },

  async pollStatus(req, res, next) {
    try {
      const { taskId } = req.params;
      if (!taskId) {
        return res.status(400).json({ error: 'taskId is required' });
      }

      const result = await videoService.pollStatus(taskId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};