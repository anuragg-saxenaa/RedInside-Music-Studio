import { MusicController } from '../../modules/music/music.controller.js';
import { MusicService } from '../../modules/music/music.service.js';
import { AudioProcessor } from '../../modules/audio/audio.processor.js';
import { MusicModel } from '../../database/models/music.model.js';
import fs from 'fs';
import path from 'path';

const musicService = new MusicService();

export const MusicRoutes = [
  {
    method: 'post',
    path: '/api/music/generate',
    handler: MusicController.generate,
  },
  {
    method: 'get',
    path: '/api/music/:id',
    handler: MusicController.getById,
  },
  {
    method: 'get',
    path: '/api/music/:id/file',
    handler: MusicController.getFile,
  },
  {
    method: 'get',
    path: '/api/projects/:projectId/music',
    handler: MusicController.getByProject,
  },
  {
    method: 'patch',
    path: '/api/music/:id',
    handler: MusicController.update,
  },
  {
    method: 'delete',
    path: '/api/music/:id',
    handler: MusicController.delete,
  },
  {
    method: 'post',
    path: '/api/music/:id/convert',
    handler: async (req, res, next) => {
      try {
        const { id } = req.params;
        const music = await musicService.getMusic(id);
        if (!music) return res.status(404).json({ error: 'Music not found' });

        const inputPath = music.original_file_path;
        if (!inputPath || !fs.existsSync(inputPath)) {
          return res.status(404).json({ error: 'Audio file not found on disk' });
        }

        const outputPath = inputPath.replace(/\.[^.]+$/, '_320kbps.mp3');
        const processor = new AudioProcessor(inputPath);
        await processor.export(outputPath, { format: 'mp3', bitrate: 320 });

        MusicModel.update(id, { processedFilePath: outputPath });

        res.json({ message: 'Converted successfully', musicId: id });
      } catch (error) {
        next(error);
      }
    },
  },
];