import { Worker } from 'bullmq';
import { queues, getRedisConnection } from '../queue.config.js';
import { JobModel } from '../jobs.service.js';
import ffmpegService from '../../modules/ffmpeg/ffmpeg.service.js';
import logger from '../../utils/logger.js';

const connection = getRedisConnection();

export const ffmpegWorker = new Worker(
  'ffmpeg-processing',
  async (job) => {
    const { projectId, musicId, originalFilePath, jobId } = job.data;

    logger.info('Processing ffmpeg job', { jobId: job.id, musicId });

    try {
      // Update job status to active
      await JobModel.updateStatus(jobId, 'active');

      // Update progress
      await JobModel.update(jobId, { progress: 10 });

      // Process music file with FFmpeg
      const result = await ffmpegService.processMusic({
        projectId,
        musicId,
        originalFilePath,
      });

      // Update job as completed
      await JobModel.update(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          musicId: result.id,
          processedFilePath: result.processed_file_path,
          durationSeconds: result.duration_seconds,
          bitrate: result.bitrate,
        },
      });

      return result;
    } catch (error) {
      logger.error('FFmpeg job failed', { jobId: job.id, error: error.message });
      await JobModel.updateStatus(jobId, 'failed', error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // FFmpeg processing can be parallelized
  }
);

ffmpegWorker.on('completed', (job, result) => {
  logger.info('FFmpeg job completed', { jobId: job.id, musicId: result?.id });
});

ffmpegWorker.on('failed', (job, err) => {
  logger.error('FFmpeg job failed', { jobId: job?.id, error: err.message });
});

// Helper function to add ffmpeg job
export async function addFfmpegJob(data) {
  const { projectId, musicId, originalFilePath, jobId } = data;

  const job = await queues.ffmpeg.add('process-audio', {
    projectId,
    musicId,
    originalFilePath,
    jobId,
  });

  logger.info('FFmpeg job added', { jobId: job.id, musicId });

  return job;
}

export default ffmpegWorker;