// backend/src/utils/storage.util.js
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/env.config.js';

// R2 client (lazy init — only created if driver === 'r2')
let s3Client = null;
function getS3() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return s3Client;
}

class StorageUtil {
  constructor() {
    this.basePath = config.storage.path;
    this.driver = config.storage.driver;
    this.bucket = config.r2?.bucketName || '';
  }

  validateProjectId(projectId) {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('projectId must be a non-empty string');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
      throw new Error('projectId contains invalid characters');
    }
    if (projectId.includes('..') || projectId.includes('/') || projectId.includes('\\')) {
      throw new Error('projectId cannot contain path separators');
    }
    return projectId;
  }

  validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('filename must be a non-empty string');
    }
    const safe = path.basename(filename);
    if (safe !== filename || safe.includes('..')) {
      throw new Error('Invalid filename');
    }
    return safe;
  }

  // --- Path helpers ---

  getProjectDir(projectId) {
    projectId = this.validateProjectId(projectId);
    if (this.driver === 'r2') return `projects/${projectId}`;
    return path.join(this.basePath, 'projects', projectId);
  }

  getGenerationsDir(projectId) {
    if (this.driver === 'r2') return `${this.getProjectDir(projectId)}/generations`;
    return path.join(this.getProjectDir(projectId), 'generations');
  }

  getLyricsDir(projectId) {
    if (this.driver === 'r2') return `${this.getProjectDir(projectId)}/generations/lyrics`;
    return path.join(this.getProjectDir(projectId), 'generations', 'lyrics');
  }

  getMusicDir(projectId) {
    if (this.driver === 'r2') return `${this.getProjectDir(projectId)}/generations/music`;
    return path.join(this.getProjectDir(projectId), 'generations', 'music');
  }

  getMedleyDir(projectId) {
    if (this.driver === 'r2') return `${this.getProjectDir(projectId)}/generations/medley`;
    return path.join(this.getProjectDir(projectId), 'generations', 'medley');
  }

  getVideoDir(projectId) {
    if (this.driver === 'r2') return `${this.getProjectDir(projectId)}/generations/video`;
    return path.join(this.getProjectDir(projectId), 'generations', 'video');
  }

  getArtworkDir(projectId) {
    if (this.driver === 'r2') return `${this.getProjectDir(projectId)}/artwork`;
    return path.join(this.getProjectDir(projectId), 'artwork');
  }

  getUploadDir(projectId) {
    if (this.driver === 'r2') return `${this.getProjectDir(projectId)}/uploads`;
    return path.join(this.getProjectDir(projectId), 'uploads');
  }

  getMastersDir(projectId) {
    if (this.driver === 'r2') return `${this.getProjectDir(projectId)}/masters`;
    return path.join(this.getProjectDir(projectId), 'masters');
  }

  getTempDir(projectId) {
    if (this.driver === 'r2') return `${this.getProjectDir(projectId)}/temp`;
    return path.join(this.getProjectDir(projectId), 'temp');
  }

  getLyricsFilePath(projectId, version) {
    return `${this.getLyricsDir(projectId)}/v${version}.json`;
  }

  getMusicFilePath(projectId, version, type = 'processed') {
    const filename = type === 'original' ? `v${version}-original.mp3` : `v${version}-processed.mp3`;
    return `${this.getMusicDir(projectId)}/${filename}`;
  }

  getMedleyFilePath(projectId, medleyId) {
    return `${this.getMedleyDir(projectId)}/medley-${medleyId}.mp3`;
  }

  getVideoFilePath(projectId, version) {
    return `${this.getVideoDir(projectId)}/v${version}.mp4`;
  }

  getArtworkFilePath(projectId, filename) {
    return `${this.getArtworkDir(projectId)}/${filename}`;
  }

  getTempFilePath(projectId, filename) {
    projectId = this.validateProjectId(projectId);
    filename = this.validateFilename(filename);
    if (this.driver === 'r2') return `projects/${projectId}/temp/${filename}`;
    return path.join(this.basePath, 'projects', projectId, 'temp', filename);
  }

  // --- Internal helpers ---

  // Convert a relative key to a full local path (local driver only)
  // If key is already absolute, return it unchanged to avoid double-joining
  _localPath(key) {
    return path.isAbsolute(key) ? key : path.join(this.basePath, key);
  }

  // --- Core I/O (driver-aware) ---

  createProjectDirs(projectId) {
    // R2 has no directories — no-op
    if (this.driver === 'r2') return;
    this.validateProjectId(projectId);
    const dirs = [
      this.getLyricsDir(projectId),
      this.getMusicDir(projectId),
      this.getMedleyDir(projectId),
      this.getVideoDir(projectId),
      this.getTempDir(projectId),
      this.getArtworkDir(projectId),
      this.getUploadDir(projectId),
      this.getMastersDir(projectId),
    ].map(k => this._localPath(k));
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  async saveAudioFile(buffer, keyOrPath) {
    if (this.driver === 'r2') {
      await getS3().send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: keyOrPath,
        Body: buffer,
        ContentType: 'audio/mpeg',
      }));
      return keyOrPath;
    }
    // keyOrPath may be a relative key or an absolute path (from upload.service.js)
    const fullPath = path.isAbsolute(keyOrPath) ? keyOrPath : this._localPath(keyOrPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }

  async readFile(keyOrPath) {
    if (this.driver === 'r2') {
      const res = await getS3().send(new GetObjectCommand({ Bucket: this.bucket, Key: keyOrPath }));
      const chunks = [];
      for await (const chunk of res.Body) chunks.push(chunk);
      return Buffer.concat(chunks);
    }
    return fs.readFileSync(this._localPath(keyOrPath));
  }

  async deleteFile(keyOrPath) {
    if (this.driver === 'r2') {
      await getS3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: keyOrPath }));
      return;
    }
    const fullPath = this._localPath(keyOrPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async saveLyrics(projectId, version, data) {
    const key = this.getLyricsFilePath(projectId, version);
    const buf = Buffer.from(JSON.stringify(data, null, 2));
    if (this.driver === 'r2') {
      await getS3().send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buf,
        ContentType: 'application/json',
      }));
      return key;
    }
    const fullPath = this._localPath(key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buf);
    return fullPath;
  }

  // Read an artwork/file as a Buffer — tries local disk first, then R2. Returns null if not found anywhere.
  async readBufferAnywhere(keyOrPath) {
    // Local disk
    try {
      const fullPath = path.isAbsolute(keyOrPath) ? keyOrPath : this._localPath(keyOrPath);
      if (fs.existsSync(fullPath)) return fs.readFileSync(fullPath);
    } catch { /* ignore */ }
    // R2
    if (this.hasR2()) {
      try {
        const res = await getS3().send(new GetObjectCommand({ Bucket: this.bucket, Key: this.toR2Key(keyOrPath) }));
        const chunks = [];
        for await (const chunk of res.Body) chunks.push(chunk);
        return Buffer.concat(chunks);
      } catch { /* ignore */ }
    }
    // Google Drive (optional backend) — only if configured + connected
    try {
      const gdrive = await import('../modules/storage/gdrive.js');
      if (gdrive.isConfigured() && (await gdrive.isConnected())) {
        const buf = await gdrive.downloadFile(this.toR2Key(keyOrPath));
        if (buf) return buf;
      }
    } catch { /* gdrive optional */ }
    return null;
  }

  // Normalize any path (absolute local path OR relative) to a relative R2 key
  toR2Key(keyOrPath) {
    if (!keyOrPath) return keyOrPath;
    if (path.isAbsolute(keyOrPath)) {
      const rel = path.relative(this.basePath, keyOrPath);
      return rel.split(path.sep).join('/'); // posix separators for S3
    }
    return keyOrPath.split(path.sep).join('/');
  }

  hasR2() {
    return !!(this.bucket && config.r2.accessKeyId && config.r2.endpoint);
  }

  // Always dual-write artwork: local disk (for local driver serving) AND R2 (for cloud + cross-device sync)
  async saveArtwork(key, buffer, contentType = 'image/png') {
    const r2Key = this.toR2Key(key);
    // Local disk
    try {
      const fullPath = this._localPath(key);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, buffer);
    } catch (e) { /* disk may be read-only on cloud — ignore */ }
    // R2 (if configured)
    if (this.hasR2()) {
      try {
        await getS3().send(new PutObjectCommand({ Bucket: this.bucket, Key: r2Key, Body: buffer, ContentType: contentType }));
      } catch (e) { /* ignore R2 failure, local copy still exists */ }
    }
    return r2Key;
  }

  // Generate presigned URL for direct R2 streaming (default 15min expiry)
  async getPresignedUrl(key, expiresIn = 900) {
    // Works whenever R2 creds + bucket are configured, even if driver is 'local'.
    if (!this.hasR2()) {
      throw new Error('R2 not configured — cannot presign');
    }
    return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: this.bucket, Key: this.toR2Key(key) }), { expiresIn });
  }
}

const storage = new StorageUtil();
export default storage;