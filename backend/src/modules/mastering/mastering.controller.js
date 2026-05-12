import { AudioMasteringService } from './mastering.service.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';

export const MasteringController = {
  async upload(req, res, next) {
    try {
      const { projectId } = req.params;
      const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);

      if (files.length === 0) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      storage.createProjectDirs(projectId);
      const uploadDir = storage.getUploadDir(projectId);

      const uploadedFiles = files.map(file => {
        const fileId = uuidv4();
        const ext = path.extname(file.originalname);
        const uploadPath = path.join(uploadDir, `${fileId}${ext}`);
        fs.writeFileSync(uploadPath, file.buffer);

        // Get duration using ffprobe
        let duration = 0;
        try {
          const result = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${uploadPath}"`, { encoding: 'utf8' });
          duration = parseFloat(result.trim()) || 0;
        } catch (e) {
          console.error('Failed to get duration:', e);
        }

        return {
          id: fileId,
          filename: file.originalname,
          originalPath: uploadPath,
          duration,
        };
      });

      // Return array for both single and multi-file uploads
      res.json({ files: uploadedFiles });
    } catch (error) {
      next(error);
    }
  },

  async process(req, res, next) {
    try {
      const { fileIds, fileId, projectId, preset, saveToProject } = req.body;

      // Handle single ID or array - support both fileId and fileIds
      const isSingle = !fileIds;
      const ids = Array.isArray(fileIds) ? fileIds : (fileIds ? [fileIds] : (fileId ? [fileId] : []));

      if (ids.length === 0) {
        return res.status(400).json({ error: 'No fileIds provided' });
      }

      const uploadDir = storage.getUploadDir(projectId);
      const mastersDir = storage.getMastersDir(projectId);
      const results = [];
      const errors = [];

      for (const fileId of ids) {
        try {
          const files = fs.readdirSync(uploadDir);
          const inputFile = files.find(f => f.startsWith(fileId));

          if (!inputFile) {
            errors.push({ fileId, error: 'File not found' });
            continue;
          }

          const inputPath = path.join(uploadDir, inputFile);
          const outputPath = path.join(mastersDir, `${fileId}_spotify_master.wav`);

          let inputDuration = 0;
          try {
            const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`, { encoding: 'utf8' });
            inputDuration = parseFloat(dur.trim()) || 0;
          } catch (e) {}

          const service = new AudioMasteringService(mastersDir);
          await service.masterToSpotify(inputPath, outputPath);

          if (saveToProject) {
            const { MusicModel } = await import('../../database/models/music.model.js');
            const version = MusicModel.getNextVersion(projectId);
            const music = MusicModel.create({
              projectId,
              version,
              originalFilePath: inputPath,
              processedFilePath: outputPath,
              title: inputFile,
              model: 'upload',
              durationSeconds: inputDuration,
            });
            results.push({ fileId, status: 'success', masteredPath: outputPath, musicId: music.id, version });
          } else {
            results.push({ fileId, status: 'success', masteredPath: outputPath });
          }
        } catch (err) {
          errors.push({ fileId, error: err.message });
        }
      }

      // Backward compatible response for single fileId
      if (isSingle && results.length === 1 && errors.length === 0) {
        return res.json({
          success: true,
          masteredPath: results[0].masteredPath,
          downloadUrl: `/api/mastering/${results[0].fileId}/download/${projectId}`,
        });
      }

      res.json({ results, errors });
    } catch (error) {
      next(error);
    }
  },

  async download(req, res, next) {
    try {
      const { fileId, projectId } = req.params;
      const mastersDir = storage.getMastersDir(projectId);
      const filePath = path.join(mastersDir, `${fileId}_spotify_master.wav`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Mastered file not found' });
      }

      res.download(filePath);
    } catch (error) {
      next(error);
    }
  },

  async serveOriginal(req, res, next) {
    try {
      const { fileId, projectId } = req.params;
      const uploadDir = storage.getUploadDir(projectId);

      if (!fs.existsSync(uploadDir)) {
        return res.status(404).json({ error: 'Upload directory not found' });
      }

      const files = fs.readdirSync(uploadDir);
      const file = files.find(f => f.startsWith(fileId));

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = path.join(uploadDir, file);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  },

  async listFiles(req, res, next) {
    try {
      const { projectId } = req.params;
      const mastersDir = storage.getMastersDir(projectId);
      const uploadDir = storage.getUploadDir(projectId);

      if (!fs.existsSync(uploadDir)) {
        return res.json({ files: [] });
      }

      const uploadFiles = fs.readdirSync(uploadDir).filter(f => f.match(/\.(mp3|wav|flac|m4a|ogg)$/i));
      const masterFiles = fs.existsSync(mastersDir) ? fs.readdirSync(mastersDir) : [];

      const files = uploadFiles.map(f => {
        const fileId = f.replace(/\.(mp3|wav|flac|m4a|ogg)$/i, '');
        const masterFile = masterFiles.find(m => m.startsWith(fileId));
        const masterPath = masterFile ? path.join(mastersDir, masterFile) : null;

        let duration = 0;
        const fullPath = path.join(uploadDir, f);
        try {
          const result = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullPath}"`, { encoding: 'utf8' });
          duration = parseFloat(result.trim()) || 0;
        } catch (e) {}

        return {
          id: fileId,
          filename: f,
          originalPath: fullPath,
          masteredPath: masterPath,
          duration,
          status: masterPath ? 'mastered' : 'pending',
        };
      });

      res.json({ files });
    } catch (error) {
      next(error);
    }
  },
};