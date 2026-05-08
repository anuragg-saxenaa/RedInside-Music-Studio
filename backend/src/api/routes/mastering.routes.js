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
  { method: 'post', path: '/api/mastering/upload/:projectId', handler: MasteringController.upload, middlewares: [upload.single('file')] },
  { method: 'post', path: '/api/mastering/process', handler: MasteringController.process },
  { method: 'get', path: '/api/mastering/:fileId/download/:projectId', handler: MasteringController.download },
];