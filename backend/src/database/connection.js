import Database from 'better-sqlite3';
import config from '../config/env.config.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

// Ensure database directory exists
const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.database.path);

// Enable foreign keys
db.pragma('foreign_keys = ON');

logger.info(`Database connected: ${config.database.path}`);

export default db;
