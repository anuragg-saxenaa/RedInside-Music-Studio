import multer from 'multer';
import path from 'path';
import { UploadController } from '../../modules/upload/upload.controller.js';
import uploadService from '../../modules/upload/upload.service.js';
import storage from '../../utils/storage.util.js';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/flac',
      'audio/ogg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/m4a',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
    }
  },
});

export const UploadRoutes = [
  {
    method: 'post',
    path: '/api/upload/audio',
    handler: upload.single('audio'),
    controller: UploadController.uploadAudio,
  },
  {
    method: 'post',
    path: '/api/upload/url',
    handler: null, // JSON body, no file upload
    controller: UploadController.uploadFromUrl,
  },
  {
    method: 'get',
    path: '/api/upload/supported-formats',
    handler: null,
    controller: UploadController.getSupportedFormats,
  },
  {
    method: 'get',
    path: '/api/upload/:trackId/file',
    handler: null,
    controller: async (req, res, next) => {
      try {
        const { trackId } = req.params;
        const { projectId } = req.query;

        if (!trackId) {
          return res.status(400).json({ error: 'trackId is required' });
        }

        if (!projectId) {
          return res.status(400).json({ error: 'projectId is required' });
        }

        // Reconstruct file path: storage/projects/{projectId}/audio/{trackId}.{ext}
        const audioDir = uploadService.getAudioDir(projectId);
        const ext = path.basename(req.query.format || 'mp3');
        const fileName = `${trackId}.${ext}`;
        const filePath = path.join(audioDir, fileName);

        // Validate path doesn't escape audio directory
        storage.validateProjectId(projectId);

        const fileBuffer = storage.readFile(filePath);

        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${trackId}.${ext}"`,
          'Content-Length': fileBuffer.length,
        });

        res.send(fileBuffer);
      } catch (error) {
        next(error);
      }
    },
  },
];

// Register upload routes
export function registerUploadRoutes(app) {
  UploadRoutes.forEach(route => {
    if (route.method === 'post' && route.path === '/api/upload/audio') {
      // multipart/form-data with file
      app.post(route.path, upload.single('audio'), route.controller);
    } else if (route.method === 'post') {
      // JSON body
      app.post(route.path, route.controller);
    } else {
      app.get(route.path, route.controller);
    }
  });
}

export default registerUploadRoutes;