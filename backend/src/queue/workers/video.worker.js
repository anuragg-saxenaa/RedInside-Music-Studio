import { Worker } from 'bullmq';
import { queues, getRedisConnection } from '../queue.config.js';
import { JobModel } from '../jobs.service.js';
import { VideoService } from '../../modules/video/video.service.js';
import { HistoryService } from '../../modules/history/history.service.js';
import logger from '../../utils/logger.js';
import { broadcast } from '../../utils/ws.server.js';

const videoService = new VideoService();

function startWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn('Redis not available — video worker not started');
    return null;
  }

  const worker = new Worker(
    'video-generation',
    async (job) => {
      const { projectId, musicId, prompt, model, duration, resolution, jobId } = job.data;

      logger.info('Processing video job', { jobId: job.id, projectId });

      try {
        await JobModel.updateStatus(jobId, 'active');
        broadcast({ type: 'job.started', jobId, jobType: 'generate-video', projectId });

        const result = await videoService.generateVideo({ projectId, musicId, prompt, model, duration, resolution });

        logger.info('Video generation started, polling for completion', { jobId: job.id, taskId: result.taskId });

        const maxPollAttempts = 60;
        let pollCount = 0;

        while (pollCount < maxPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const statusResult = await videoService.pollStatus(result.taskId);

          if (statusResult.status === 'completed') {
            try {
              await (new HistoryService()).linkGeneration(projectId, { type: 'video', id: result.videoId });
            } catch (linkErr) {
              logger.warn('Failed to link video into generation chain', { error: linkErr.message });
            }

            await JobModel.update(jobId, {
              status: 'completed', progress: 100,
              result: { videoId: result.videoId, taskId: result.taskId, fileId: statusResult.fileId },
            });
            broadcast({ type: 'job.completed', jobId, jobType: 'generate-video', projectId, result: { videoId: result.videoId } });
            logger.info('Video job completed', { jobId: job.id, videoId: result.videoId });
            return { videoId: result.videoId, taskId: result.taskId, status: 'completed' };
          } else if (statusResult.status === 'failed') {
            throw new Error(statusResult.errorMessage || 'Video generation failed');
          }

          const progress = Math.min(95, Math.floor((pollCount / maxPollAttempts) * 100));
          await JobModel.update(jobId, { progress });
          broadcast({ type: 'job.progress', jobId, jobType: 'generate-video', projectId, progress });
          pollCount++;
        }

        throw new Error('Video generation timed out after maximum polling attempts');
      } catch (error) {
        logger.error('Video job failed', { jobId: job.id, error: error.message });
        await JobModel.updateStatus(jobId, 'failed', error.message);
        broadcast({ type: 'job.failed', jobId, jobType: 'generate-video', projectId, error: error.message });
        throw error;
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on('completed', (job, result) => {
    logger.info('Video job completed', { jobId: job.id, videoId: result?.videoId });
  });

  worker.on('failed', (job, err) => {
    logger.error('Video job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

export const videoWorker = startWorker();

export async function addVideoJob(data) {
  const q = queues.video;
  if (!q || !q.add) { logger.warn('Queue not available, job not added'); return null; }
  const { projectId, musicId, prompt, model, duration, resolution, jobId } = data;
  const job = await q.add('generate-video', { projectId, musicId, prompt, model, duration, resolution, jobId });
  logger.info('Video job added', { jobId: job?.id, projectId });
  return job;
}

export default videoWorker;