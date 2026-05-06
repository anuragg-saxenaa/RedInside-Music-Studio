import audioService from './audio.service.js';
import storage from '../../utils/storage.util.js';
import logger from '../../utils/logger.js';

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
      const { inputPath, operations, outputPath, options } = req.body;

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

      logger.info('Processing audio', { inputPath, operations, outputPath });

      const result = await audioService.processAudio(
        inputPath,
        operations,
        outputPath,
        options
      );

      res.json({
        message: 'Audio processed successfully',
        ...result,
      });
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
      const { path: filePath } = req.params;

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
      const { path: filePath } = req.params;

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
};
