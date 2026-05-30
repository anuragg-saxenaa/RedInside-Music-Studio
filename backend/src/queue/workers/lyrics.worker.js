import { Worker } from 'bullmq';
import { queues, getRedisConnection } from '../queue.config.js';
import { JobModel } from '../jobs.service.js';
import { LyricsService } from '../../modules/lyrics/lyrics.service.js';
import logger from '../../utils/logger.js';
import { broadcast } from '../../utils/ws.server.js';

const lyricsService = new LyricsService();

function startWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn('Redis not available — lyrics worker not started');
    return null;
  }

  const worker = new Worker(
    'lyrics-generation',
    async (job) => {
      const { projectId, prompt, stylePreset, mode } = job.data;

      logger.info('Processing lyrics job', { jobId: job.id, projectId });

      try {
        await JobModel.updateStatus(job.data.jobId, 'active');
        broadcast({ type: 'job.started', jobId: job.data.jobId, jobType: 'generate-lyrics', projectId });

        const result = await lyricsService.generateLyrics({
          projectId, prompt, stylePreset, mode,
        });

        await JobModel.update(job.data.jobId, {
          status: 'completed',
          progress: 100,
          result: { lyricsId: result.id, version: result.version },
        });
        broadcast({ type: 'job.completed', jobId: job.data.jobId, jobType: 'generate-lyrics', projectId, result: { lyricsId: result.id, version: result.version } });

        return result;
      } catch (error) {
        logger.error('Lyrics job failed', { jobId: job.id, error: error.message });
        await JobModel.updateStatus(job.data.jobId, 'failed', error.message);
        broadcast({ type: 'job.failed', jobId: job.data.jobId, jobType: 'generate-lyrics', projectId, error: error.message });
        throw error;
      }
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('completed', (job, result) => {
    logger.info('Lyrics job completed', { jobId: job.id, lyricsId: result?.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Lyrics job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

// Start lazily
export const lyricsWorker = startWorker();

// Helper function to add lyrics job
export async function addLyricsJob(data) {
  const { projectId, prompt, stylePreset, mode, jobId } = data;
  const q = queues.lyrics;
  if (!q || !q.add) {
    logger.warn('Queue not available, job not added');
    return null;
  }
  const job = await q.add('generate-lyrics', { projectId, prompt, stylePreset, mode, jobId });
  logger.info('Lyrics job added', { jobId: job?.id, projectId });
  return job;
}

export default lyricsWorker;