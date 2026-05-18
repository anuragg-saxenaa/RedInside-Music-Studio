import { Worker } from 'bullmq';
import path from 'path';
import os from 'os';
import { getRedisConnection } from '../queue.config.js';
import { VocalRemovalService } from '../../modules/audio/vocal-removal.service.js';
import { MusicModel } from '../../database/models/music.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import { broadcast } from '../../utils/ws.server.js';
import logger from '../../utils/logger.js';

new Worker('vocal-removal', async (job) => {
  const { musicId, projectId, inputPath, originalTitle } = job.data;

  const outputDir = path.join(os.tmpdir(), `vocal-removal-${job.id}`);

  const result = await VocalRemovalService.removeVocals(inputPath, outputDir, {
    onProgress: (progress, message) => {
      job.updateProgress(progress);
      broadcast({ event: 'job.progress', jobId: job.id, progress, message });
    },
  });

  const version = MusicModel.getNextVersion(projectId);
  const title = `${originalTitle} (Instrumental)`;
  const instrumental = MusicModel.create({
    projectId,
    title,
    model: 'vocal-removal',
    originalFilePath: result.instrumentalPath,
    processedFilePath: null,
    status: 'completed',
    isInstrumental: true,
    version,
  });

  ProjectModel.incrementVersion(projectId, 'music');

  broadcast({
    event: 'job.completed',
    jobId: job.id,
    result: {
      instrumentalMusicId: instrumental.id,
      vocalPath: result.vocalPath,
      engine: result.engine,
    },
  });

  logger.info('Vocal removal job completed', { jobId: job.id, engine: result.engine });
  return { instrumentalMusicId: instrumental.id, engine: result.engine };
}, {
  connection: getRedisConnection(),
  concurrency: 1,
});
