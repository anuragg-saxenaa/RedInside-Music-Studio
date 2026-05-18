import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000';

describe('POST /api/downloader/youtube', () => {
  it('returns 400 when url missing', async () => {
    const res = await fetch(`${BASE}/api/downloader/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-1' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('returns 400 when projectId missing', async () => {
    const res = await fetch(`${BASE}/api/downloader/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=abc123' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('returns 400 for non-YouTube URL', async () => {
    const res = await fetch(`${BASE}/api/downloader/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://vimeo.com/12345', projectId: 'proj-1' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });
});
