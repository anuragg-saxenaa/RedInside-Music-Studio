import audioService from './audio.service.js';
import storage from '../../utils/storage.util.js';
import logger from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { AudioMasteringService } from '../mastering/mastering.service.js';
import { JobModel } from '../../queue/jobs.service.js';

/**
 * Convert HTTP URL to filesystem path for uploaded mastering files
 * Pattern: /api/mastering/:fileId/file/:projectId
 */
function convertMasteringUrlToPath(url) {
  const masteringMatch = url.match(/^\/api\/mastering\/([^/]+)\/file\/([^/]+)$/);
  if (masteringMatch) {
    const [, fileId, projectId] = masteringMatch;
    const uploadDir = storage.getUploadDir(projectId);
    try {
      const files = fs.readdirSync(uploadDir);
      const file = files.find(f => f.startsWith(fileId) && f.match(/\.(mp3|wav|flac|m4a|ogg|aac)$/i));
      if (file) {
        return path.join(uploadDir, file);
      }
    } catch (e) {
      logger.error('Failed to find mastering file', { fileId, projectId });
    }
  }
  return null;
}

/**
 * Convert music API URL to filesystem path
 * Pattern: /api/music/:id/file
 */
async function convertMusicUrlToPath(url) {
  const musicMatch = url.match(/^\/api\/music\/([^/]+)\/file$/);
  if (musicMatch) {
    const [, musicId] = musicMatch;
    try {
      const { MusicModel } = await import('../../database/models/music.model.js');
      const music = MusicModel.findById(musicId);
      if (music) {
        const filePath = music.processed_file_path || music.original_file_path;
        if (filePath && fs.existsSync(filePath)) {
          logger.info('Converted music URL to filesystem path', { musicId, filePath });
          return filePath;
        }
      }
      logger.error('Music file not found', { musicId });
    } catch (e) {
      logger.error('Error converting music URL', { musicId, error: e.message });
    }
  }
  return null;
}

/**
 * Resolve inputPath from either:
 *   - trackId + projectId  (uploaded audio via /api/upload)
 *   - musicId              (generated music)
 *   - inputPath            (raw filesystem path — legacy)
 */
async function resolveInputPath(body) {
  const { trackId, musicId, projectId, inputPath } = body;

  // Raw filesystem path — use directly
  if (inputPath && !inputPath.startsWith('/api/')) {
    return inputPath;
  }

  // Resolve uploaded track (trackId + projectId)
  if (trackId && projectId) {
    const audioDir = path.join(storage.getProjectDir(projectId), 'audio');
    try {
      const files = fs.readdirSync(audioDir);
      const file = files.find(f => f.startsWith(trackId));
      if (file) return path.join(audioDir, file);
    } catch (_) {}
    return null;
  }

  // Resolve generated music by musicId
  if (musicId) {
    try {
      const { MusicModel } = await import('../../database/models/music.model.js');
      const music = MusicModel.findById(musicId);
      if (music) {
        const fp = music.processed_file_path || music.original_file_path;
        if (fp && fs.existsSync(fp)) return fp;
      }
    } catch (_) {}
    return null;
  }

  // URL-based paths (legacy)
  if (inputPath && inputPath.startsWith('/api/mastering/')) {
    return convertMasteringUrlToPath(inputPath);
  }
  if (inputPath && inputPath.startsWith('/api/music/')) {
    return convertMusicUrlToPath(inputPath);
  }

  return null;
}

function tempOut(ext) {
  return `/tmp/audio_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext || 'mp3'}`;
}

/**
 * AudioController - HTTP handlers for audio processing
 */
