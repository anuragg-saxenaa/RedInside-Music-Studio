import { Worker } from 'bullmq';
import path from 'path';
import os from 'os';
import { getRedisConnection } from '../queue.config.js';
import { VocalRemovalService } from '../../modules/audio/vocal-removal.service.js';
import { MusicModel } from '../../database/models/music.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import { JobModel } from '../jobs.service.js';
import { broadcast } from '../../utils/ws.server.js';
import logger from '../../utils/logger.js';

new Worker('vocal-removal', async (job) => {
  const { musicId, projectId, inputPath, originalTitle, jobId } = job.data;

  if (jobId) JobModel.updateStatus(jobId, 'active');

  const outputDir = path.join(os.tmpdir(), `vocal-removal-${job.id}`);

  try {
    const result = await VocalRemovalService.removeVocals(inputPath, outputDir, {
      onProgress: (progress, message) => {
        job.updateProgress(progress);
        if (jobId) JobModel.update(jobId, { progress });
        broadcast({ event: 'job.progress', jobId: jobId || job.id, progress, message });
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

    const jobResult = { instrumentalMusicId: instrumental.id, engine: result.engine };

    if (jobId) {
      JobModel.update(jobId, {
        status: 'completed',
        result: jobResult,
        progress: 100,
      });
    }

    broadcast({
      event: 'job.completed',
      jobId: jobId || job.id,
      result: { ...jobResult, vocalPath: result.vocalPath },
    });

    logger.info('Vocal removal job completed', { jobId: jobId || job.id, engine: result.engine });
    return jobResult;
  } catch (err) {
    if (jobId) JobModel.updateStatus(jobId, 'failed', err.message);
    broadcast({ event: 'job.failed', jobId: jobId || job.id, error: err.message });
    throw err;
  }
}, {
  connection: getRedisConnection(),
  concurrency: 1,
});
