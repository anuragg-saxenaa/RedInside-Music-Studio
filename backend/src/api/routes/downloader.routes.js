import { DownloaderController } from '../../modules/downloader/downloader.controller.js';

export const DownloaderRoutes = [
  {
    method: 'post',
    path: '/api/downloader/youtube',
    handler: DownloaderController.youtube,
  },
  {
    method: 'get',
    path: '/api/downloader/status/:downloadId',
    handler: DownloaderController.status,
  },
  {
    method: 'get',
    path: '/api/youtube/suggest',
    handler: DownloaderController.suggest,
  },
  // Download job queue (desktop worker)
  { method: 'get', path: '/api/youtube/worker-status', handler: DownloaderController.workerStatus },
  { method: 'post', path: '/api/youtube/jobs', handler: DownloaderController.createJob },
  { method: 'get', path: '/api/youtube/jobs/next', handler: DownloaderController.nextJob },
  { method: 'post', path: '/api/youtube/jobs/:id/result', handler: DownloaderController.submitJobResult },
  { method: 'get', path: '/api/youtube/jobs/:id', handler: DownloaderController.jobStatus },
  {
    method: 'get',
    path: '/api/youtube/search',
    handler: DownloaderController.search,
  },
  {
    method: 'get',
    path: '/api/youtube/cookies/status',
    handler: DownloaderController.cookiesStatus,
  },
  {
    method: 'post',
    path: '/api/youtube/cookies',
    handler: DownloaderController.setCookies,
  },
];
