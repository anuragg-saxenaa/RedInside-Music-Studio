// One-time migration: copy all data from local SQLite → Turso
import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLITE_PATH = '/Users/admin/Anurag/Development/Codebase/ai/RedInside-Music-Studio/database/music-studio.sqlite';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  process.exit(1);
}

const local = new Database(SQLITE_PATH, { readonly: true });
const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// Tables to migrate in dependency order
const TABLES = [
  'projects',
  'lyrics_generations',
  'music_generations',
  'image_generations',
  'video_generations',
  'medleys',
  'medley_tracks',
  'audio_tracks',
  'generation_chains',
  'jobs',
  'voice_clones',
  'playlists',
  'playlist_tracks',
  'music_tags',
  'music_notes',
  'social_exports',
  'project_shares',
  'albums',
  'album_tracks',
  'settings',
  'user_settings',
];

let totalInserted = 0;

for (const table of TABLES) {
  let rows;
  try {
    rows = local.prepare(`SELECT * FROM ${table}`).all();
  } catch {
    console.log(`  skip ${table} (not in local SQLite)`);
    continue;
  }

  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows — skip`);
    continue;
  }

  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;

  let inserted = 0;
  for (const row of rows) {
    const values = cols.map(c => row[c]);
    try {
      await turso.execute({ sql, args: values });
      inserted++;
    } catch (err) {
      console.warn(`  ${table} row skip: ${err.message.slice(0, 80)}`);
    }
  }

  console.log(`  ✓ ${table}: ${inserted}/${rows.length} rows`);
  totalInserted += inserted;
}

local.close();
console.log(`\nDone. ${totalInserted} total rows migrated to Turso.`);
