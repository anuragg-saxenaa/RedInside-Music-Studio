import { MusicService } from './music.service.js';
import { JobModel } from '../../queue/jobs.service.js';
import { addMusicJob, processMusicJobInline } from '../../queue/workers/music.worker.js';
import { getRedisConnection } from '../../queue/queue.config.js';
import { ProjectModel } from '../../database/models/project.model.js';
import { SettingsModel } from '../../database/models/settings.model.js';
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
      const settingRow = await SettingsModel.get('default_music_model');
      const defaultModel = settingRow?.value || 'music-2.6';
      const resolvedModel = model || defaultModel;
      if (!validModels.includes(resolvedModel)) {
        return res.status(400).json({
          error: `Invalid model "${resolvedModel}". Must be one of: ${validModels.join(', ')}`,
        });
      }

      // Validate project exists
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!lyricsId && !isInstrumental && !audioUrl) {
        return res.status(400).json({
          error: 'lyricsId or audioUrl is required for non-instrumental music',
        });
      }

      // Create job record in DB
      const job = await JobModel.create({
        projectId,
        type: 'generate-music',
        inputParams: { lyricsId, audioUrl, prompt, model, isInstrumental, audioSettings },
      });

      const jobData = {
        projectId, lyricsId, audioUrl, prompt, model,
        isInstrumental, audioSettings, voice, language, jobId: job.id,
      };

      if (getRedisConnection()) {
        // Redis available — async via BullMQ worker
        addMusicJob(jobData);
        logger.info('Music job queued', { jobId: job.id, projectId });
      } else {
        // No Redis — process inline (fire-and-forget); job status tracked in DB + WS
        logger.info('Music job processing inline (no Redis)', { jobId: job.id, projectId });
        processMusicJobInline(jobData).catch(err => logger.error('Inline music gen failed', { error: err.message }));
      }

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

      // Bulletproof: read bytes from wherever they exist (local disk → R2). Same-origin,
      // no presigned redirect (which expires/caches). Works for files made on either side.
      const buf = await storage.readBufferAnywhere(filePath);
      if (!buf) {
        logger.error('Audio file not found on disk or R2', { filePath, musicId: id });
        return res.status(404).json({ error: 'Audio file not found', filePath });
      }

      const ext = path.extname(filePath).toLowerCase();
      const CT = { '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.ogg': 'audio/ogg', '.aac': 'audio/aac' };
      const contentType = CT[ext] || 'audio/mpeg';
      const downloadExt = (ext || '.mp3').replace('.', '');
      const fileSize = buf.length;
      const rangeHeader = req.headers.range;

      if (rangeHeader) {
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
        res.end(buf.subarray(start, end + 1));
      } else {
        res.set({
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `inline; filename="music-v${music.version}.${downloadExt}"`,
          'Content-Length': fileSize,
          'Cache-Control': 'public, max-age=300',
        });
        res.end(buf);
      }
    } catch (error) {
      logger.error('Error serving audio file:', error);
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { title, artist, genre, year, track_number, composer, lyrics_credit } = req.body;

      const music = await musicService.getMusic(id);
      if (!music) return res.status(404).json({ error: 'Music not found' });

      const updated = await musicService.updateMusicMetadata(id, {
        title,
        artist,
        genre,
        year,
        trackNumber: track_number,
        composer,
        lyricsCredit: lyrics_credit,
      });
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