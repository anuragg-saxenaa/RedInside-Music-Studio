import { describe, it, after } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

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
  const testProjectId = 'test-batch-' + Date.now();

  after(() => {
    // Cleanup
    const projectDir = path.join(process.cwd(), 'storage/projects', testProjectId);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

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
});