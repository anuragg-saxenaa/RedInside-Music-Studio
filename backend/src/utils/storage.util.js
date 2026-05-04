// backend/src/utils/storage.util.js
import fs from 'fs';
import path from 'path';
import config from '../config/env.config.js';

class StorageUtil {
  constructor() {
    this.basePath = config.storage.path;
  }

  getProjectDir(projectId) {
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
    return path.join(this.getTempDir(projectId), filename);
  }

  saveLyrics(projectId, version, data) {
    const filePath = this.getLyricsFilePath(projectId, version);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }

  saveAudioFile(buffer, filePath) {
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  readFile(filePath) {
    return fs.readFileSync(filePath);
  }

  deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

const storage = new StorageUtil();
export default storage;
