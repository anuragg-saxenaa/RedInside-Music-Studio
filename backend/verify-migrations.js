import db from './src/database/connection.js';
import runMigrations from './src/database/migrate.js';

console.log('Running migrations...');
try {
  runMigrations();
  console.log('Migrations completed successfully.\n');
} catch (error) {
  console.error('Migration error:', error.message);
  process.exit(1);
}

console.log('Verifying tables exist:');
const tables = [
  'playlists',
  'playlist_tracks',
  'music_tags',
  'music_notes',
  'social_exports',
  'project_shares'
];

let allOk = true;
tables.forEach(tableName => {
  try {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    const status = result ? 'OK' : 'MISSING';
    console.log(`  ${tableName}: ${status}`);
    if (!result) allOk = false;
  } catch (error) {
    console.log(`  ${tableName}: ERROR - ${error.message}`);
    allOk = false;
  }
});

console.log();
if (allOk) {
  console.log('All 6 tables verified successfully!');
  process.exit(0);
} else {
  console.log('Some tables are missing or failed verification.');
  process.exit(1);
}
