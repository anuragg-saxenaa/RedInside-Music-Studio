#!/usr/bin/env node
/**
 * Zero-loss R2 migration — 5 phases:
 * 1. COPY   — upload local files to R2 (no deletes, no DB changes)
 * 2. VERIFY — MD5 checksum local vs R2 ETag
 * 3. UPDATE — atomic DB transaction to swap paths
 * 4. FINAL  — fetch each R2 path, verify 200
 * 5. ARCHIVE — rename local storage dir (never delete)
 *
 * Run: node backend/scripts/migrate-to-r2.js
 * Env needed: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *             STORAGE_PATH (optional, defaults to config default)
 *             DATABASE_PATH (optional, defaults to database/music-studio.sqlite)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@libsql/client';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BUCKET = process.env.R2_BUCKET_NAME;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;

if (!BUCKET || !ACCOUNT_ID) {
  console.error('Missing required env vars: R2_BUCKET_NAME, R2_ACCOUNT_ID');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const LOCAL_STORAGE = process.env.STORAGE_PATH || '/Users/admin/Music/RedInside-Storage';
const DB_PATH = process.env.DATABASE_PATH ||
  path.join(__dirname, '../../database/music-studio.sqlite');

const db = createClient({ url: `file:${DB_PATH}` });

// Map absolute local path → R2 key (relative, no base path)
function localToR2Key(localPath) {
  const rel = path.relative(LOCAL_STORAGE, localPath);
  return rel.replace(/\\/g, '/');
}

async function phase1Copy(files) {
  console.log('\n=== PHASE 1: COPY ===');
  const results = [];
  for (const { localPath, r2Key } of files) {
    if (!fs.existsSync(localPath)) {
      console.log(`  MISSING: ${localPath}`);
      results.push({ ok: false, localPath, r2Key });
      continue;
    }
    const body = fs.readFileSync(localPath);
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: r2Key, Body: body }));
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: r2Key }));
    const sizeMatch = head.ContentLength === body.length;
    if (!sizeMatch) {
      console.log(`  SIZE MISMATCH: ${r2Key}`);
      results.push({ ok: false, localPath, r2Key });
      continue;
    }
    console.log(`  OK ${r2Key}`);
    results.push({ ok: true, localPath, r2Key, localSize: body.length });
  }
  return results;
}

async function phase2Verify(files) {
  console.log('\n=== PHASE 2: VERIFY (checksums) ===');
  for (const { localPath, r2Key } of files) {
    if (!fs.existsSync(localPath)) {
      console.log(`  MISSING LOCAL: ${localPath}`);
      throw new Error('Phase 2 failed — missing local file');
    }
    const localMd5 = createHash('md5').update(fs.readFileSync(localPath)).digest('hex');
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: r2Key }));
    const r2Etag = head.ETag?.replace(/"/g, '');
    if (localMd5 !== r2Etag) {
      console.log(`  CHECKSUM MISMATCH: ${r2Key} (local=${localMd5} r2=${r2Etag})`);
      throw new Error('Phase 2 failed — checksum mismatch');
    }
    console.log(`  OK ${r2Key}`);
  }
}

async function phase3UpdateDB(updates) {
  console.log('\n=== PHASE 3: UPDATE DB ===');
  await db.execute('BEGIN');
  try {
    for (const { table, col, id, r2Key } of updates) {
      await db.execute({ sql: `UPDATE ${table} SET ${col} = ? WHERE id = ?`, args: [r2Key, id] });
    }
    await db.execute('COMMIT');
    console.log(`  Updated ${updates.length} rows`);
  } catch (err) {
    await db.execute('ROLLBACK');
    throw new Error(`Phase 3 ROLLBACK: ${err.message}`);
  }
}

async function phase4FinalVerify(files) {
  console.log('\n=== PHASE 4: FINAL VERIFY ===');
  for (const { r2Key } of files) {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: r2Key }));
    if (!head.ContentLength) {
      throw new Error(`Phase 4 failed — ${r2Key} not accessible`);
    }
    console.log(`  OK ${r2Key} (${head.ContentLength} bytes)`);
  }
}

async function phase5Archive() {
  console.log('\n=== PHASE 5: ARCHIVE LOCAL ===');
  const backupPath = `${LOCAL_STORAGE}-backup-${new Date().toISOString().slice(0, 10)}`;
  fs.renameSync(LOCAL_STORAGE, backupPath);
  console.log(`  Archived to: ${backupPath}`);
  console.log('  Keep for 30 days, then delete manually.');
}

async function main() {
  console.log('RedInside → R2 Migration');
  console.log(`Bucket: ${BUCKET}, Local: ${LOCAL_STORAGE}`);

  // Collect all file paths from DB
  const music = (await db.execute('SELECT id, original_file_path, processed_file_path FROM music_generations')).rows;
  const medley = (await db.execute('SELECT id, output_file_path FROM medleys')).rows;
  const albums = (await db.execute('SELECT id, artwork_path FROM albums WHERE artwork_path IS NOT NULL')).rows;

  const filePairs = [];
  const dbUpdates = [];

  for (const row of music) {
    if (row.original_file_path) {
      const r2Key = localToR2Key(row.original_file_path);
      filePairs.push({ localPath: row.original_file_path, r2Key });
      dbUpdates.push({ table: 'music_generations', col: 'original_file_path', id: row.id, r2Key });
    }
    if (row.processed_file_path) {
      const r2Key = localToR2Key(row.processed_file_path);
      filePairs.push({ localPath: row.processed_file_path, r2Key });
      dbUpdates.push({ table: 'music_generations', col: 'processed_file_path', id: row.id, r2Key });
    }
  }

  for (const row of medley) {
    if (row.output_file_path) {
      const r2Key = localToR2Key(row.output_file_path);
      filePairs.push({ localPath: row.output_file_path, r2Key });
      dbUpdates.push({ table: 'medleys', col: 'output_file_path', id: row.id, r2Key });
    }
  }

  for (const row of albums) {
    if (row.artwork_path) {
      const r2Key = localToR2Key(row.artwork_path);
      filePairs.push({ localPath: row.artwork_path, r2Key });
      dbUpdates.push({ table: 'albums', col: 'artwork_path', id: row.id, r2Key });
    }
  }

  console.log(`\nFiles to migrate: ${filePairs.length}`);
  console.log(`DB rows to update: ${dbUpdates.length}`);

  if (filePairs.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  const p1 = await phase1Copy(filePairs);
  const failed = p1.filter(r => !r.ok);
  if (failed.length > 0) {
    console.error(`\nPHASE 1 FAILED: ${failed.length} files. Fix and retry.`);
    process.exit(1);
  }

  await phase2Verify(filePairs);
  await phase3UpdateDB(dbUpdates);
  await phase4FinalVerify(filePairs);
  await phase5Archive();

  console.log('\nMIGRATION COMPLETE — switch STORAGE_DRIVER=r2 in config');
}

main().catch(err => {
  console.error('\nMIGRATION FAILED:', err.message);
  process.exit(1);
});