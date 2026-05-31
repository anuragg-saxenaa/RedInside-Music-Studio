// Re-sync: ensure every music file (+ artwork) exists in R2. Uploads local-only files.
import { createClient } from '@libsql/client';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const BASE = '/Users/admin/Music/RedInside-Storage';
const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const s3 = new S3Client({ region: 'auto', endpoint: process.env.R2_ENDPOINT, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
const BUCKET = process.env.R2_BUCKET_NAME;

const toKey = (p) => {
  if (!p) return null;
  if (p.startsWith('/Users/')) return p.startsWith(BASE + '/') ? p.slice(BASE.length + 1) : null;
  if (p.startsWith('http')) return null;
  return p.split(path.sep).join('/');
};
const localPath = (key) => path.join(BASE, key);
async function inR2(key) { try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; } catch { return false; } }
async function upload(key, ct) {
  const lp = localPath(key);
  if (!fs.existsSync(lp)) return 'no-local';
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: fs.readFileSync(lp), ContentType: ct }));
  return 'uploaded';
}

let uploaded = 0, already = 0, missing = 0;

console.log('== Music files ==');
const music = await turso.execute('SELECT id, original_file_path, processed_file_path FROM music_generations');
for (const row of music.rows) {
  for (const p of [row.original_file_path, row.processed_file_path]) {
    const key = toKey(p);
    if (!key) continue;
    if (await inR2(key)) { already++; continue; }
    const ct = key.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    const r = await upload(key, ct);
    if (r === 'uploaded') { uploaded++; process.stdout.write('+'); }
    else { missing++; process.stdout.write('.'); }
  }
}
console.log(`\n  music: ${uploaded} uploaded, ${already} already in R2, ${missing} missing locally`);

console.log('\n== Artwork files ==');
let aUp = 0;
const projectsDir = path.join(BASE, 'projects');
if (fs.existsSync(projectsDir)) {
  for (const projId of fs.readdirSync(projectsDir)) {
    const artDir = path.join(projectsDir, projId, 'artwork');
    if (!fs.existsSync(artDir)) continue;
    for (const file of fs.readdirSync(artDir)) {
      const key = `projects/${projId}/artwork/${file}`;
      if (await inR2(key)) continue;
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: fs.readFileSync(path.join(artDir, file)), ContentType: 'image/png' }));
      aUp++; process.stdout.write('+');
    }
  }
}
console.log(`\n  artwork: ${aUp} uploaded`);
console.log('\nDone.');
process.exit(0);
