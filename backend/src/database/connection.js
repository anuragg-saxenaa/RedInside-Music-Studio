import { createClient } from '@libsql/client';
import config from '../config/env.config.js';
import logger from '../utils/logger.js';

const db = createClient({
  url: config.database.url,
  authToken: config.database.authToken,
});

// Enable foreign keys
await db.execute('PRAGMA foreign_keys = ON');

logger.info(`Database connected: ${config.database.url}`);

export default db;
