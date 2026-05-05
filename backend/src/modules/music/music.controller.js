import { MusicService } from './music.service.js';
import { JobModel } from '../../queue/jobs.service.js';
import { addMusicJob } from '../../queue/workers/music.worker.js';
import logger from '../../utils/logger.js';
import storage from '../../utils/storage.util.js';

const musicService = new MusicService();

export const MusicController = {
  async generate(req, res, next) {
    try {
      const { projectId, lyricsId, prompt, model, isInstrumental, audioSettings } = req.body;

      if (!projectId) {
        return res.status(400).json({
          error: 'projectId is required',
        });
      }

      if (!lyricsId && !isInstrumental) {
        return res.status(400).json({
          error: 'lyricsId is required for non-instrumental music',
        });
      }

      // Create job record in DB
      const job = JobModel.create({
        projectId,
        type: 'generate-music',
        inputParams: { lyricsId, prompt, model, isInstrumental, audioSettings },
      });

      // Add to BullMQ queue (async processing)
      addMusicJob({
        projectId,
        lyricsId,
        prompt,
        model,
        isInstrumental,
        audioSettings,
        jobId: job.id,
      });

      logger.info('Music job queued', { jobId: job.id, projectId });

      res.status(202).json({
        message: 'Music generation queued',
        jobId: job.id,
        status: job.status,
      });
    } catch (error) {
      logger.error('Error generating music:', error);
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const music = await musicService.getMusic(id);

      if (!music) {
        return res.status(404).json({ error: 'Music not found' });
      }

      res.json(music);
    } catch (error) {
      next(error);
    }
  },

  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const music = await musicService.getProjectMusic(projectId);
      res.json(music);
    } catch (error) {
      next(error);
    }
  },

  async getFile(req, res, next) {
    try {
      const { id } = req.params;
      const music = await musicService.getMusic(id);

      if (!music) {
        return res.status(404).json({ error: 'Music not found' });
      }

      if (!music.original_file_path) {
        return res.status(404).json({ error: 'File not available yet' });
      }

      // Prefer processed file (320kbps) if available
      const filePath = music.processed_file_path || music.original_file_path;
      const fileBuffer = storage.readFile(filePath);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="music-v${music.version}.mp3"`,
        'Content-Length': fileBuffer.length,
      });

      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  },
};