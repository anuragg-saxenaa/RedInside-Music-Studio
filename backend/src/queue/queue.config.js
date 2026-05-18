import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import config from '../config/env.config.js';
import logger from '../utils/logger.js';

// Redis connection config
const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // Required for BullMQ
};

// Connection singleton for reuse
let connection = null;

export function getRedisConnection() {
  if (!connection) {
    connection = new Redis(redisConfig);
    connection.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });
  }
  return connection;
}

// Queue instances
export const queues = {
  lyrics: new Queue('lyrics-generation', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 1000,    // Keep last 1000 failed jobs
    },
  }),

  music: new Queue('music-generation', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  }),

  ffmpeg: new Queue('ffmpeg-processing', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  }),

  video: new Queue('video-generation', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  }),

  vocalRemoval: new Queue('vocal-removal', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 50,
      removeOnFail: 200,
    },
  }),
};

// Queue events for logging
export const queueEvents = {
  lyrics: new QueueEvents('lyrics-generation', { connection: getRedisConnection() }),
  music: new QueueEvents('music-generation', { connection: getRedisConnection() }),
  ffmpeg: new QueueEvents('ffmpeg-processing', { connection: getRedisConnection() }),
  video: new QueueEvents('video-generation', { connection: getRedisConnection() }),
  vocalRemoval: new QueueEvents('vocal-removal', { connection: getRedisConnection() }),
};

// Setup event listeners
Object.entries(queueEvents).forEach(([name, events]) => {
  events.on('completed', ({ jobId }) => {
    logger.info(`Job ${jobId} completed`, { queue: name });
  });

  events.on('failed', ({ jobId, failedReason }) => {
    logger.error(`Job ${jobId} failed`, { queue: name, reason: failedReason });
  });
});

export default { queues, queueEvents, getRedisConnection };