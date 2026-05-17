import { VideoService } from './video.service.js';
import { JobModel } from '../../queue/jobs.service.js';
import { addVideoJob } from '../../queue/workers/video.worker.js';
import { ProjectModel } from '../../database/models/project.model.js';
import logger from '../../utils/logger.js';
import storage from '../../utils/storage.util.js';
import fs from 'fs';
import path from 'path';

const videoService = new VideoService();

export const VideoController = {
  async generate(req, res, next) {
    try {
      const { projectId, musicId, prompt, duration, resolution } = req.body;
      const model = req.body.model || 'MiniMax-Hailuo-02';

      if (!projectId) {
        return res.status(400).json({
          error: 'projectId is required',
        });
      }

      const project = ProjectModel.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
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

  async getStatus(req, res, next) {
    try {
      const { id } = req.params;
      const video = videoService.getVideo(id);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({
        id: video.id,
        status: video.status,
        progress: video.status === 'completed' ? 100 : video.status === 'failed' ? 0 : 50,
        taskId: video.task_id,
        fileId: video.file_id,
        filePath: video.file_path,
        errorMessage: video.error_message,
      });
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

      const filePath = video.file_path;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Video file not found on disk' });
      }

      const fileSize = fs.statSync(filePath).size;
      const rangeHeader = req.headers.range;

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'video/mp4',
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Accept-Ranges': 'bytes',
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Content-Disposition': `inline; filename="video-v${video.version}.mp4"`,
        });
        fs.createReadStream(filePath).pipe(res);
      }
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

      // Validate task exists in DB before hitting MiniMax
      const { VideoModel } = await import('./video.model.js');
      const video = VideoModel.findByTaskId(taskId);
      if (!video) {
        return res.status(404).json({ error: 'Video task not found' });
      }

      const result = await videoService.pollStatus(taskId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};