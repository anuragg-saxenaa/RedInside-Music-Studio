import { AudioMasteringService } from './mastering.service.js';
import storage from '../../utils/storage.util.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import JSZip from 'jszip';

// Mastering job status stored in Turso DB (not in-memory — survives Railway
// multi-instance + restarts). Self-heals the table on first use.
let _dbReady = false;
async function getDb() {
  const { default: db } = await import('../../database/connection.js');
  if (!_dbReady) {
    await db.execute(`CREATE TABLE IF NOT EXISTS mastering_jobs (
      id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'processing',
      progress INTEGER DEFAULT 0, result TEXT, error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    _dbReady = true;
  }
  return db;
}
async function setJobStatus(id, data) {
  try {
    const db = await getDb();
    const existing = (await db.execute({ sql: 'SELECT id FROM mastering_jobs WHERE id=?', args: [id] })).rows[0];
    const result = data.results !== undefined ? JSON.stringify({ results: data.results, errors: data.errors, masteredPath: data.masteredPath, r2Key: data.r2Key, success: data.success }) : undefined;
    if (existing) {
      await db.execute({ sql: 'UPDATE mastering_jobs SET status=?, progress=?, result=?, error=? WHERE id=?',
        args: [data.status ?? 'processing', data.progress ?? 0, result ?? null, data.error ?? null, id] });
    } else {
      await db.execute({ sql: 'INSERT INTO mastering_jobs (id, status, progress) VALUES (?,?,?)', args: [id, data.status ?? 'processing', data.progress ?? 0] });
    }
  } catch (e) { /* non-fatal — job status best-effort */ }
}

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

  // GET /api/mastering/status/:jobId — poll async mastering job
  async jobStatus(req, res) {
    try {
      const db = await getDb();
      const row = (await db.execute({ sql: 'SELECT * FROM mastering_jobs WHERE id=?', args: [req.params.jobId] })).rows[0];
      if (!row) return res.status(404).json({ error: 'not found' });
      const result = row.result ? JSON.parse(row.result) : {};
      res.json({ status: row.status, progress: row.progress, error: row.error, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  async process(req, res, next) {
    try {
      const { fileIds, fileId, musicId, musicIds, projectId, preset, saveToProject } = req.body;

      // Determine the list of IDs and whether they're musicIds or uploadedFileIds
      const isMusicId = !!(musicId || musicIds);
      const ids = isMusicId
        ? (Array.isArray(musicIds) ? musicIds : [musicId])
        : (Array.isArray(fileIds) ? fileIds : (fileIds ? [fileIds] : (fileId ? [fileId] : [])));

      if (ids.length === 0) return res.status(400).json({ error: 'No file IDs provided' });

      // Return a jobId immediately — process in background to avoid Railway 60s timeout.
      const jobId = `master-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setJobStatus(jobId, { status: 'processing', progress: 0, results: [], errors: [] });
      res.status(202).json({ jobId, status: 'processing' });

      // Background processing
      (async () => {
        const results = [];
        const errors = [];
        const total = ids.length;

        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          setJobStatus(jobId, { progress: Math.round((i / total) * 80) });
          try {
            if (isMusicId) {
              const { MusicModel } = await import('../../database/models/music.model.js');
              const music = await MusicModel.findById(id);
              if (!music) { errors.push({ musicId: id, error: 'Music not found' }); continue; }

              const r2Key = music.processed_file_path || music.original_file_path;
              if (!r2Key) { errors.push({ musicId: id, error: 'No audio path' }); continue; }

              const pid = projectId || music.project_id;
              const mastersDir = storage.getMastersDir(pid);
              if (!fs.existsSync(mastersDir)) fs.mkdirSync(mastersDir, { recursive: true });

              // Resolve input: local disk first, then pull from R2.
              let inputPath, tempInput = null;
              const localPath = path.isAbsolute(r2Key) ? r2Key : path.join(storage.basePath, r2Key);
              if (fs.existsSync(localPath)) {
                inputPath = localPath;
              } else {
                const buf = await storage.readBufferAnywhere(r2Key);
                if (!buf) { errors.push({ musicId: id, error: 'Audio not found on disk or R2' }); continue; }
                const ext = path.extname(r2Key) || '.mp3';
                tempInput = path.join(mastersDir, `${id}_tmp${ext}`);
                fs.writeFileSync(tempInput, buf);
                inputPath = tempInput;
              }

              const outputPath = path.join(mastersDir, `${id}_spotify_master.wav`);
              await new AudioMasteringService(mastersDir).masterToSpotify(inputPath, outputPath);
              if (tempInput) fs.rmSync(tempInput, { force: true });

              // Upload mastered WAV to R2 so it persists across deploys.
              const r2MasterKey = `projects/${pid}/masters/${id}_spotify_master.wav`;
              try { await storage.saveAudioFile(fs.readFileSync(outputPath), r2MasterKey); } catch (_) {}

              results.push({ musicId: id, status: 'success', masteredPath: outputPath, r2Key: r2MasterKey });
            } else {
              // Uploaded file (not from music library)
              const uploadDir = storage.getUploadDir(projectId);
              const mastersDir = storage.getMastersDir(projectId);
              const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
              const inputFile = files.find(f => f.startsWith(id) && f.match(/\.(mp3|wav|flac|m4a|ogg|aac)$/i));
              if (!inputFile) { errors.push({ fileId: id, error: 'File not found' }); continue; }

              const inputPath = path.join(uploadDir, inputFile);
              const outputPath = path.join(mastersDir, `${id}_spotify_master.wav`);
              if (!fs.existsSync(mastersDir)) fs.mkdirSync(mastersDir, { recursive: true });

              let inputDuration = 0;
              try { inputDuration = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`, { encoding: 'utf8' }).trim()) || 0; } catch (_) {}

              await new AudioMasteringService(mastersDir).masterToSpotify(inputPath, outputPath);

              // Upload to R2
              const r2MasterKey = `projects/${projectId}/masters/${id}_spotify_master.wav`;
              try { await storage.saveAudioFile(fs.readFileSync(outputPath), r2MasterKey); } catch (_) {}

              if (saveToProject) {
                const { MusicModel } = await import('../../database/models/music.model.js');
                const { ProjectModel } = await import('../../database/models/project.model.js');
                const version = await MusicModel.getNextVersion(projectId);
                let title = inputFile;
                try { title = JSON.parse(fs.readFileSync(path.join(uploadDir, `${id}.meta.json`), 'utf8')).originalName || inputFile; } catch (_) {}
                const music = await MusicModel.create({ projectId, version, originalFilePath: r2MasterKey, processedFilePath: r2MasterKey, title, model: 'upload', durationSeconds: inputDuration });
                await ProjectModel.incrementVersion(projectId, 'music');
                results.push({ fileId: id, status: 'success', masteredPath: outputPath, musicId: music.id });
              } else {
                results.push({ fileId: id, status: 'success', masteredPath: outputPath });
              }
            }
          } catch (err) {
            errors.push({ id, error: err.message });
          }
        }

        setJobStatus(jobId, { status: errors.length === ids.length ? 'failed' : 'done', progress: 100, results, errors,
          // Backward-compat fields for single-item callers
          success: results.length > 0,
          masteredPath: results[0]?.masteredPath,
          r2Key: results[0]?.r2Key,
        });
      })().catch(err => setJobStatus(jobId, { status: 'failed', error: err.message }));
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
      if (!fs.existsSync(mastersDir)) fs.mkdirSync(mastersDir, { recursive: true });
      const saved = [];

      for (const fileId of fileIds) {
        // Find mastered WAV: check local disk first, then R2 (cloud-stored after process).
        const localMasterName = `${fileId}_spotify_master.wav`;
        const localMasterPath = path.join(mastersDir, localMasterName);
        const r2MasterKey = `projects/${projectId}/masters/${localMasterName}`;
        let masterPath = null;

        if (fs.existsSync(localMasterPath)) {
          masterPath = localMasterPath;
        } else {
          // Pull from R2
          const buf = await storage.readBufferAnywhere(r2MasterKey);
          if (buf) {
            fs.writeFileSync(localMasterPath, buf);
            masterPath = localMasterPath;
          }
        }

        if (!masterPath) continue; // not mastered yet

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

        // Store mastered WAV in R2 so it plays on cloud + other devices.
        const r2SaveKey = `projects/${projectId}/masters/${localMasterName}`;
        try {
          const wavBuf = fs.readFileSync(masterPath);
          await storage.saveAudioFile(wavBuf, r2SaveKey);
        } catch (_) { /* non-fatal */ }

        const version = await MusicModel.getNextVersion(projectId);
        const music = await MusicModel.create({
          projectId,
          version,
          originalFilePath: r2SaveKey,   // R2 key — readable everywhere
          processedFilePath: r2SaveKey,
          title: localMasterName.replace('_spotify_master.wav', ''),
          model: 'mastering',
          durationSeconds: duration,
        });
        await ProjectModel.incrementVersion(projectId, 'music');

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