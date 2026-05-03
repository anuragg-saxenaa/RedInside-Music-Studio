import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from config directory
dotenv.config({ path: path.resolve(__dirname, '../../../config/.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required in environment configuration`);
  }
  return value;
}

const config = {
  minimax: {
    apiKey: requireEnv('MINIMAX_API_KEY'),
    baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  database: {
    path: path.resolve(__dirname, process.env.DATABASE_PATH || '../../../database/music-studio.sqlite'),
  },
  storage: {
    path: path.resolve(__dirname, process.env.STORAGE_PATH || '../../../storage'),
  },
};

export default config;
