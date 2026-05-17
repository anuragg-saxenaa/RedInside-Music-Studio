import { MusicService } from './music.service.js';
import { JobModel } from '../../queue/jobs.service.js';
import { addMusicJob } from '../../queue/workers/music.worker.js';
import { ProjectModel } from '../../database/models/project.model.js';
import logger from '../../utils/logger.js';
import storage from '../../utils/storage.util.js';
import fs from 'fs';
import path from 'path';

const musicService = new MusicService();

export const MusicController = {
  async generate(req, res, next) {
    try {
      const { projectId, lyricsId, audioUrl, prompt, model, isInstrumental, audioSettings, voice, language } = req.body;

      if (!projectId) {
        return res.status(400).json({
          error: 'projectId is required',
        });
      }

      const validModels = ['music-2.6', 'music-cover'];
      const resolvedModel = model || 'music-2.6';
      if (!validModels.includes(resolvedModel)) {
        return res.status(400).json({
          error: `Invalid model "${resolvedModel}". Must be one of: ${validModels.join(', ')}`,
        });
      }

      // Validate project exists
      const project = ProjectModel.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!lyricsId && !isInstrumental && !audioUrl) {
        return res.status(400).json({
          error: 'lyricsId or audioUrl is required for non-instrumental music',
        });
      }

      // Create job record in DB
      const job = JobModel.create({
        projectId,
        type: 'generate-music',
        inputParams: { lyricsId, audioUrl, prompt, model, isInstrumental, audioSettings },
      });

      // Add to BullMQ queue (async processing)
      addMusicJob({
        projectId,
        lyricsId,
        audioUrl,
        prompt,
        model,
        isInstrumental,
        audioSettings,
        voice,
        language,
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

      // Prefer processed file (320kbps) if available
      const filePath = music.processed_file_path || music.original_file_path;

      if (!filePath) {
        return res.status(404).json({ error: 'File not available yet' });
      }

      // Check if file actually exists BEFORE trying to read
      if (!fs.existsSync(filePath)) {
        logger.error('Audio file not found on disk', { filePath, musicId: id });
        return res.status(404).json({
          error: 'Audio file not found on disk',
          filePath,
          version: music.version
        });
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === '.wav' ? 'audio/wav' : 'audio/mpeg';
      const downloadExt = ext === '.wav' ? 'wav' : 'mp3';

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const rangeHeader = req.headers.range;

      if (rangeHeader) {
        // Support HTTP range requests for proper audio seeking
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.set({
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
        });
        res.status(206);

        const fileStream = fs.createReadStream(filePath, { start, end });
        fileStream.pipe(res);
      } else {
        res.set({
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `inline; filename="music-v${music.version}.${downloadExt}"`,
          'Content-Length': fileSize,
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error) {
      logger.error('Error serving audio file:', error);
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { title } = req.body;

      const music = await musicService.getMusic(id);
      if (!music) {
        return res.status(404).json({ error: 'Music not found' });
      }

      const updated = await musicService.updateMusicMetadata(id, { title });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const music = await musicService.getMusic(id);
      if (!music) {
        return res.status(404).json({ error: 'Music not found' });
      }
      await musicService.deleteMusic(id);
      res.json({ message: 'Music deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
};