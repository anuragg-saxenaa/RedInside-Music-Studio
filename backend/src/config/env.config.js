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
    path: path.join(__dirname, '../../../database', path.basename(process.env.DATABASE_PATH || 'music-studio.sqlite')),
  },
  storage: {
    path: process.env.STORAGE_PATH || '/Users/admin/Music/RedInside-Storage',
  },
};

export default config;
