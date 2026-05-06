import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { nanoid } from 'nanoid';
import storage from '../../utils/storage.util.js';
import logger from '../../utils/logger.js';

const SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'ogg', 'm4a'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * UploadService - Handles file uploads and URL fetches
 */
export class UploadService {
  /**
   * Get audio directory path for a project
   * @param {string} projectId - Project ID
   * @returns {string} - Audio directory path
   */
  getAudioDir(projectId) {
    const projectDir = storage.getProjectDir(projectId);
    const audioDir = path.join(projectDir, 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    return audioDir;
  }

  /**
   * Validate audio format
   * @param {string} format - File extension
   * @returns {boolean}
   */
  isValidFormat(format) {
    return SUPPORTED_FORMATS.includes(format.toLowerCase());
  }

  /**
   * Validate file size
   * @param {number} size - File size in bytes
   * @returns {boolean}
   */
  isValidSize(size) {
    return size <= MAX_FILE_SIZE;
  }

  /**
   * Handle multipart file upload
   * @param {object} file - Uploaded file from multer/busboy
   * @param {string} projectId - Project ID
   * @returns {Promise<object>} - Upload result
   */
  async uploadFile(file, projectId) {
    logger.info('UploadService: Processing file upload', {
      originalName: file.originalname,
      size: file.size,
      projectId,
    });

    // Validate project ID
    storage.validateProjectId(projectId);

    // Get file extension
    const ext = path.extname(file.originalname).toLowerCase().slice(1);

    if (!ext) {
      throw new Error('File must have an extension');
    }

    // Validate format
    if (!this.isValidFormat(ext)) {
      throw new Error(`Unsupported format: ${ext}. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
    }

    // Validate size
    if (!this.isValidSize(file.size)) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Generate track ID and target path
    const trackId = nanoid(10);
    const audioDir = this.getAudioDir(projectId);
    const filePath = path.join(audioDir, `${trackId}.${ext}`);

    // Save file
    if (Buffer.isBuffer(file.buffer)) {
      storage.saveAudioFile(file.buffer, filePath);
    } else if (file.path) {
      // File was saved to temp path, move it
      fs.copyFileSync(file.path, filePath);
      fs.unlinkSync(file.path);
    } else {
      throw new Error('Invalid file object: no buffer or path');
    }

    const result = {
      id: trackId,
      filePath,
      originalName: file.originalname,
      size: file.size,
      format: ext,
    };

    logger.info('UploadService: File upload complete', result);

    return result;
  }

  /**
   * Fetch audio from URL
   * @param {string} url - URL to fetch
   * @param {string} projectId - Project ID
   * @returns {Promise<object>} - Fetch result
   */
  async fetchFromUrl(url, projectId) {
    logger.info('UploadService: Fetching from URL', { url, projectId });

    // Validate project ID
    storage.validateProjectId(projectId);

    // Validate URL
    if (!url || typeof url !== 'string') {
      throw new Error('URL is required');
    }

    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Fetch the file
    const response = await axios({
      method: 'get',
      url,
      responseType: 'arraybuffer',
      timeout: 120000, // 2 minute timeout
      maxContentLength: MAX_FILE_SIZE,
      maxBodyLength: MAX_FILE_SIZE,
    });

    // Get content type and determine extension
    const contentType = response.headers['content-type'] || '';
    let ext = this.getExtensionFromMimeType(contentType);

    // Try to get extension from URL if not found in content-type
    if (!ext) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        ext = path.extname(pathname).toLowerCase().slice(1);
      } catch {
        // ignore
      }
    }

    // Default to mp3 if we can't determine
    if (!ext || !this.isValidFormat(ext)) {
      ext = 'mp3';
    }

    // Validate size
    const buffer = Buffer.from(response.data);
    if (!this.isValidSize(buffer.length)) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Generate track ID and save
    const trackId = nanoid(10);
    const audioDir = this.getAudioDir(projectId);
    const filePath = path.join(audioDir, `${trackId}.${ext}`);

    storage.saveAudioFile(buffer, filePath);

    const result = {
      id: trackId,
      filePath,
      originalName: path.basename(url),
      size: buffer.length,
      format: ext,
    };

    logger.info('UploadService: URL fetch complete', result);

    return result;
  }

  /**
   * Map MIME type to file extension
   * @param {string} mimeType - MIME type
   * @returns {string|null}
   */
  getExtensionFromMimeType(mimeType) {
    const mimeMap = {
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/flac': 'flac',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/m4a': 'm4a',
    };
    return mimeMap[mimeType.toLowerCase()] || null;
  }

  /**
   * Get maximum file size
   * @returns {number} - Max size in bytes
   */
  getMaxSize() {
    return MAX_FILE_SIZE;
  }
}

export default new UploadService();