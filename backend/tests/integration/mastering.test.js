import { describe, it, after } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, '../fixtures/test-audio.mp3');

// Helper to create multipart form data request manually
function createMultiPartRequest(files, projectId) {
  const boundary = '----FormBoundary' + Date.now();
  const parts = [];

  files.forEach((file, idx) => {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files"; filename="${file.name}"\r\n` +
      `Content-Type: audio/mpeg\r\n\r\n`
    );
    parts.push(file.data);
    parts.push('\r\n');
  });

  parts.push(`--${boundary}--\r\n`);

  const body = Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p) : p));

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/mastering/upload/${projectId}`,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    }
  };

  return { options, body };
}

describe('Mastering API - Multi-file Upload', () => {
  // Track project IDs for cleanup
  const testProjectId = 'test-batch-' + Date.now();
  let listTestProjectId;

  after(() => {
    // Cleanup - remove all test project directories
    const testProjects = [testProjectId, listTestProjectId].filter(Boolean);
    testProjects.forEach(id => {
      const dir = path.join(process.cwd(), 'storage/projects', id);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  // /api/mastering/process is async (returns 202 { jobId }) to dodge Railway's
  // 60s timeout. Poll the status endpoint until the job settles, then return the
  // final result payload ({ status, results, errors, masteredPath, ... }).
  async function pollJob(jobId, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const r = await fetch(`http://localhost:3000/api/mastering/status/${jobId}`);
      const d = await r.json();
      if (d.status === 'done' || d.status === 'failed') return d;
      await new Promise(res => setTimeout(res, 300));
    }
    throw new Error(`mastering job ${jobId} timed out`);
  }

  function makeRequest(options, body) {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data: data });
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  it('uploads multiple files in single request', async () => {
    const fileData = fs.readFileSync(FIXTURE);
    const { options, body } = createMultiPartRequest([
      { name: 'track1.mp3', data: fileData },
      { name: 'track2.mp3', data: fileData },
    ], testProjectId);

    const res = await makeRequest(options, body);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.files), 'Response should have files array');
    assert.strictEqual(res.data.files.length, 2, 'Should have 2 files');
    assert.ok(res.data.files[0].id, 'First file should have id');
    assert.ok(res.data.files[1].id, 'Second file should have id');
  });

  it('handles single file as array', async () => {
    const fileData = fs.readFileSync(FIXTURE);
    const { options, body } = createMultiPartRequest([
      { name: 'single-track.mp3', data: fileData },
    ], testProjectId);

    const res = await makeRequest(options, body);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.files), 'Response should have files array');
    assert.strictEqual(res.data.files.length, 1, 'Should have 1 file');
  });

  it('lists mastered files for project', async () => {
    const projectId = 'test-list-' + Date.now();
    listTestProjectId = projectId;
    const fileData = fs.readFileSync(FIXTURE);
    const { options, body } = createMultiPartRequest([
      { name: 'track1.mp3', data: fileData },
    ], projectId);

    // Upload a file
    const uploadRes = await makeRequest(options, body);
    assert.strictEqual(uploadRes.status, 200);
    const { files: [{ id: fileId }] } = uploadRes.data;

    // Process it (async job → poll to completion)
    const processRes = await fetch('http://localhost:3000/api/mastering/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, projectId, preset: 'spotify', saveToProject: false })
    });
    assert.strictEqual(processRes.status, 202);
    const { jobId } = await processRes.json();
    const processData = await pollJob(jobId);
    assert.strictEqual(processData.status, 'done');
    assert.ok(processData.masteredPath);

    // List files
    const listRes = await fetch(`http://localhost:3000/api/mastering/files/${projectId}`);
    const listData = await listRes.json();

    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listData.files), 'Response should have files array');
    assert.strictEqual(listData.files.length, 1);
    assert.strictEqual(listData.files[0].id, fileId);
    assert.ok(listData.files[0].masteredPath);
  });

  it('batch processes multiple files', async () => {
    const projectId = 'test-batch-process-' + Date.now();

    // Upload 2 files
    const fileData = fs.readFileSync(FIXTURE);
    const { options, body } = createMultiPartRequest([
      { name: 'track1.mp3', data: fileData },
      { name: 'track2.mp3', data: fileData },
    ], projectId);

    const uploadRes = await makeRequest(options, body);
    assert.strictEqual(uploadRes.status, 200);
    const { files } = uploadRes.data;
    const fileIds = files.map(f => f.id);

    // Batch process
    const processRes = await fetch('http://localhost:3000/api/mastering/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds, projectId, preset: 'spotify', saveToProject: false })
    });
    assert.strictEqual(processRes.status, 202);
    const { jobId } = await processRes.json();

    const { results, errors } = await pollJob(jobId);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(errors.length, 0);
    assert.ok(results[0].masteredPath);
    assert.ok(results[1].masteredPath);

    // Verify files on disk
    assert.ok(fs.existsSync(results[0].masteredPath));
    assert.ok(fs.existsSync(results[1].masteredPath));
  });

  it('returns 400 when no files uploaded', async () => {
    const boundary = '----FormBoundary' + Date.now();
    const body = Buffer.from(`--${boundary}--\r\n`);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/mastering/upload/${testProjectId}`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      }
    };

    const res = await makeRequest(options, body);
    assert.ok(res.status >= 400, 'Should return error status');
  });

  it('saves mastered files to music history', async () => {
    // save-to-music creates a music row with an FK to projects, so use a real
    // project (seeded via the test endpoint), not a bare id string.
    const seedRes = await fetch('http://localhost:3000/api/test/seed-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MasterSaveTest' })
    });
    const { project } = await seedRes.json();
    const projectId = project.id;

    // Baseline music count (seed adds one track).
    const before = await (await fetch(`http://localhost:3000/api/projects/${projectId}/music`)).json();
    const beforeCount = before.length;

    // Upload and process
    const fileData = fs.readFileSync(FIXTURE);
    const { options, body } = createMultiPartRequest([
      { name: 'track.mp3', data: fileData },
    ], projectId);

    const uploadRes = await makeRequest(options, body);
    assert.strictEqual(uploadRes.status, 200);
    const { files: [{ id: fileId }] } = uploadRes.data;

    const procRes = await fetch('http://localhost:3000/api/mastering/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: [fileId], projectId, preset: 'spotify', saveToProject: false })
    });
    const { jobId } = await procRes.json();
    await pollJob(jobId); // mastered file must exist before save-to-music

    // Save to Music
    const saveRes = await fetch('http://localhost:3000/api/mastering/save-to-music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, fileIds: [fileId] })
    });

    const { saved } = await saveRes.json();
    assert.strictEqual(saved.length, 1);
    assert.ok(saved[0].musicId);
    assert.ok(saved[0].version);

    // The mastered track was added to the project's music list.
    const after = await (await fetch(`http://localhost:3000/api/projects/${projectId}/music`)).json();
    assert.strictEqual(after.length, beforeCount + 1);
    assert.ok(after.some(m => m.id === saved[0].musicId));

    // Cleanup the seeded project.
    await fetch(`http://localhost:3000/api/projects/${projectId}`, { method: 'DELETE' });
  });

  it('GET /api/mastering/:fileId/file/:projectId serves original audio bytes', async () => {
    const projectId = 'test-serve-orig-' + Date.now();
    const fileData = fs.readFileSync(FIXTURE);
    const { options, body } = createMultiPartRequest([
      { name: 'original.mp3', data: fileData },
    ], projectId);

    const uploadRes = await makeRequest(options, body);
    assert.strictEqual(uploadRes.status, 200);
    const { files: [{ id: fileId }] } = uploadRes.data;

    const serveRes = await fetch(`http://localhost:3000/api/mastering/${fileId}/file/${projectId}`);
    assert.strictEqual(serveRes.status, 200, `Expected 200, got ${serveRes.status}`);
    const contentType = serveRes.headers.get('content-type');
    assert.ok(
      contentType && (contentType.includes('audio') || contentType.includes('octet-stream')),
      `Expected audio content-type, got: ${contentType}`
    );
    const buf = await serveRes.arrayBuffer();
    assert.ok(buf.byteLength > 0, 'Served file must not be empty');
  });

  it('creates ZIP of selected mastered files', async () => {
    const projectId = 'test-zip-' + Date.now();

    // Upload and process 2 files
    const fileData = fs.readFileSync(FIXTURE);
    const { options, body } = createMultiPartRequest([
      { name: 'track1.mp3', data: fileData },
      { name: 'track2.mp3', data: fileData },
    ], projectId);

    const uploadRes = await makeRequest(options, body);
    assert.strictEqual(uploadRes.status, 200);
    const { files } = uploadRes.data;
    const fileIds = files.map(f => f.id);

    const procRes = await fetch('http://localhost:3000/api/mastering/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds, projectId, preset: 'spotify', saveToProject: false })
    });
    const { jobId } = await procRes.json();
    await pollJob(jobId); // mastered files must exist before zipping

    // Download ZIP
    const zipRes = await fetch(`http://localhost:3000/api/mastering/zip?projectId=${projectId}&fileIds=${fileIds.join(',')}`);

    assert.strictEqual(zipRes.status, 200);
    assert.ok(zipRes.headers.get('content-type').includes('zip'));

    // Verify ZIP content
    const buffer = await zipRes.arrayBuffer();
    assert.ok(buffer.byteLength > 0);

    // Extract and verify (basic check)
    const zip = new AdmZip(Buffer.from(buffer));
    const entries = zip.getEntries();
    assert.ok(entries.length >= 2); // At least our 2 files
  });
});