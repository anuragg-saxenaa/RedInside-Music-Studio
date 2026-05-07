import { Worker } from 'bullmq';
import { queues, getRedisConnection } from '../queue.config.js';
import { JobModel } from '../jobs.service.js';
import { VideoService } from '../../modules/video/video.service.js';
import logger from '../../utils/logger.js';

const videoService = new VideoService();
const connection = getRedisConnection();

export const videoWorker = new Worker(
  'video-generation',
  async (job) => {
    const { projectId, musicId, prompt, model, duration, resolution, jobId } = job.data;

    logger.info('Processing video job', { jobId: job.id, projectId });

    try {
      // Update job status to active
      JobModel.updateStatus(jobId, 'active');

      // Start video generation (initiates async task on MiniMax)
      const result = await videoService.generateVideo({
        projectId,
        musicId,
        prompt,
        model,
        duration,
        resolution,
      });

      logger.info('Video generation started, polling for completion', { jobId: job.id, taskId: result.taskId });

      // Poll for completion with retry logic
      const maxPollAttempts = 60; // ~5 minutes max (5s interval)
      let pollCount = 0;

      while (pollCount < maxPollAttempts) {
        // Wait 5 seconds between polls
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResult = await videoService.pollStatus(result.taskId);

        if (statusResult.status === 'completed') {
          // Update job as completed
          JobModel.update(jobId, {
            status: 'completed',
            progress: 100,
            result: { videoId: result.videoId, taskId: result.taskId, fileId: statusResult.fileId },
          });
          logger.info('Video job completed', { jobId: job.id, videoId: result.videoId });
          return { videoId: result.videoId, taskId: result.taskId, status: 'completed' };
        } else if (statusResult.status === 'failed') {
          throw new Error(statusResult.errorMessage || 'Video generation failed');
        }

        // Update progress
        const progress = Math.min(95, Math.floor((pollCount / maxPollAttempts) * 100));
        JobModel.update(jobId, { progress });

        pollCount++;
        logger.info('Video still processing', { jobId: job.id, pollCount, progress });
      }

      // Timeout - still processing after max attempts
      throw new Error('Video generation timed out after maximum polling attempts');
    } catch (error) {
      logger.error('Video job failed', { jobId: job.id, error: error.message });
      JobModel.updateStatus(jobId, 'failed', error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Video generation is resource-intensive
  }
);

videoWorker.on('completed', (job, result) => {
  logger.info('Video job completed', { jobId: job.id, videoId: result?.videoId });
});

videoWorker.on('failed', (job, err) => {
  logger.error('Video job failed', { jobId: job?.id, error: err.message });
});

// Helper function to add video job
export async function addVideoJob(data) {
  const { projectId, musicId, prompt, model, duration, resolution, jobId } = data;

  const job = await queues.video.add('generate-video', {
    projectId,
    musicId,
    prompt,
    model,
    duration,
    resolution,
    jobId,
  });

  logger.info('Video job added', { jobId: job.id, projectId });

  return job;
}

export default videoWorker;