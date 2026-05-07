import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from config directory with error handling
const result = dotenv.config({ path: path.resolve(__dirname, '../../../config/.env') });
if (result.error && process.env.NODE_ENV !== 'test') {
  throw new Error(`Failed to load .env file: ${result.error.message}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required in environment configuration`);
  }
  return value;
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
    apiKey: requireEnv('MINIMAX_API_KEY'),
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
