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
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      storage.createProjectDirs(projectId);
      const uploadDir = storage.getUploadDir(projectId);
      const fileId = uuidv4();
      const ext = path.extname(req.file.originalname);
      const uploadPath = path.join(uploadDir, `${fileId}${ext}`);

      fs.writeFileSync(uploadPath, req.file.buffer);

      // Get duration using ffprobe
      let duration = 0;
      try {
        const result = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${uploadPath}"`, { encoding: 'utf8' });
        duration = parseFloat(result.trim()) || 0;
      } catch (e) {
        console.error('Failed to get duration:', e);
      }

      res.json({
        id: fileId,
        filename: req.file.originalname,
        originalPath: uploadPath,
        duration,
      });
    } catch (error) {
      next(error);
    }
  },

  async process(req, res, next) {
    try {
      const { fileId, projectId, preset, saveToProject } = req.body;

      const uploadDir = storage.getUploadDir(projectId);
      const files = fs.readdirSync(uploadDir);
      const inputFile = files.find(f => f.startsWith(fileId));
      if (!inputFile) {
        return res.status(404).json({ error: 'File not found' });
      }

      const inputPath = path.join(uploadDir, inputFile);
      const mastersDir = storage.getMastersDir(projectId);
      const outputPath = path.join(mastersDir, `${fileId}_spotify_master.wav`);

      // Get input duration
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
          title: `Mastered ${inputFile}`,
          model: 'upload',
          durationSeconds: inputDuration,
        });
        return res.json({ success: true, music });
      }

      res.json({
        success: true,
        masteredPath: outputPath,
        downloadUrl: `/api/mastering/${fileId}/download/${projectId}`,
      });
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
};