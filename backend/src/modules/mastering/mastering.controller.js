import { AudioMasteringService } from './mastering.service.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import JSZip from 'jszip';

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
        // Store original filename so process can use it as title
        fs.writeFileSync(path.join(uploadDir, `${fileId}.meta.json`), JSON.stringify({ originalName: file.originalname }));

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
      const { fileIds, fileId, musicId, musicIds, projectId, preset, saveToProject } = req.body;

      // Handle musicId(s) - look up audio files from existing music DB records
      if (musicId || musicIds) {
        const { MusicModel } = await import('../../database/models/music.model.js');
        const ids = Array.isArray(musicIds) ? musicIds : [musicId];
        const results = [];
        const errors = [];

        for (const mId of ids) {
          try {
            const music = MusicModel.findById(mId);
            if (!music) {
              errors.push({ musicId: mId, error: 'Music not found' });
              continue;
            }

            const inputPath = music.processed_file_path || music.original_file_path;
            if (!inputPath || !fs.existsSync(inputPath)) {
              errors.push({ musicId: mId, error: 'Audio file not found on disk' });
              continue;
            }

            const pid = projectId || music.project_id;
            const mastersDir = storage.getMastersDir(pid);
            if (!fs.existsSync(mastersDir)) fs.mkdirSync(mastersDir, { recursive: true });

            const outputPath = path.join(mastersDir, `${mId}_spotify_master.wav`);
            const service = new AudioMasteringService(mastersDir);
            await service.masterToSpotify(inputPath, outputPath);

            results.push({ musicId: mId, status: 'success', masteredPath: outputPath });
          } catch (err) {
            errors.push({ musicId: mId, error: err.message });
          }
        }

        if (ids.length === 1 && results.length === 1 && errors.length === 0) {
          return res.json({ success: true, masteredPath: results[0].masteredPath });
        }
        return res.json({ results, errors });
      }

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
          const inputFile = files.find(f => f.startsWith(fileId) && f.match(/\.(mp3|wav|flac|m4a|ogg|aac)$/i));

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
            const { ProjectModel } = await import('../../database/models/project.model.js');
            const version = MusicModel.getNextVersion(projectId);
            const music = MusicModel.create({
              projectId,
              version,
              originalFilePath: inputPath,
              processedFilePath: outputPath,
              title: (() => {
              try {
                const meta = JSON.parse(fs.readFileSync(path.join(uploadDir, `${fileId}.meta.json`), 'utf8'));
                return meta.originalName || inputFile;
              } catch { return inputFile; }
            })(),
              model: 'upload',
              durationSeconds: inputDuration,
            });
            ProjectModel.incrementVersion(projectId, 'music');
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
      const file = files.find(f => f.startsWith(fileId) && !f.endsWith('.meta.json'));

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = path.join(uploadDir, file);
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      next(error);
    }
  },

  async saveToMusic(req, res, next) {
    try {
      const { projectId, fileIds } = req.body;

      if (!projectId || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: 'projectId and fileIds required' });
      }

      const mastersDir = storage.getMastersDir(projectId);
      const saved = [];

      // Ensure masters directory exists
      if (!fs.existsSync(mastersDir)) {
        return res.json({ saved: [] });
      }

      for (const fileId of fileIds) {
        const masterFiles = fs.readdirSync(mastersDir).filter(f => f.startsWith(fileId));
        const masterFile = masterFiles.find(f => f.endsWith('_spotify_master.wav'));

        if (!masterFile) {
          continue; // Skip if not mastered
        }

        const masterPath = path.join(mastersDir, masterFile);

        let duration = 0;
        try {
          const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${masterPath}"`, { encoding: 'utf8' });
          duration = parseFloat(dur.trim()) || 0;
        } catch (e) {}

        const { MusicModel } = await import('../../database/models/music.model.js');
        const { ProjectModel } = await import('../../database/models/project.model.js');
        const db = (await import('../../database/connection.js')).default;

        // Ensure project exists in database (create if necessary)
        let projectResult = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [projectId] });
        let project = projectResult.rows[0];
        if (!project) {
          try {
            // Insert directly with the provided projectId
            await db.execute({
              sql: 'INSERT INTO projects (id, name, description, workflow_mode) VALUES (?, ?, ?, ?)',
              args: [projectId, `Mastering Project ${projectId}`, null, 'hybrid'],
            });
            const r2 = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [projectId] });
            project = r2.rows[0];
          } catch (e) {
            // Project may already exist from concurrent request
            const r3 = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [projectId] });
            project = r3.rows[0];
          }
        }

        const version = MusicModel.getNextVersion(projectId);
        const music = MusicModel.create({
          projectId,
          version,
          originalFilePath: masterPath, // mastered file
          processedFilePath: masterPath,
          title: masterFile.replace('_spotify_master.wav', ''),
          model: 'mastering',
          durationSeconds: duration,
        });
        ProjectModel.incrementVersion(projectId, 'music');

        saved.push({ fileId, musicId: music.id, version });
      }

      res.json({ saved });
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

        let filename = f;
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(uploadDir, `${fileId}.meta.json`), 'utf8'));
          if (meta.originalName) filename = meta.originalName;
        } catch (e) {}

        return {
          id: fileId,
          filename,
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

  async downloadZip(req, res, next) {
    try {
      const { projectId, fileIds } = req.query;

      if (!projectId || !fileIds) {
        return res.status(400).json({ error: 'projectId and fileIds required' });
      }

      const ids = fileIds.split(',');
      const mastersDir = storage.getMastersDir(projectId);

      // Check if masters directory exists
      if (!fs.existsSync(mastersDir)) {
        return res.status(404).json({ error: 'Mastered files not found' });
      }

      const zip = new JSZip();

      for (const fileId of ids) {
        const masterFiles = fs.readdirSync(mastersDir).filter(f => f.startsWith(fileId));
        const masterFile = masterFiles.find(f => f.endsWith('_spotify_master.wav'));

        if (masterFile) {
          const filePath = path.join(mastersDir, masterFile);
          const fileData = fs.readFileSync(filePath);
          zip.file(masterFile, fileData);
        }
      }

      if (Object.keys(zip.files).length === 0) {
        return res.status(404).json({ error: 'No mastered files found for specified IDs' });
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="mastered-tracks-${Date.now()}.zip"`,
        'Content-Length': zipBuffer.length
      });

      res.send(zipBuffer);
    } catch (error) {
      next(error);
    }
  },
};