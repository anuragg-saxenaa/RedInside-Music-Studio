import { Worker } from 'bullmq';
import { queues, getRedisConnection } from '../queue.config.js';
import { JobModel } from '../jobs.service.js';
import { MusicService } from '../../modules/music/music.service.js';
import { HistoryService } from '../../modules/history/history.service.js';
import uploadService from '../../modules/upload/upload.service.js';
import logger from '../../utils/logger.js';
import { broadcast } from '../../utils/ws.server.js';

const historyService = new MusicService();
const musicService = new MusicService();

function startWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn('Redis not available — music worker not started');
    return null;
  }

  const worker = new Worker(
    'music-generation',
    async (job) => {
      const { projectId, lyricsId, audioUrl, prompt, model, isInstrumental, audioSettings, voice, language, jobId } = job.data;

      logger.info('Processing music job', { jobId: job.id, projectId });

      try {
        await JobModel.updateStatus(jobId, 'active');
        broadcast({ type: 'job.started', jobId, jobType: 'generate-music', projectId });

        let filePath = null;
        if (audioUrl && model === 'music-cover') {
          const match = audioUrl.match(/\/api\/upload\/([^/]+)\/file/);
          if (match) {
            filePath = uploadService.getAudioFilePath(projectId, match[1], 'mp3');
          }
        }

        const result = await musicService.generateMusic({
          projectId, lyricsId, audioUrl, filePath, prompt, model, isInstrumental, audioSettings, voice, language,
        });

        try {
          await historyService.linkGeneration(projectId, { type: 'music', id: result.id });
        } catch (linkErr) {
          logger.warn('Failed to link music into generation chain', { error: linkErr.message });
        }

        await JobModel.update(jobId, {
          status: 'completed', progress: 100,
          result: { musicId: result.id, version: result.version },
        });
        broadcast({ type: 'job.completed', jobId, jobType: 'generate-music', projectId, result: { musicId: result.id, version: result.version } });

        return result;
      } catch (error) {
        logger.error('Music job failed', { jobId: job.id, error: error.message });
        await JobModel.updateStatus(jobId, 'failed', error.message);
        broadcast({ type: 'job.failed', jobId, jobType: 'generate-music', projectId, error: error.message });
        throw error;
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on('completed', (job, result) => {
    logger.info('Music job completed', { jobId: job.id, musicId: result?.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Music job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

export const musicWorker = startWorker();

export async function addMusicJob(data) {
  const q = queues.music;
  if (!q || !q.add) { logger.warn('Queue not available, job not added'); return null; }
  const { projectId, lyricsId, audioUrl, prompt, model, isInstrumental, audioSettings, voice, language, jobId } = data;
  const job = await q.add('generate-music', { projectId, lyricsId, audioUrl, prompt, model, isInstrumental, audioSettings, voice, language, jobId });
  logger.info('Music job added', { jobId: job?.id, projectId });
  return job;
}

export default musicWorker;