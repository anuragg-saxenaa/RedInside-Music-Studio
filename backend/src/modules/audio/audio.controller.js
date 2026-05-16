import audioService from './audio.service.js';
import storage from '../../utils/storage.util.js';
import logger from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { AudioMasteringService } from '../mastering/mastering.service.js';

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
      const file = files.find(f => f.startsWith(fileId));
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
 * AudioController - HTTP handlers for audio processing
 */
export const AudioController = {
  /**
   * Process audio with chain operations
   * POST /api/audio/process
   */
  async process(req, res, next) {
    try {
      let { inputPath, operations, outputPath, options } = req.body;

      if (!inputPath || !operations || !Array.isArray(operations)) {
        return res.status(400).json({
          error: 'inputPath and operations array are required',
        });
      }

      if (!outputPath) {
        return res.status(400).json({
          error: 'outputPath is required',
        });
      }

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
   */
  async trim(req, res, next) {
    try {
      const { inputPath, startSec, endSec, outputPath, format, bitrate } = req.body;

      if (!inputPath || typeof startSec !== 'number' || typeof endSec !== 'number') {
        return res.status(400).json({
          error: 'inputPath, startSec, and endSec are required',
        });
      }

      if (!outputPath) {
        return res.status(400).json({
          error: 'outputPath is required',
        });
      }

      const result = await audioService.trimAudio(
        inputPath,
        startSec,
        endSec,
        outputPath,
        { format, bitrate }
      );

      res.json({
        message: 'Audio trimmed successfully',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Change audio speed
   * POST /api/audio/speed
   */
  async changeSpeed(req, res, next) {
    try {
      const { inputPath, tempoFactor, outputPath, format, bitrate } = req.body;

      if (!inputPath || typeof tempoFactor !== 'number') {
        return res.status(400).json({
          error: 'inputPath and tempoFactor are required',
        });
      }

      if (tempoFactor <= 0 || tempoFactor > 10) {
        return res.status(400).json({
          error: 'tempoFactor must be between 0.01 and 10',
        });
      }

      if (!outputPath) {
        return res.status(400).json({
          error: 'outputPath is required',
        });
      }

      const result = await audioService.changeSpeed(
        inputPath,
        tempoFactor,
        outputPath,
        { format, bitrate }
      );

      res.json({
        message: 'Audio speed changed successfully',
        ...result,
      });
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
      const { inputPath, gain, outputPath, format, bitrate } = req.body;

      if (!inputPath || typeof gain !== 'number') {
        return res.status(400).json({
          error: 'inputPath and gain are required',
        });
      }

      if (!outputPath) {
        return res.status(400).json({
          error: 'outputPath is required',
        });
      }

      const result = await audioService.adjustVolume(
        inputPath,
        gain,
        outputPath,
        { format, bitrate }
      );

      res.json({
        message: 'Audio volume adjusted successfully',
        ...result,
      });
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
      const { inputPath, durationSec, outputPath, format, bitrate } = req.body;

      if (!inputPath || typeof durationSec !== 'number') {
        return res.status(400).json({
          error: 'inputPath and durationSec are required',
        });
      }

      if (!outputPath) {
        return res.status(400).json({
          error: 'outputPath is required',
        });
      }

      const result = await audioService.fadeIn(
        inputPath,
        durationSec,
        outputPath,
        { format, bitrate }
      );

      res.json({
        message: 'Fade in added successfully',
        ...result,
      });
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
      const { inputPath, durationSec, outputPath, format, bitrate } = req.body;

      if (!inputPath || typeof durationSec !== 'number') {
        return res.status(400).json({
          error: 'inputPath and durationSec are required',
        });
      }

      if (!outputPath) {
        return res.status(400).json({
          error: 'outputPath is required',
        });
      }

      const result = await audioService.fadeOut(
        inputPath,
        durationSec,
        outputPath,
        { format, bitrate }
      );

      res.json({
        message: 'Fade out added successfully',
        ...result,
      });
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
      const { inputPath, outputPath, format, bitrate } = req.body;

      if (!inputPath) {
        return res.status(400).json({
          error: 'inputPath is required',
        });
      }

      if (!outputPath) {
        return res.status(400).json({
          error: 'outputPath is required',
        });
      }

      const result = await audioService.reverseAudio(
        inputPath,
        outputPath,
        { format, bitrate }
      );

      res.json({
        message: 'Audio reversed successfully',
        ...result,
      });
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
      const filePath = req.params.id || req.params.path;

      if (!filePath) {
        return res.status(400).json({
          error: 'File path is required',
        });
      }

      // URL decode the path
      const decodedPath = decodeURIComponent(filePath);
      const metadata = await audioService.getMetadata(decodedPath);

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
};
