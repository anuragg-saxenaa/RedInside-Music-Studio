import { HistoryController } from '../../modules/history/history.controller.js';

export const HistoryRoutes = [
  {
    method: 'get',
    path: '/api/history/chain/:id',
    handler: HistoryController.getVersionChain,
  },
  {
    method: 'get',
    path: '/api/history/:projectId',
    handler: HistoryController.getProjectHistory,
  },
  {
    method: 'post',
    path: '/api/history/replay/:id',
    handler: HistoryController.replayVersion,
  },
  {
    method: 'post',
    path: '/api/history/compare',
    handler: HistoryController.compareVersions,
  },
  {
    method: 'delete',
    path: '/api/history/:id',
    handler: HistoryController.deleteVersion,
  },
];