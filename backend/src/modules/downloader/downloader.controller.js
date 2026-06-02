import path from 'path';
import fs from 'fs';
import { DownloaderService } from './downloader.service.js';
import { MusicModel } from '../../database/models/music.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
import logger from '../../utils/logger.js';
import { broadcast } from '../../utils/ws.server.js';

const ALLOWED_HOSTS = ['youtube.com', 'youtu.be', 'www.youtube.com', 'music.youtube.com', 'm.youtube.com'];

// In-memory download status (polling fallback when WebSocket events don't reach client)
const downloadStatus = new Map();
function setStatus(id, data) {
  downloadStatus.set(id, { ...downloadStatus.get(id), ...data, updatedAt: Date.now() });
  // Auto-cleanup after 10 min
  setTimeout(() => downloadStatus.delete(id), 600000);
}

export const DownloaderController = {
  // GET /api/downloader/status/:downloadId — polling fallback for progress
  status(req, res) {
    const s = downloadStatus.get(req.params.downloadId);
    if (!s) return res.status(404).json({ error: 'Unknown downloadId' });
    res.json(s);
  },

  // GET /api/youtube/cookies/status — is the server download cookie configured?
  async cookiesStatus(req, res) {
    try {
      const { hasCookies } = await import('./downloader.service.js');
      res.json({ configured: await hasCookies() });
    } catch (e) { res.status(500).json({ configured: false, error: e.message }); }
  },

  // POST /api/youtube/cookies { cookies } — one-time server setup: store a
  // throwaway YouTube account's cookies.txt (base64) so ALL downloads authenticate.
  async setCookies(req, res) {
    try {
      const raw = String(req.body?.cookies || '');
      if (!raw.trim()) return res.status(400).json({ error: 'cookies required' });
      if (!/# Netscape|youtube\.com|\.google\.com/i.test(raw)) {
        return res.status(400).json({ error: 'That does not look like a cookies.txt export.' });
      }
      const b64 = Buffer.from(raw, 'utf8').toString('base64');
      const { SettingsModel } = await import('../../database/models/settings.model.js');
      await SettingsModel.set('yt_dlp_cookies_b64', b64);
      logger.info('yt-dlp cookies updated', { bytes: raw.length });
      res.json({ success: true, configured: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  // GET /api/youtube/suggest?q=... — instant type-ahead suggestions
  async suggest(req, res) {
    try {
      const suggestions = await DownloaderService.suggest(String(req.query.q || ''));
      res.json({ suggestions });
    } catch { res.json({ suggestions: [] }); }
  },

  // GET /api/youtube/search?q=... — in-app YouTube search (no API key; yt-dlp)
  async search(req, res) {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    try {
      const results = await DownloaderService.search(q, 24);
      res.json({ results });
    } catch (e) {
      logger.error('youtube search failed', { error: e.message });
      res.status(500).json({ error: 'Search failed', results: [] });
    }
  },

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
      // Always download to a real local temp dir (yt-dlp needs filesystem)
      import('os').then(() => {});
      const { tmpdir } = await import('os');
      const outputDir = path.join(tmpdir(), `yt-dl-${downloadId}`);

      setStatus(downloadId, { state: 'running', progress: 5, message: 'Queued…' });
      res.status(202).json({ downloadId });

      (async () => {
        try {
          setStatus(downloadId, { state: 'running', progress: 8, message: 'Fetching video info…' });
          broadcast({ event: 'download.progress', downloadId, progress: 8, message: 'Fetching video info…' });
          await new Promise(r => setTimeout(r, 400));
          setStatus(downloadId, { state: 'running', progress: 12, message: 'Starting download…' });
          broadcast({ event: 'download.progress', downloadId, progress: 12, message: 'Starting download…' });

          const { filePath, title, duration } = await DownloaderService.download(url, outputDir, {
            onProgress: (progress, message) => {
              setStatus(downloadId, { state: 'running', progress, message });
              broadcast({ event: 'download.progress', downloadId, progress, message });
            },
          });

          setStatus(downloadId, { state: 'running', progress: 90, message: 'Saving to library...' });
          broadcast({ event: 'download.progress', downloadId, progress: 90, message: 'Saving to library...' });

          // Always use R2-style key as canonical path (works on both local and cloud)
          const r2Key = `projects/${projectId}/generations/music/${downloadId}.mp3`;
          const buf = fs.readFileSync(filePath);

          // Upload to R2 (always — so cloud can play it)
          try { await storage.saveAudioFile(buf, r2Key); } catch (e) { logger.warn('R2 upload failed, local-only', { error: e.message }); }

          // Also save to local disk at matching path (so local driver can serve it)
          const localPath = path.join(storage.basePath, r2Key);
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
          fs.writeFileSync(localPath, buf);

          const savedPath = r2Key;

          // Clean up temp dir
          fs.rmSync(outputDir, { recursive: true, force: true });

          const version = await MusicModel.getNextVersion(projectId);
          const music = await MusicModel.create({
            projectId,
            title,
            model: 'youtube-download',
            originalFilePath: savedPath,
            processedFilePath: null,
            durationSeconds: duration,
            version,
          });

          await ProjectModel.incrementVersion(projectId, 'music');

          setStatus(downloadId, { state: 'done', progress: 100, result: { musicId: music.id, title, duration } });
          broadcast({
            event: 'download.completed',
            downloadId,
            result: { musicId: music.id, title, duration },
          });
          logger.info('YouTube download completed', { downloadId, musicId: music.id, title });
        } catch (err) {
          logger.error('YouTube download failed', { downloadId, error: err.message });
          setStatus(downloadId, { state: 'error', error: err.message });
          broadcast({ event: 'download.failed', downloadId, error: err.message });
        }
      })();
    } catch (err) {
      next(err);
    }
  },
};