export const AudioController = {
  /**
   * Process audio with chain operations
   * POST /api/audio/process
   */
  async process(req, res, next) {
    try {
      let { inputPath, operations, options } = req.body;

      if (!inputPath || !operations || !Array.isArray(operations)) {
        return res.status(400).json({
          error: 'inputPath and operations array are required',
        });
      }

      // Generate outputPath server-side to prevent path traversal
      const outputFormat = options?.format || 'mp3';
      const outputPath = `/tmp/processed_${Date.now()}.${outputFormat}`;

      // Convert HTTP URL to filesystem path for mastering uploads
      if (inputPath.startsWith('/api/mastering/')) {
        const convertedPath = convertMasteringUrlToPath(inputPath);
        if (convertedPath) {
          logger.info('Converted mastering URL to filesystem path', { inputPath, convertedPath });
          inputPath = convertedPath;
        } else {
          logger.error('Failed to convert mastering URL', { inputPath });
          return res.status(400).json({
            error: 'Failed to find mastering file - file may not exist',
          });
        }
      }

      // Convert music API URL to filesystem path
      if (inputPath.startsWith('/api/music/')) {
        const convertedPath = await convertMusicUrlToPath(inputPath);
        if (convertedPath) {
          logger.info('Converted music URL to filesystem path', { inputPath, convertedPath });
          inputPath = convertedPath;
        } else {
          logger.error('Failed to convert music URL', { inputPath });
          return res.status(400).json({
            error: 'Music file not found or not available',
          });
        }
      }

      if (!inputPath || !fs.existsSync(inputPath)) {
        return res.status(400).json({
          error: 'inputPath is required and must exist',
        });
      }

      logger.info('Processing audio', { inputPath, operations, outputPath });

      const result = await audioService.processAudio(
        inputPath,
        operations,
        outputPath,
        options
      );

      // Run mastering on the processed file
      const masteringService = new AudioMasteringService(storage.storageDir);
      const masteredPath = outputPath.replace(/\.[^.]+$/, '_mastered.wav');

      try {
        await masteringService.masterToSpotify(result.filePath, masteredPath);
        logger.info('Mastering completed', { masteredPath });

        // Generate download URL - serve from /api/audio/download/:filename
        const downloadUrl = `/api/audio/download/${path.basename(masteredPath)}`;

        res.json({
          message: 'Audio processed and mastered successfully',
          filePath: result.filePath,
          duration: result.duration,
          downloadUrl,
          masteredFile: masteredPath,
        });
      } catch (masterErr) {
        logger.error('Mastering failed, returning processed file', { error: masterErr.message });
        // If mastering fails, still return the processed file
        const downloadUrl = `/api/audio/download/${path.basename(result.filePath)}`;
        res.json({
          message: 'Audio processed (mastering failed)',
          filePath: result.filePath,
          duration: result.duration,
          downloadUrl,
          masteredFile: null,
        });
      }
    } catch (error) {
      next(error);
    }
  },

  /**
   * Trim audio
   * POST /api/audio/trim
   * Accepts: trackId+projectId | musicId | inputPath; startTime/startSec; endTime/endSec
   */
  async trim(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) {
        return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      }

      const startSec = req.body.startSec ?? req.body.startTime ?? 0;
      const endSec = req.body.endSec ?? req.body.endTime;
      if (endSec == null || typeof endSec !== 'number') {
        return res.status(400).json({ error: 'endSec (or endTime) is required' });
      }

      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.trimAudio(resolvedPath, startSec, endSec, outputPath, {
        format: req.body.format,
        bitrate: req.body.bitrate,
      });

      res.json({ message: 'Audio trimmed successfully', ...result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Change audio speed
   * POST /api/audio/speed
   * Accepts: speed | tempoFactor
   */
  async changeSpeed(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) {
        return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      }

      const tempoFactor = req.body.tempoFactor ?? req.body.speed;
      if (typeof tempoFactor !== 'number') {
        return res.status(400).json({ error: 'speed (or tempoFactor) must be a number' });
      }
      if (tempoFactor <= 0 || tempoFactor > 10) {
        return res.status(400).json({ error: 'tempoFactor must be between 0.01 and 10' });
      }

      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.changeSpeed(resolvedPath, tempoFactor, outputPath, {
        format: req.body.format,
        bitrate: req.body.bitrate,
      });

      res.json({ message: 'Audio speed changed successfully', ...result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Adjust audio volume
   * POST /api/audio/volume
   */
  async adjustVolume(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) {
        return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      }

      const gain = req.body.gain ?? req.body.level;
      if (typeof gain !== 'number') {
        return res.status(400).json({ error: 'gain must be a number' });
      }

      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.adjustVolume(resolvedPath, gain, outputPath, {
        format: req.body.format,
        bitrate: req.body.bitrate,
      });

      res.json({ message: 'Audio volume adjusted successfully', ...result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add fade in effect
   * POST /api/audio/fade-in
   */
  async fadeIn(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) {
        return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      }

      const durationSec = req.body.durationSec ?? req.body.duration ?? 2;
      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.fadeIn(resolvedPath, durationSec, outputPath, {
        format: req.body.format,
        bitrate: req.body.bitrate,
      });

      res.json({ message: 'Fade in added successfully', ...result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add fade out effect
   * POST /api/audio/fade-out
   */
  async fadeOut(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) {
        return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      }

      const durationSec = req.body.durationSec ?? req.body.duration ?? 2;
      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.fadeOut(resolvedPath, durationSec, outputPath, {
        format: req.body.format,
        bitrate: req.body.bitrate,
      });

      res.json({ message: 'Fade out added successfully', ...result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Reverse audio
   * POST /api/audio/reverse
   */
  async reverse(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) {
        return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      }

      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.reverseAudio(resolvedPath, outputPath, {
        format: req.body.format,
        bitrate: req.body.bitrate,
      });

      res.json({ message: 'Audio reversed successfully', ...result });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get audio metadata
   * GET /api/audio/metadata/:path
   */
  async getMetadata(req, res, next) {
    try {
      const idOrPath = req.params.id || req.params.path;

      if (!idOrPath) {
        return res.status(400).json({ error: 'Music ID or file path is required' });
      }

      // Try to resolve as music ID first, then fall back to file path
      let filePath = decodeURIComponent(idOrPath);

      // If it looks like a music ID (not an absolute path), look up in DB
      if (!filePath.startsWith('/')) {
        const { MusicModel } = await import('../../database/models/music.model.js');
        const music = MusicModel.findById(filePath);
        if (!music) {
          return res.status(404).json({ error: 'Music not found' });
        }
        const fp = music.processed_file_path || music.original_file_path;
        if (!fp || !fs.existsSync(fp)) {
          return res.status(404).json({ error: 'Audio file not available' });
        }
        filePath = fp;
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const metadata = await audioService.getMetadata(filePath);
      res.json(metadata);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Serve audio file
   * GET /api/audio/file/:path
   */
  async getFile(req, res, next) {
    try {
      const filePath = req.params[0] || req.params.path;

      if (!filePath) {
        return res.status(400).json({
          error: 'File path is required',
        });
      }

      const decodedPath = decodeURIComponent(filePath);

      // Security check - ensure path is within allowed directories
      const allowedDirs = [
        storage.storageDir,
        storage.projectsDir,
      ];

      const isAllowed = allowedDirs.some((dir) =>
        decodedPath.startsWith(dir)
      );

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Access denied: file path outside allowed directories',
        });
      }

      const fileBuffer = storage.readFile(decodedPath);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${path.basename(decodedPath)}"`,
        'Content-Length': fileBuffer.length,
      });

      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Download processed audio file
   * GET /api/audio/download/:filename
   */
  async download(req, res, next) {
    try {
      const { filename } = req.params;

      if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
      }

      // Security: only allow downloaded files from known paths
      // Accept both full paths and just basenames (e.g., processed_123_mastered.wav)
      const safeBasenames = ['processed_', '_mastered.wav'];
      const isSafe = safeBasenames.some(p => filename.includes(p));

      if (!isSafe) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const filePath = filename.includes('/tmp/') ? filename : `/tmp/${filename}`;

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(filename).toLowerCase();

      const contentTypes = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
      };

      res.set({
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length,
      });

      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  },

  async normalize(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.normalizeAudio(resolvedPath, outputPath, {
        targetLUFS: req.body.targetLUFS,
        format: req.body.format,
        bitrate: req.body.bitrate,
      });
      res.json({ message: 'Audio normalized successfully', ...result });
    } catch (error) { next(error); }
  },

  async reverb(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      // accept level as alias for wetLevel
      const wetLevel = req.body.wetLevel ?? req.body.level;
      const result = await audioService.applyReverb(resolvedPath, outputPath, {
        roomScale: req.body.roomScale,
        damping: req.body.damping,
        wetLevel,
        format: req.body.format,
        bitrate: req.body.bitrate,
      });
      res.json({ message: 'Reverb applied successfully', ...result });
    } catch (error) { next(error); }
  },

  async echo(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.applyEcho(resolvedPath, outputPath, {
        delay: req.body.delay,
        decay: req.body.decay,
        format: req.body.format,
        bitrate: req.body.bitrate,
      });
      res.json({ message: 'Echo applied successfully', ...result });
    } catch (error) { next(error); }
  },

  async bassBoost(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.applyBassBoost(resolvedPath, outputPath, {
        gainDb: req.body.gainDb,
        format: req.body.format,
        bitrate: req.body.bitrate,
      });
      res.json({ message: 'Bass boost applied successfully', ...result });
    } catch (error) { next(error); }
  },

  async pitchShift(req, res, next) {
    try {
      const resolvedPath = await resolveInputPath(req.body);
      if (!resolvedPath) return res.status(400).json({ error: 'Could not resolve audio source. Provide trackId+projectId, musicId, or inputPath' });
      if (typeof req.body.semitones !== 'number') return res.status(400).json({ error: 'semitones must be a number' });
      const outputPath = req.body.outputPath || tempOut(req.body.format || 'mp3');
      const result = await audioService.applyPitchShift(resolvedPath, outputPath, {
        semitones: req.body.semitones,
        format: req.body.format,
        bitrate: req.body.bitrate,
      });
      res.json({ message: 'Pitch shifted successfully', ...result });
    } catch (error) { next(error); }
  },

  async removeVocals(req, res, next) {
    try {
      const { musicId, projectId } = req.body;
      if (!musicId) return res.status(400).json({ error: 'musicId is required' });
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const { MusicModel } = await import('../../database/models/music.model.js');
      const music = MusicModel.findById(musicId);
      if (!music) return res.status(404).json({ error: 'Music not found' });

      const inputPath = music.processed_file_path || music.original_file_path;
      if (!inputPath || !fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Audio file not found on disk' });
      }

      const sqliteJob = JobModel.create({
        projectId,
        type: 'vocal-removal',
        inputParams: { musicId, inputPath },
      });

      const { queues } = await import('../../queue/queue.config.js');
      await queues.vocalRemoval.add('remove-vocals', {
        musicId,
        projectId,
        inputPath,
        originalTitle: music.title || 'Track',
        jobId: sqliteJob.id,
      });

      res.status(202).json({ jobId: sqliteJob.id });
    } catch (err) {
      next(err);
    }
  },
};
