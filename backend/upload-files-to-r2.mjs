// Upload existing local audio/artwork files to R2 and update Turso paths
import { createClient } from '@libsql/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

async function uploadFile(localPath, r2Key) {
  if (!fs.existsSync(localPath)) {
    console.log(`  MISSING: ${localPath}`);
    return false;
  }
  const buf = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = ext === '.mp3' ? 'audio/mpeg' : ext === '.wav' ? 'audio/wav' : ext === '.png' ? 'image/png' : 'application/octet-stream';
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: r2Key, Body: buf, ContentType: contentType }));
  return true;
}

// Convert local path to R2 key
// /Users/admin/Music/RedInside-Storage/projects/XYZ/generations/music/v1-processed.mp3
// → projects/XYZ/generations/music/v1-processed.mp3
const STORAGE_PREFIX = '/Users/admin/Music/RedInside-Storage/';

function toR2Key(localPath) {
  if (!localPath) return null;
  if (localPath.startsWith(STORAGE_PREFIX)) return localPath.slice(STORAGE_PREFIX.length);
  if (localPath.startsWith('/')) return localPath.slice(1); // strip leading slash as fallback
  return localPath;
}

console.log('==> Fetching music_generations from Turso...');
const musicResult = await turso.execute(
  'SELECT id, project_id, original_file_path, processed_file_path FROM music_generations WHERE original_file_path IS NOT NULL'
);

let uploaded = 0, skipped = 0, missing = 0;

for (const row of musicResult.rows) {
  const { id, original_file_path, processed_file_path } = row;
  let newOriginal = original_file_path;
  let newProcessed = processed_file_path;

  // Upload original
  if (original_file_path && original_file_path.startsWith('/')) {
    const key = toR2Key(original_file_path);
    const ok = await uploadFile(original_file_path, key);
    if (ok) { newOriginal = key; uploaded++; } else { missing++; }
  }

  // Upload processed
  if (processed_file_path && processed_file_path.startsWith('/')) {
    const key = toR2Key(processed_file_path);
    const ok = await uploadFile(processed_file_path, key);
    if (ok) { newProcessed = key; uploaded++; } else { missing++; }
  }

  // Update Turso
  await turso.execute({
    sql: 'UPDATE music_generations SET original_file_path = ?, processed_file_path = ? WHERE id = ?',
    args: [newOriginal, newProcessed, id],
  });
  process.stdout.write('.');
}

console.log(`\n  music_generations: ${uploaded} uploaded, ${missing} missing`);

// Artwork
console.log('\n==> Uploading artwork files...');
const artworkResult = await turso.execute(
  "SELECT id, project_id, artwork_url FROM music_generations WHERE artwork_url IS NOT NULL AND artwork_url != ''"
);

for (const row of artworkResult.rows) {
  const { id, project_id, artwork_url } = row;
  if (!artwork_url || !artwork_url.startsWith('/')) continue;

  // Artwork served from storage path
  const localPath = path.join('/Users/admin/Music/RedInside-Storage', artwork_url.replace(/^\/api\/projects\/[^/]+\/artwork\//, ''));
  // Try the actual artwork file path
  const artworkLocalPath = `/Users/admin/Music/RedInside-Storage/projects/${project_id}/artwork/${path.basename(artwork_url)}`;
  const key = `projects/${project_id}/artwork/${path.basename(artworkLocalPath)}`;
  const ok = await uploadFile(artworkLocalPath, key);
  if (ok) uploaded++;
}

console.log(`  Done. Total uploaded: ${uploaded}, missing: ${missing}`);
process.exit(0);
