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

  // ── Download job queue (worker = desktop app on a residential IP) ──

  // POST /api/youtube/jobs { url, projectId, jobType? } — enqueue
  // jobType: 'download' (default) saves to library; 'stream' returns a play URL fast
  async createJob(req, res) {
    try {
      const { url, projectId, jobType = 'download' } = req.body || {};
      if (!url) return res.status(400).json({ error: 'url required' });
      if (jobType === 'download' && !projectId) return res.status(400).json({ error: 'projectId required for download' });
      let host; try { host = new URL(url).hostname; } catch { return res.status(400).json({ error: 'Invalid URL' }); }
      if (!ALLOWED_HOSTS.includes(host)) return res.status(400).json({ error: 'Only YouTube URLs supported' });
      const { default: db } = await import('../../database/connection.js');
      await db.execute("CREATE TABLE IF NOT EXISTS download_jobs (id TEXT PRIMARY KEY, url TEXT NOT NULL, project_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', music_id TEXT, title TEXT, error TEXT, claimed_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
      // Self-heal: add columns added after initial deploy (ALTER TABLE skips if already exists via try/catch).
      await db.execute("ALTER TABLE download_jobs ADD COLUMN job_type TEXT DEFAULT 'download'").catch(() => {});
      await db.execute("ALTER TABLE download_jobs ADD COLUMN stream_url TEXT").catch(() => {});
      const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await db.execute({ sql: 'INSERT INTO download_jobs (id, url, project_id, status, job_type) VALUES (?, ?, ?, ?, ?)', args: [id, url, projectId || '', 'pending', jobType] });
      logger.info('job queued', { id, url, jobType });
      res.status(202).json({ jobId: id, status: 'pending', jobType });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  // GET /api/youtube/jobs/next — worker claims the oldest pending job
  async nextJob(req, res) {
    try {
      const { default: db } = await import('../../database/connection.js');
      const r = await db.execute({ sql: "SELECT * FROM download_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1" });
      const job = r.rows?.[0];
      if (!job) return res.json({ job: null });
      const upd = await db.execute({ sql: "UPDATE download_jobs SET status = 'processing', claimed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'", args: [job.id] });
      if (!upd.rowsAffected) return res.json({ job: null });
      res.json({ job: { id: job.id, url: job.url, projectId: job.project_id, jobType: job.job_type || 'download' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  // POST /api/youtube/jobs/:id/result { audioBase64?, streamUrl?, title, duration, ext } — worker result
  async submitJobResult(req, res) {
    try {
      const { id } = req.params;
      const { audioBase64, streamUrl, title, duration, ext } = req.body || {};
      const { default: db } = await import('../../database/connection.js');
      const jr = await db.execute({ sql: 'SELECT * FROM download_jobs WHERE id = ?', args: [id] });
      const job = jr.rows?.[0];
      if (!job) return res.status(404).json({ error: 'job not found' });

      // Stream job — just store the URL and return immediately.
      if (job.job_type === 'stream' || streamUrl) {
        if (!streamUrl) {
          await db.execute({ sql: "UPDATE download_jobs SET status='failed', error=? WHERE id=?", args: [String(req.body?.error || 'no stream url'), id] });
          return res.status(400).json({ error: 'streamUrl required for stream jobs' });
        }
        await db.execute({ sql: "UPDATE download_jobs SET status='done', stream_url=?, title=? WHERE id=?", args: [streamUrl, title || '', id] });
        logger.info('stream job completed', { id, title });
        return res.json({ success: true, streamUrl });
      }

      if (!audioBase64) {
        await db.execute({ sql: "UPDATE download_jobs SET status='failed', error=? WHERE id=?", args: [String(req.body?.error || 'no audio'), id] });
        return res.status(400).json({ error: 'audioBase64 required' });
      }
      const buf = Buffer.from(audioBase64, 'base64');
      const projectId = job.project_id;
      const key = `projects/${projectId}/generations/music/${id}.${(ext || 'm4a').replace(/[^a-z0-9]/gi, '')}`;
      try { await storage.saveAudioFile(buf, key); } catch (e) { logger.warn('R2 save failed', { error: e.message }); }
      try { const lp = path.join(storage.basePath, key); fs.mkdirSync(path.dirname(lp), { recursive: true }); fs.writeFileSync(lp, buf); } catch { /* cloud disk read-only */ }
      const version = await MusicModel.getNextVersion(projectId);
      const music = await MusicModel.create({ projectId, title: title || 'YouTube import', model: 'youtube-download', originalFilePath: key, processedFilePath: null, durationSeconds: duration || 0, version });
      await ProjectModel.incrementVersion(projectId, 'music');
      await db.execute({ sql: "UPDATE download_jobs SET status='done', music_id=?, title=? WHERE id=?", args: [music.id, title || '', id] });
      logger.info('download job completed by worker', { id, musicId: music.id });
      res.json({ success: true, musicId: music.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  // GET /api/youtube/jobs/:id — client polls status
  async jobStatus(req, res) {
    try {
      const { default: db } = await import('../../database/connection.js');
      const r = await db.execute({ sql: 'SELECT id, status, music_id, title, error, job_type, stream_url FROM download_jobs WHERE id = ?', args: [req.params.id] });
      const j = r.rows?.[0];
      if (!j) return res.status(404).json({ error: 'not found' });
      res.json({ id: j.id, status: j.status, musicId: j.music_id, title: j.title, error: j.error, jobType: j.job_type, streamUrl: j.stream_url });
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
