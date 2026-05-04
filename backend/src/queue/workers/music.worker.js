import { Worker } from 'bullmq';
import { queues, getRedisConnection } from '../queue.config.js';
import { JobModel } from '../jobs.service.js';
import { MusicService } from '../../modules/music/music.service.js';
import logger from '../../utils/logger.js';

const musicService = new MusicService();
const connection = getRedisConnection();

export const musicWorker = new Worker(
  'music-generation',
  async (job) => {
    const { projectId, lyricsId, prompt, model, isInstrumental, audioSettings, jobId } = job.data;

    logger.info('Processing music job', { jobId: job.id, projectId });

    try {
      // Update job status to active
      JobModel.updateStatus(jobId, 'active');

      // Generate music
      const result = await musicService.generateMusic({
        projectId,
        lyricsId,
        prompt,
        model,
        isInstrumental,
        audioSettings,
      });

      // Update job as completed
      JobModel.update(jobId, {
        status: 'completed',
        progress: 100,
        result: { musicId: result.id, version: result.version },
      });

      return result;
    } catch (error) {
      logger.error('Music job failed', { jobId: job.id, error: error.message });
      JobModel.updateStatus(jobId, 'failed', error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Music generation is resource-intensive
  }
);

musicWorker.on('completed', (job, result) => {
  logger.info('Music job completed', { jobId: job.id, musicId: result?.id });
});

musicWorker.on('failed', (job, err) => {
  logger.error('Music job failed', { jobId: job?.id, error: err.message });
});

// Helper function to add music job
export async function addMusicJob(data) {
  const { projectId, lyricsId, prompt, model, isInstrumental, audioSettings, jobId } = data;

  const job = await queues.music.add('generate-music', {
    projectId,
    lyricsId,
    prompt,
    model,
    isInstrumental,
    audioSettings,
    jobId,
  });

  logger.info('Music job added', { jobId: job.id, projectId });

  return job;
}

export default musicWorker;