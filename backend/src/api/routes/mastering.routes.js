import { MasteringController } from '../../modules/mastering/mastering.controller.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'];
    const ext = file.originalname.toLowerCase();
    if (allowed.some(e => ext.endsWith(e))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export const MasteringRoutes = [
  { method: 'post', path: '/api/mastering/upload/:projectId', handler: MasteringController.upload, middlewares: [upload.array('files', 50)] },
  { method: 'post', path: '/api/mastering/process', handler: MasteringController.process },
  { method: 'post', path: '/api/mastering/save-to-music', handler: MasteringController.saveToMusic },
  { method: 'get', path: '/api/mastering/:fileId/download/:projectId', handler: MasteringController.download },
  { method: 'get', path: '/api/mastering/:fileId/file/:projectId', handler: MasteringController.serveOriginal },
  { method: 'get', path: '/api/mastering/files/:projectId', handler: MasteringController.listFiles },
];