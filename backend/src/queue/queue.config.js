import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import config from '../config/env.config.js';
import logger from '../utils/logger.js';

// Redis connection config — Upstash TLS URL when set, else null (disabled)
const redisUrl = config.redis.url;

// Lazy connection singleton
let _connection = null;

export function getRedisConnection() {
  if (!_connection) {
    if (!redisUrl) {
      return null; // Redis not configured — queues will be stubs
    }
    _connection = new Redis({
      url: redisUrl,
      tls: {},
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
    });
    _connection.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });
  }
  return _connection;
}

// Queue instances — created lazily on first access
let _queues = null;

function createQueues() {
  const conn = getRedisConnection();
  if (!conn) {
    // Return stub queues that do nothing when Redis unavailable
    return {
      lyrics: { add: () => logger.warn('Queue: Redis not available'), },
      music: { add: () => logger.warn('Queue: Redis not available'), },
      ffmpeg: { add: () => logger.warn('Queue: Redis not available'), },
      video: { add: () => logger.warn('Queue: Redis not available'), },
      vocalRemoval: { add: () => logger.warn('Queue: Redis not available'), },
    };
  }

  return {
    lyrics: new Queue('lyrics-generation', {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    music: new Queue('music-generation', {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    ffmpeg: new Queue('ffmpeg-processing', {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    video: new Queue('video-generation', {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
    vocalRemoval: new Queue('vocal-removal', {
      connection: conn,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    }),
  };
}

export const queues = new Proxy({}, {
  get(target, prop) {
    if (!_queues) _queues = createQueues();
    return _queues[prop];
  },
});

// Queue events — also lazy
let _events = null;

function createEvents() {
  const conn = getRedisConnection();
  if (!conn) return {};
  return {
    lyrics: new QueueEvents('lyrics-generation', { connection: conn }),
    music: new QueueEvents('music-generation', { connection: conn }),
    ffmpeg: new QueueEvents('ffmpeg-processing', { connection: conn }),
    video: new QueueEvents('video-generation', { connection: conn }),
    vocalRemoval: new QueueEvents('vocal-removal', { connection: conn }),
  };
}

export const queueEvents = new Proxy({}, {
  get(target, prop) {
    if (!_events) _events = createEvents();
    return _events[prop];
  },
});

// Setup event listeners lazily
let _listenersSetup = false;

function setupListeners() {
  if (_listenersSetup || !_events) return;
  _listenersSetup = true;
  Object.entries(queueEvents).forEach(([name, events]) => {
    if (!events) return;
    events.on('completed', ({ jobId }) => {
      logger.info(`Job ${jobId} completed`, { queue: name });
    });
    events.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job ${jobId} failed`, { queue: name, reason: failedReason });
    });
  });
}

// Call setup when queueEvents is first accessed
const originalGet = queueEvents.get;
queueEvents.get = function(target, prop) {
  const val = originalGet(target, prop);
  setupListeners();
  return val;
};

export default { queues, queueEvents, getRedisConnection };