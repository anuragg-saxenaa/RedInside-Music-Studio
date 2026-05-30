import { Worker } from 'bullmq';
import { queues, getRedisConnection } from '../queue.config.js';
import { JobModel } from '../jobs.service.js';
import ffmpegService from '../../modules/ffmpeg/ffmpeg.service.js';
import logger from '../../utils/logger.js';

function startWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn('Redis not available — ffmpeg worker not started');
    return null;
  }

  const worker = new Worker(
    'ffmpeg-processing',
    async (job) => {
      const { projectId, musicId, originalFilePath, jobId } = job.data;

      logger.info('Processing ffmpeg job', { jobId: job.id, musicId });

      try {
        await JobModel.updateStatus(jobId, 'active');
        await JobModel.update(jobId, { progress: 10 });

        const result = await ffmpegService.processMusic({ projectId, musicId, originalFilePath });

        await JobModel.update(jobId, {
          status: 'completed', progress: 100,
          result: { musicId: result.id, processedFilePath: result.processed_file_path, durationSeconds: result.duration_seconds, bitrate: result.bitrate },
        });

        return result;
      } catch (error) {
        logger.error('FFmpeg job failed', { jobId: job.id, error: error.message });
        await JobModel.updateStatus(jobId, 'failed', error.message);
        throw error;
      }
    },
    { connection, concurrency: 2 }
  );

  worker.on('completed', (job, result) => {
    logger.info('FFmpeg job completed', { jobId: job.id, musicId: result?.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('FFmpeg job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

export const ffmpegWorker = startWorker();

export async function addFfmpegJob(data) {
  const q = queues.ffmpeg;
  if (!q || !q.add) { logger.warn('Queue not available, job not added'); return null; }
  const { projectId, musicId, originalFilePath, jobId } = data;
  const job = await q.add('process-audio', { projectId, musicId, originalFilePath, jobId });
  logger.info('FFmpeg job added', { jobId: job?.id, musicId });
  return job;
}

export default ffmpegWorker;