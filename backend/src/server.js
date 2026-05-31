import { registerImageRoutes } from './routes/image.routes.js';
import { registerVoiceRoutes } from './routes/voice.routes.js';
import { registerUploadRoutes } from './api/routes/upload.routes.js';
import { VideoRoutes } from './api/routes/video.routes.js';
import { HistoryRoutes } from './api/routes/history.routes.js';
import { MasteringRoutes } from './api/routes/mastering.routes.js';
import { ViralRoutes } from './api/routes/viral.routes.js';
import { SettingsRoutes } from './api/routes/settings.routes.js';
import { PlaylistRoutes } from './api/routes/playlist.routes.js';
import { MusicTagsRoutes } from './api/routes/music-tags.routes.js';
import { MusicNotesRoutes } from './api/routes/music-notes.routes.js';
import { SocialExportRoutes } from './api/routes/social-export.routes.js';
import { ShareRoutes } from './api/routes/share.routes.js';
import { AlbumRoutes } from './api/routes/album.routes.js';
import { initWebSocketServer } from './utils/ws.server.js';
import express from 'express';
import cors from 'cors';
import config from './config/env.config.js';
import logger from './utils/logger.js';
import errorMiddleware from './api/middleware/error.middleware.js';
import { clerkMiddleware, requireAuth } from '@clerk/express';
import { LyricsRoutes } from './api/routes/lyrics.routes.js';
import { MusicRoutes } from './api/routes/music.routes.js';
import { JobsRoutes } from './api/routes/jobs.routes.js';
import { ProjectsController } from './api/routes/projects.routes.js';
import { MedleyRoutes } from './api/routes/medley.routes.js';
import { AudioRoutes } from './api/routes/audio.routes.js';
import { DownloaderRoutes } from './api/routes/downloader.routes.js';
import { FfmpegRoutes } from './api/routes/ffmpeg.routes.js';
import { LyricsController } from './modules/lyrics/lyrics.controller.js';

// Import workers to initialize them
import './queue/workers/lyrics.worker.js';
import './queue/workers/music.worker.js';
import './queue/workers/ffmpeg.worker.js';
import './queue/workers/video.worker.js';
import './queue/workers/vocal-removal.worker.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (!process.env.CLERK_SECRET_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('CLERK_SECRET_KEY env var is required in production');
}

// Enable Clerk auth only in production (skip in local dev and test)
// Support both CLERK_PUBLISHABLE_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isProduction = process.env.NODE_ENV === 'production';
const hasRealClerkKey = isProduction && clerkPublishableKey && clerkPublishableKey.startsWith('pk_') && !clerkPublishableKey.includes('placeholder');

if (hasRealClerkKey) {
  app.use(clerkMiddleware());

  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/share/')) return next();
    if (req.path === '/test/seed-project' || req.path.startsWith('/test/')) return next();
    // Audio file streaming — loaded by <audio> element which can't send JWT
    if (req.path.match(/\/music\/[^/]+\/(file|download)$/)) return next();
    // GET artwork (per-song + album) — loaded by <img> element which can't send JWT
    if (req.method === 'GET' && req.path.includes('/artwork')) return next();
    return requireAuth()(req, res, next);
  });
} else {
  // Local dev / test — inject a stable dev user so routes that read req.auth.userId work
  app.use((req, res, next) => {
    req.auth = { userId: process.env.DEV_USER_ID || 'dev-user' };
    next();
  });
}

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
  });
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Project routes
const projectRoutes = [
  { method: 'post', path: '/api/projects', handler: ProjectsController.create },
  { method: 'get', path: '/api/projects', handler: ProjectsController.getAll },
  { method: 'get', path: '/api/projects/:id', handler: ProjectsController.getById },
  { method: 'put', path: '/api/projects/:id', handler: ProjectsController.update },
  { method: 'delete', path: '/api/projects/:id', handler: ProjectsController.delete },
  { method: 'get', path: '/api/projects/:id/artwork', handler: ProjectsController.getArtwork },
  { method: 'post', path: '/api/projects/:id/artwork', handler: ProjectsController.saveArtwork },
  { method: 'post', path: '/api/projects/:id/artwork/fetch-image', handler: ProjectsController.fetchImage },
  { method: 'get', path: '/api/projects/:id/artwork/:musicId', handler: ProjectsController.getMusicArtwork },
  { method: 'post', path: '/api/projects/:id/albums/:albumId/artwork', handler: ProjectsController.saveAlbumArtwork },
  { method: 'get',  path: '/api/projects/:id/albums/:albumId/artwork', handler: ProjectsController.getAlbumArtwork },
  { method: 'get', path: '/api/projects/:id/history', handler: (req, res, next) => { req.params.projectId = req.params.id; return import('./modules/history/history.controller.js').then(m => m.HistoryController.getProjectHistory(req, res, next)); } },
];

// Register routes
projectRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

LyricsRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

MusicRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

JobsRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

MedleyRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

AudioRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

DownloaderRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

FfmpegRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

VideoRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

HistoryRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

MasteringRoutes.forEach(route => {
  const args = [route.path, ...(route.middlewares || []), route.handler];
  app[route.method](...args);
});

ViralRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

SettingsRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

PlaylistRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

MusicTagsRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

MusicNotesRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

SocialExportRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

ShareRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

AlbumRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

registerImageRoutes(app);
registerVoiceRoutes(app);
registerUploadRoutes(app);

// Test routes (E2E testing only)
const { TestRoutes } = await import('./api/routes/test.routes.js');
TestRoutes.forEach(route => {
  app[route.method](route.path, route.handler);
});

// Error handling middleware
app.use(errorMiddleware);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = config.server.port;

const httpServer = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    env: config.server.env,
    nodeVersion: process.version,
  });
  initWebSocketServer(httpServer);
});

export default app;