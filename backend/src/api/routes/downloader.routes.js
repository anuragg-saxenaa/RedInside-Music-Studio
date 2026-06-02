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
