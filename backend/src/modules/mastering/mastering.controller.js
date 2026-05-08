import { AudioMasteringService } from './mastering.service.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

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

      res.json({
        id: fileId,
        filename: req.file.originalname,
        originalPath: uploadPath,
        duration: 0,
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

      const service = new AudioMasteringService(mastersDir);
      await service.masterToSpotify(inputPath, outputPath);

      if (saveToProject) {
        const { MusicModel } = await import('../../database/models/music.model.js');
        const music = MusicModel.create({
          projectId,
          originalFilePath: inputPath,
          processedFilePath: outputPath,
          title: `Mastered ${inputFile}`,
          model: 'upload',
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
};