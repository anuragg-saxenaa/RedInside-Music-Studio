import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Preserve shell environment variables BEFORE dotenv overwrites them
const SHELL_MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL;

// Load .env from config directory with error handling
const result = dotenv.config({ path: path.resolve(__dirname, '../../../config/.env') });

// Restore shell MINIMAX_BASE_URL if it was set (allows dev:mock to override .env)
if (SHELL_MINIMAX_BASE_URL) {
  process.env.MINIMAX_BASE_URL = SHELL_MINIMAX_BASE_URL;
}
// In CI or test environments, missing .env is fine — use env vars directly
if (result.error && process.env.NODE_ENV !== 'test' && !process.env.CI) {
  throw new Error(`Failed to load .env file: ${result.error.message}`);
}

function parsePort(value, defaultValue) {
  const parsed = parseInt(value || defaultValue, 10);
  if (isNaN(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return parsed;
}

const config = {
  minimax: {
    // Allow empty — MinimaxClient reads from settings DB at request time if this is empty
    apiKey: process.env.MINIMAX_API_KEY || '',
    baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io',
  },
  server: {
    port: parsePort(process.env.PORT, '3000'),
    env: process.env.NODE_ENV || 'development',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parsePort(process.env.REDIS_PORT, '6379'),
  },
  database: {
    // Local dev: file:///absolute/path/to/music-studio.sqlite
    // Cloud: libsql://your-db.turso.io (with authToken)
    url: process.env.TURSO_DATABASE_URL ||
      `file:${path.join(__dirname, '../../../database', path.basename(process.env.DATABASE_PATH || 'music-studio.sqlite'))}`,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || '',
    endpoint: process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : '',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',  // 'local' or 'r2'
    path: process.env.STORAGE_PATH || '/Users/admin/Music/RedInside-Storage',
  },
  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
    secretKey: process.env.CLERK_SECRET_KEY || '',
  },
};

export default config;
