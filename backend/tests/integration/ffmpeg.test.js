// backend/tests/integration/ffmpeg.test.js
// Real HTTP calls against localhost:3000 — NO mocks
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

const API = 'http://localhost:3000';
const FIXTURE_MP3 = path.resolve('tests/fixtures/output-mastering/test_spotify_master.wav');

let projectId;

describe('FFmpeg API — spec §4.5', () => {
  before(async () => {
    const res = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ffmpeg-spec-test' }),
    });
    assert.strictEqual(res.status, 201, 'Project creation failed');
    const data = await res.json();
    projectId = data.id;
  });

  after(async () => {
    if (projectId) {
      await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' });
    }
  });

  // POST /api/ffmpeg/convert-bitrate
  describe('POST /api/ffmpeg/convert-bitrate', () => {
    test('400 without source', async () => {
      const res = await fetch(`${API}/api/ffmpeg/convert-bitrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('400 for non-existent musicId', async () => {
      const res = await fetch(`${API}/api/ffmpeg/convert-bitrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicId: 'does-not-exist' }),
      });
      assert.strictEqual(res.status, 400);
    });

    test('200 with valid inputPath → returns filePath and downloadUrl', async () => {
      if (!fs.existsSync(FIXTURE_MP3)) {
        return;
      }
      const res = await fetch(`${API}/api/ffmpeg/convert-bitrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputPath: FIXTURE_MP3, bitrate: 128, format: 'mp3' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(data)}`);
      assert.ok(data.filePath, 'Missing filePath');
      assert.ok(data.downloadUrl, 'Missing downloadUrl');
      assert.strictEqual(data.bitrate, 128);
    });
  });

  // POST /api/ffmpeg/merge
  describe('POST /api/ffmpeg/merge', () => {
    test('400 without inputs', async () => {
      const res = await fetch(`${API}/api/ffmpeg/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('400 with fewer than 2 inputs', async () => {
      const res = await fetch(`${API}/api/ffmpeg/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: [{ inputPath: FIXTURE_MP3 }] }),
      });
      assert.strictEqual(res.status, 400);
    });

    test('400 when input cannot be resolved', async () => {
      const res = await fetch(`${API}/api/ffmpeg/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: [
            { musicId: 'does-not-exist' },
            { musicId: 'also-missing' },
          ],
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    test('200 with 2 valid inputPaths → returns merged filePath', async () => {
      if (!fs.existsSync(FIXTURE_MP3)) {
        return;
      }
      const res = await fetch(`${API}/api/ffmpeg/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: [
            { inputPath: FIXTURE_MP3 },
            { inputPath: FIXTURE_MP3 },
          ],
          format: 'mp3',
          bitrate: 128,
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(data)}`);
      assert.ok(data.filePath, 'Missing filePath');
      assert.ok(data.downloadUrl, 'Missing downloadUrl');
      assert.ok(data.message.includes('2'), 'Message should mention 2 files');
    });
  });
});
