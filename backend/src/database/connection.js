import { createClient } from '@libsql/client';
import config from '../config/env.config.js';
import logger from '../utils/logger.js';

const db = createClient({
  url: config.database.url,
  authToken: config.database.authToken,
});

// Enable foreign keys
await db.execute('PRAGMA foreign_keys = ON');
// Wait up to 5s on a locked DB instead of throwing SQLITE_BUSY (local file mode)
if (config.database.url.startsWith('file:')) {
  try {
    await db.execute('PRAGMA busy_timeout = 5000');
    await db.execute('PRAGMA journal_mode = WAL');
  } catch { /* ignore — WAL/busy_timeout best-effort */ }
}

logger.info(`Database connected: ${config.database.url}`);

export default db;
