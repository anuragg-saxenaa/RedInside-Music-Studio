import { DownloaderController } from '../../modules/downloader/downloader.controller.js';

export const DownloaderRoutes = [
  {
    method: 'post',
    path: '/api/downloader/youtube',
    handler: DownloaderController.youtube,
  },
];
