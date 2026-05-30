import { Worker } from 'bullmq';
import { queues, getRedisConnection } from '../queue.config.js';
import { JobModel } from '../jobs.service.js';
import { MusicService } from '../../modules/music/music.service.js';
import { HistoryService } from '../../modules/history/history.service.js';
import uploadService from '../../modules/upload/upload.service.js';
import logger from '../../utils/logger.js';
import { broadcast } from '../../utils/ws.server.js';

const historyService = new HistoryService();

const musicService = new MusicService();
const connection = getRedisConnection();

export const musicWorker = new Worker(
  'music-generation',
  async (job) => {
    const { projectId, lyricsId, audioUrl, prompt, model, isInstrumental, audioSettings, voice, language, jobId } = job.data;

    logger.info('Processing music job', { jobId: job.id, projectId });

    try {
      // Update job status to active
      await JobModel.updateStatus(jobId, 'active');
      broadcast({ type: 'job.started', jobId, jobType: 'generate-music', projectId });

      // For cover mode, resolve audioUrl to filePath
      let filePath = null;
      if (audioUrl && model === 'music-cover') {
        // audioUrl format: /api/upload/{trackId}/file
        const match = audioUrl.match(/\/api\/upload\/([^/]+)\/file/);
        if (match) {
          const trackId = match[1];
          filePath = uploadService.getAudioFilePath(projectId, trackId, 'mp3');
          logger.info('Resolved audioUrl to filePath', { audioUrl, filePath });
        }
      }

      // Generate music
      const result = await musicService.generateMusic({
        projectId,
        lyricsId,
        audioUrl,
        filePath,
        prompt,
        model,
        isInstrumental,
        audioSettings,
        voice,
        language,
      });

      // Link into generation chain (lyrics → music)
      try {
        await historyService.linkGeneration(projectId, { type: 'music', id: result.id });
      } catch (linkErr) {
        logger.warn('Failed to link music into generation chain', { error: linkErr.message });
      }

      // Update job as completed
      await JobModel.update(jobId, {
        status: 'completed',
        progress: 100,
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
  const { projectId, lyricsId, audioUrl, prompt, model, isInstrumental, audioSettings, voice, language, jobId } = data;

  const job = await queues.music.add('generate-music', {
    projectId,
    lyricsId,
    audioUrl,
    prompt,
    model,
    isInstrumental,
    audioSettings,
    voice,
    language,
    jobId,
  });

  logger.info('Music job added', { jobId: job.id, projectId });

  return job;
}

export default musicWorker;