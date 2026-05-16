import { Worker } from 'bullmq';
import { queues, getRedisConnection } from '../queue.config.js';
import { JobModel } from '../jobs.service.js';
import { LyricsService } from '../../modules/lyrics/lyrics.service.js';
import logger from '../../utils/logger.js';
import { broadcast } from '../../utils/ws.server.js';

const lyricsService = new LyricsService();
const connection = getRedisConnection();

export const lyricsWorker = new Worker(
  'lyrics-generation',
  async (job) => {
    const { projectId, prompt, stylePreset, mode } = job.data;

    logger.info('Processing lyrics job', { jobId: job.id, projectId });

    try {
      // Update job status to active
      JobModel.updateStatus(job.data.jobId, 'active');
      broadcast({ type: 'job.started', jobId: job.data.jobId, jobType: 'generate-lyrics', projectId });

      // Generate lyrics
      const result = await lyricsService.generateLyrics({
        projectId,
        prompt,
        stylePreset,
        mode,
      });

      // Update job as completed
      JobModel.update(job.data.jobId, {
        status: 'completed',
        progress: 100,
        result: { lyricsId: result.id, version: result.version },
      });
      broadcast({ type: 'job.completed', jobId: job.data.jobId, jobType: 'generate-lyrics', projectId, result: { lyricsId: result.id, version: result.version } });

      return result;
    } catch (error) {
      logger.error('Lyrics job failed', { jobId: job.id, error: error.message });
      JobModel.updateStatus(job.data.jobId, 'failed', error.message);
      broadcast({ type: 'job.failed', jobId: job.data.jobId, jobType: 'generate-lyrics', projectId, error: error.message });
      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Process 2 lyrics jobs at a time
  }
);

lyricsWorker.on('completed', (job, result) => {
  logger.info('Lyrics job completed', { jobId: job.id, lyricsId: result?.id });
});

lyricsWorker.on('failed', (job, err) => {
  logger.error('Lyrics job failed', { jobId: job?.id, error: err.message });
});

// Helper function to add lyrics job
export async function addLyricsJob(data) {
  const { projectId, prompt, stylePreset, mode, jobId } = data;

  const job = await queues.lyrics.add('generate-lyrics', {
    projectId,
    prompt,
    stylePreset,
    mode,
    jobId,
  });

  logger.info('Lyrics job added', { jobId: job.id, projectId });

  return job;
}

export default lyricsWorker;