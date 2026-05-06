import uploadService from './upload.service.js';
import logger from '../../utils/logger.js';

/**
 * UploadController - HTTP handlers for file uploads
 */
export const UploadController = {
  /**
   * Handle multipart file upload
   * POST /api/upload/audio
   */
  async uploadAudio(req, res, next) {
    try {
      const { projectId } = req.body;
      const file = req.file;

      if (!projectId) {
        return res.status(400).json({
          error: 'projectId is required',
        });
      }

      if (!file) {
        return res.status(400).json({
          error: 'No file uploaded',
        });
      }

      logger.info('UploadController: Processing audio upload', {
        projectId,
        originalName: file.originalname,
        size: file.size,
      });

      const result = await uploadService.uploadFile(file, projectId);

      res.json({
        message: 'File uploaded successfully',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Handle URL fetch
   * POST /api/upload/url
   */
  async uploadFromUrl(req, res, next) {
    try {
      const { url, projectId } = req.body;

      if (!url) {
        return res.status(400).json({
          error: 'url is required',
        });
      }

      if (!projectId) {
        return res.status(400).json({
          error: 'projectId is required',
        });
      }

      logger.info('UploadController: Processing URL fetch', {
        url,
        projectId,
      });

      const result = await uploadService.fetchFromUrl(url, projectId);

      res.json({
        message: 'File fetched successfully',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get supported formats and max size
   * GET /api/upload/supported-formats
   */
  async getSupportedFormats(req, res) {
    res.json({
      formats: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
      maxSize: uploadService.getMaxSize(),
      maxSizeMB: uploadService.getMaxSize() / 1024 / 1024,
    });
  },
};

export default UploadController;