import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_DATABASE_URL ||
  `file:${path.join(__dirname, '../../database/music-studio.sqlite')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

// For local file: URLs, ensure the parent directory exists (db dir is gitignored)
if (url.startsWith('file:')) {
  const filePath = url.slice('file:'.length).replace(/^\/\//, '/');
  try { fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true }); } catch { /* ignore */ }
}

const db = createClient({ url, authToken });

// Ensure migrations tracking table exists
await db.execute(`
  CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Get applied migrations
const appliedResult = await db.execute('SELECT filename FROM _migrations');
const applied = new Set(appliedResult.rows.map(r => r.filename));

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`Skipping migration (already applied): ${file}`);
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  // Run the whole migration script via executeMultiple — handles multiple
  // statements + BEGIN/COMMIT natively and atomically (manual ';' splitting +
  // stripping transactions corrupted later writes for table-recreate migrations).
  try {
    await db.executeMultiple(sql);
  } catch (err) {
    if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
      throw err;
    }
    if (process.env.MIGRATE_DEBUG) console.log(`  [ignored ${file}] ${err.message}`);
  }

  await db.execute({ sql: 'INSERT INTO _migrations (filename) VALUES (?)', args: [file] });
  console.log(`✓ ${file}`);
  ran++;
}

console.log(`Migration complete. ${ran} new, ${applied.size} already applied.`);
// Do NOT process.exit() here — it races pending libsql writes and can drop the
// last migrations mid-write (leaving a dangling journal). Let the event loop drain.
