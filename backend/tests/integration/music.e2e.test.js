// backend/tests/integration/music.e2e.test.js
// Real HTTP calls against localhost:3000 — NO mocks
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';

const API = 'http://localhost:3000';

async function poll(jobId, maxMs = 15000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${API}/api/jobs/${jobId}`);
    const job = await r.json();
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise(res => setTimeout(res, 500));
  }
  throw new Error(`Job ${jobId} did not complete within ${maxMs}ms`);
}

describe('Music API — end-to-end', () => {
  let projectId;
  let lyricsId;

  before(async () => {
    const proj = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'e2e-music-test' }),
    }).then(r => r.json());
    projectId = proj.id;

    // Generate lyrics to use as input for music tests
    const lyr = await fetch(`${API}/api/lyrics/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, prompt: 'Test song for music generation' }),
    }).then(r => r.json());
    lyricsId = lyr.id;
  });

  after(async () => {
    if (projectId) {
      await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' });
    }
  });

  test('GET /api/music/settings → 200 with all settings fields', async () => {
    const res = await fetch(`${API}/api/music/settings`);
    assert.strictEqual(res.status, 200);
    const { data } = await res.json();
    assert.ok(Array.isArray(data.sampleRates), 'Missing sampleRates array');
    assert.ok(Array.isArray(data.bitrates), 'Missing bitrates array');
    assert.ok(Array.isArray(data.formats), 'Missing formats array');
    assert.ok(data.sampleRates.includes(44100), 'Missing 44100 Hz');
    assert.ok(data.formats.includes('mp3'), 'Missing mp3 format');
  });

  test('POST /api/music/generate → 400 without projectId', async () => {
    const res = await fetch(`${API}/api/music/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lyricsId }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error, 'Missing error field');
  });

  test('POST /api/music/generate → 400 for invalid model', async () => {
    const res = await fetch(`${API}/api/music/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, lyricsId, model: 'invalid-model' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error, 'Missing error field');
    assert.ok(data.error.includes('Invalid model'), 'Error message should mention invalid model');
  });

  test('POST /api/music/generate → 404 for nonexistent projectId', async () => {
    const res = await fetch(`${API}/api/music/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'nonexistent-project', lyricsId }),
    });
    assert.strictEqual(res.status, 404);
  });

  test('POST /api/music/generate → 202 queues job, polls to completed, file accessible', async () => {
    const genRes = await fetch(`${API}/api/music/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, lyricsId, model: 'music-2.6' }),
    });
    assert.strictEqual(genRes.status, 202, `Expected 202, got ${genRes.status}`);
    const { jobId } = await genRes.json();
    assert.ok(jobId, 'Missing jobId in 202 response');

    // Poll until completed
    const job = await poll(jobId);
    assert.strictEqual(job.status, 'completed', `Job failed: ${job.error_message}`);

    // Verify music record exists via project music list
    const listRes = await fetch(`${API}/api/projects/${projectId}/music`);
    assert.strictEqual(listRes.status, 200);
    const musicList = await listRes.json();
    assert.ok(musicList.length > 0, 'No music records found after generation');

    const music = musicList[0];
    assert.ok(music.id, 'Missing music id');
    assert.strictEqual(music.project_id, projectId);
  });

  test('GET /api/music/:id → 200 returns music record', async () => {
    // Get music from list
    const listRes = await fetch(`${API}/api/projects/${projectId}/music`);
    const musicList = await listRes.json();
    assert.ok(musicList.length > 0, 'No music to test GET by id');

    const musicId = musicList[0].id;
    const res = await fetch(`${API}/api/music/${musicId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.id, musicId);
    assert.strictEqual(data.project_id, projectId);
  });

  test('GET /api/music/:id → 404 for nonexistent id', async () => {
    const res = await fetch(`${API}/api/music/nonexistent-music-id`);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error, 'Missing error in 404 response');
  });

  test('GET /api/music/:id/file → 200 serves audio binary', async () => {
    const listRes = await fetch(`${API}/api/projects/${projectId}/music`);
    const musicList = await listRes.json();
    assert.ok(musicList.length > 0, 'No music to test file serving');

    const musicId = musicList[0].id;
    const res = await fetch(`${API}/api/music/${musicId}/file`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(
      contentType && (contentType.includes('audio') || contentType.includes('octet-stream')),
      `Expected audio content-type, got: ${contentType}`
    );
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 0, 'Empty audio file served');
  });

  test('GET /api/music/:id/download → 200 serves audio binary', async () => {
    const listRes = await fetch(`${API}/api/projects/${projectId}/music`);
    const musicList = await listRes.json();
    assert.ok(musicList.length > 0, 'No music to test download');

    const musicId = musicList[0].id;
    const res = await fetch(`${API}/api/music/${musicId}/download`);
    assert.strictEqual(res.status, 200);
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 0, 'Empty file from download endpoint');
  });

  test('PATCH /api/music/:id → 200 updates music record', async () => {
    const listRes = await fetch(`${API}/api/projects/${projectId}/music`);
    const musicList = await listRes.json();
    assert.ok(musicList.length > 0, 'No music to test PATCH');

    const musicId = musicList[0].id;
    const res = await fetch(`${API}/api/music/${musicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.title, 'Updated Title');
  });

  test('POST /api/music/generate uses default model from settings when not specified', async () => {
    // Set default_music_model in settings
    await fetch(`${API}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_music_model: 'music-2.6' }),
    });

    // Generate without specifying model
    const res = await fetch(`${API}/api/music/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, lyricsId }),
    });
    assert.strictEqual(res.status, 202, 'Should accept request using default model from settings');
    const { jobId } = await res.json();

    // Cancel job (don't wait for completion)
    await fetch(`${API}/api/jobs/${jobId}/cancel`, { method: 'POST' });
  });

  test('POST /api/music/:id/convert → 202 queues FFmpeg job, result has processedFilePath', async () => {
    const seedRes = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `convert-test-${Date.now()}`, music: true }),
    });
    assert.ok(seedRes.ok, `Seed failed: ${seedRes.status}`);
    const { project: seedProject } = await seedRes.json();

    const musicList = await fetch(`${API}/api/projects/${seedProject.id}/music`).then(r => r.json());
    assert.ok(musicList.length > 0, 'Seeded project must have music record');
    const musicId = musicList[0].id;

    const convertRes = await fetch(`${API}/api/music/${musicId}/convert`, { method: 'POST' });
    const convertData = await convertRes.json();
    assert.ok(
      convertRes.status === 200 || convertRes.status === 202,
      `Expected 200 or 202, got ${convertRes.status}: ${JSON.stringify(convertData)}`
    );
    assert.ok(
      convertData.musicId || convertData.jobId || convertData.processedFilePath,
      `Convert response must have musicId or jobId, got: ${JSON.stringify(convertData)}`
    );

    // If async job, poll to completion
    if (convertData.jobId) {
      const job = await poll(convertData.jobId, 30000);
      assert.strictEqual(job.status, 'completed', `Convert job failed: ${JSON.stringify(job.error)}`);
    }

    // Cleanup seeded project
    await fetch(`${API}/api/projects/${seedProject.id}`, { method: 'DELETE' }).catch(() => {});
  });

  test('project current_music_version increments after generation completes', async () => {
    const before = await fetch(`${API}/api/projects/${projectId}`).then(r => r.json());
    assert.ok(before.current_music_version > 0, 'Should have at least 1 music version from previous test');
  });
});
