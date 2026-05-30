import path from 'path';
import fs from 'fs';
import { DownloaderService } from './downloader.service.js';
import { MusicModel } from '../../database/models/music.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import logger from '../../utils/logger.js';
import { broadcast } from '../../utils/ws.server.js';

const ALLOWED_HOSTS = ['youtube.com', 'youtu.be', 'www.youtube.com', 'music.youtube.com', 'm.youtube.com'];

export const DownloaderController = {
  async youtube(req, res, next) {
    try {
      const { url, projectId } = req.body;
      if (!url) return res.status(400).json({ error: 'url is required' });
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL' });
      }
      if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
        return res.status(400).json({ error: 'Only YouTube URLs are supported' });
      }

      const downloadId = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const outputDir = path.join(storage.getProjectDir(projectId), 'downloads', downloadId);

      res.status(202).json({ downloadId });

      (async () => {
        try {
          broadcast({ event: 'download.progress', downloadId, progress: 8, message: 'Fetching video info…' });
          await new Promise(r => setTimeout(r, 400));
          broadcast({ event: 'download.progress', downloadId, progress: 12, message: 'Starting download…' });

          const { filePath, title, duration } = await DownloaderService.download(url, outputDir, {
            onProgress: (progress, message) => {
              broadcast({ event: 'download.progress', downloadId, progress, message });
            },
          });

          broadcast({ event: 'download.progress', downloadId, progress: 90, message: 'Saving to library...' });

          // Copy to project music storage
          const musicDir = path.join(storage.getProjectDir(projectId), 'generations', 'music');
          fs.mkdirSync(musicDir, { recursive: true });
          const destFile = path.join(musicDir, `${downloadId}.mp3`);
          fs.copyFileSync(filePath, destFile);

          const version = await MusicModel.getNextVersion(projectId);
          const music = await MusicModel.create({
            projectId,
            title,
            model: 'youtube-download',
            originalFilePath: destFile,
            processedFilePath: null,
            durationSeconds: duration,
            version,
          });

          await ProjectModel.incrementVersion(projectId, 'music');

          broadcast({
            event: 'download.completed',
            downloadId,
            result: { musicId: music.id, title, duration },
          });
          logger.info('YouTube download completed', { downloadId, musicId: music.id, title });
        } catch (err) {
          logger.error('YouTube download failed', { downloadId, error: err.message });
          broadcast({ event: 'download.failed', downloadId, error: err.message });
        }
      })();
    } catch (err) {
      next(err);
    }
  },
};
