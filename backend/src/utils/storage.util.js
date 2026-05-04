// backend/src/utils/storage.util.js
import fs from 'fs';
import path from 'path';
import config from '../config/env.config.js';

class StorageUtil {
  constructor() {
    this.basePath = config.storage.path;
  }

  validateProjectId(projectId) {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('projectId must be a non-empty string');
    }
    // Only allow alphanumeric, hyphens, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
      throw new Error('projectId contains invalid characters');
    }
    // Prevent directory traversal
    if (projectId.includes('..') || projectId.includes('/') || projectId.includes('\\')) {
      throw new Error('projectId cannot contain path separators');
    }
    return projectId;
  }

  validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('filename must be a non-empty string');
    }
    // Use path.basename to prevent traversal
    const safe = path.basename(filename);
    if (safe !== filename || safe.includes('..')) {
      throw new Error('Invalid filename');
    }
    return safe;
  }

  getProjectDir(projectId) {
    projectId = this.validateProjectId(projectId);
    return path.join(this.basePath, 'projects', projectId);
  }

  getGenerationsDir(projectId) {
    return path.join(this.getProjectDir(projectId), 'generations');
  }

  getLyricsDir(projectId) {
    return path.join(this.getGenerationsDir(projectId), 'lyrics');
  }

  getMusicDir(projectId) {
    return path.join(this.getGenerationsDir(projectId), 'music');
  }

  getTempDir(projectId) {
    return path.join(this.getProjectDir(projectId), 'temp');
  }

  createProjectDirs(projectId) {
    projectId = this.validateProjectId(projectId);
    const dirs = [
      this.getLyricsDir(projectId),
      this.getMusicDir(projectId),
      this.getTempDir(projectId),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  getLyricsFilePath(projectId, version) {
    return path.join(this.getLyricsDir(projectId), `v${version}.json`);
  }

  getMusicFilePath(projectId, version, type = 'processed') {
    const filename = type === 'original' ? `v${version}-original.mp3` : `v${version}-processed.mp3`;
    return path.join(this.getMusicDir(projectId), filename);
  }

  getTempFilePath(projectId, filename) {
    projectId = this.validateProjectId(projectId);
    filename = this.validateFilename(filename);
    return path.join(this.getTempDir(projectId), filename);
  }

  saveLyrics(projectId, version, data) {
    try {
      projectId = this.validateProjectId(projectId);
      this.createProjectDirs(projectId);
      const filePath = this.getLyricsFilePath(projectId, version);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return filePath;
    } catch (error) {
      throw new Error(`Failed to save lyrics: ${error.message}`);
    }
  }

  saveAudioFile(buffer, filePath) {
    try {
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (error) {
      throw new Error(`Failed to save audio file: ${error.message}`);
    }
  }

  readFile(filePath) {
    try {
      return fs.readFileSync(filePath);
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
}

const storage = new StorageUtil();
export default storage;
