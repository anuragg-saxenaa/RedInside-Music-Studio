import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VocalRemovalService } from '../../src/modules/audio/vocal-removal.service.js';

describe('VocalRemovalService.detectEngine', () => {
  it('returns "demucs" or "ffmpeg"', async () => {
    const engine = await VocalRemovalService.detectEngine();
    assert.ok(['demucs', 'ffmpeg'].includes(engine), `expected demucs or ffmpeg, got ${engine}`);
  });
});

const BASE = 'http://localhost:3001';

describe('POST /api/audio/remove-vocals', () => {
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
});
