import express from 'express';
import cors from 'cors';
import config from './config/env.config.js';
import logger from './utils/logger.js';
import errorMiddleware from './api/middleware/error.middleware.js';
import { LyricsRoutes } from './api/routes/lyrics.routes.js';
import { MusicRoutes } from './api/routes/music.routes.js';
import { JobsRoutes } from './api/routes/jobs.routes.js';
import { ProjectsController } from './api/routes/projects.routes.js';
import { LyricsController } from './modules/lyrics/lyrics.controller.js';

// Import workers to initialize them
import './queue/workers/lyrics.worker.js';
import './queue/workers/music.worker.js';
import './queue/workers/ffmpeg.worker.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Project routes
const projectRoutes = [
  { method: 'post', path: '/api/projects', handler: ProjectsController.create },
  { method: 'get', path: '/api/projects', handler: ProjectsController.getAll },
  { method: 'get', path: '/api/projects/:id', handler: ProjectsController.getById },
  { method: 'put', path: '/api/projects/:id', handler: ProjectsController.update },
  { method: 'delete', path: '/api/projects/:id', handler: ProjectsController.delete },
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

// Error handling middleware
app.use(errorMiddleware);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = config.server.port;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    env: config.server.env,
    nodeVersion: process.version,
  });
});

export default app;