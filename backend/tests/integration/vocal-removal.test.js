import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { VocalRemovalService } from '../../src/modules/audio/vocal-removal.service.js';

const BASE = 'http://localhost:3000';

async function pollJob(jobId, maxMs = 30000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${BASE}/api/jobs/${jobId}`);
    const job = await r.json();
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise(res => setTimeout(res, 800));
  }
  throw new Error(`Job ${jobId} did not finish within ${maxMs}ms`);
}

describe('VocalRemovalService.detectEngine', () => {
  it('returns "demucs" or "ffmpeg"', async () => {
    const engine = await VocalRemovalService.detectEngine();
    assert.ok(['demucs', 'ffmpeg'].includes(engine), `expected demucs or ffmpeg, got ${engine}`);
  });
});

describe('POST /api/audio/remove-vocals — validation', () => {
  it('returns 400 when musicId missing', async () => {
    const res = await fetch(`${BASE}/api/audio/remove-vocals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-1' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('returns 400 when projectId missing', async () => {
    const res = await fetch(`${BASE}/api/audio/remove-vocals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId: 'music-1' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('returns 404 for nonexistent musicId', async () => {
    const res = await fetch(`${BASE}/api/audio/remove-vocals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId: 'nonexistent-music-999', projectId: 'proj-1' }),
    });
    assert.ok(res.status === 404 || res.status === 400, `Expected 404 or 400, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error);
  });
});

describe('POST /api/audio/remove-vocals — full job flow', () => {
  let projectId;
  let musicId;

  before(async () => {
    // Seed a project with real music file so vocal removal has something to process
    const seedRes = await fetch(`${BASE}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `VocalRemoval Test ${Date.now()}`, lyrics: true, music: true }),
    });
    assert.ok(seedRes.ok, `Seed failed: ${seedRes.status}`);
    const { project } = await seedRes.json();
    projectId = project.id;

    const musicRes = await fetch(`${BASE}/api/projects/${projectId}/music`);
    const musicList = await musicRes.json();
    assert.ok(musicList.length > 0, 'Seeded project must have at least 1 music record');
    musicId = musicList[0].id;
  });

  after(async () => {
    if (projectId) await fetch(`${BASE}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('202 + jobId when valid musicId + projectId supplied', async () => {
    const res = await fetch(`${BASE}/api/audio/remove-vocals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId, projectId }),
    });
    const body = await res.json();
    assert.equal(res.status, 202, `Expected 202, got ${res.status}: ${JSON.stringify(body)}`);
    assert.ok(body.jobId, 'Response must contain jobId');
  });

  it('job completes and creates instrumental music record', async () => {
    const startRes = await fetch(`${BASE}/api/audio/remove-vocals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId, projectId }),
    });
    assert.equal(startRes.status, 202);
    const { jobId } = await startRes.json();

    const job = await pollJob(jobId, 30000);
    assert.equal(job.status, 'completed', `Job failed: ${JSON.stringify(job.error || job.result)}`);
    assert.ok(job.result?.instrumentalMusicId, 'Completed job must have instrumentalMusicId in result');

    // Instrumental must be accessible as a music record
    const instrRes = await fetch(`${BASE}/api/music/${job.result.instrumentalMusicId}`);
    assert.equal(instrRes.status, 200, 'Instrumental music record must be GET-able');
    const instr = await instrRes.json();
    assert.ok(instr.id);
    assert.ok(instr.original_file_path || instr.originalFilePath, 'Instrumental must have a file path');

    // File bytes must be serveable
    const fileRes = await fetch(`${BASE}/api/music/${job.result.instrumentalMusicId}/file`);
    assert.equal(fileRes.status, 200, 'Instrumental audio file must be downloadable');
    const buf = await fileRes.arrayBuffer();
    assert.ok(buf.byteLength > 0, 'Instrumental file must not be empty');
  });
});
