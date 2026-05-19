import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const API = 'http://localhost:3000';

describe('Social Export API', () => {
  let projectId, musicId;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('setup: seed project with music', async () => {
    const res = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `SocialExportTest-${Date.now()}`, music: true }),
    });
    const data = await res.json();
    projectId = data.project.id;
    musicId = data.music[0]?.id;
    assert.ok(musicId);
  });

  it('POST /api/audio/social-export — reels preset returns MP3 bytes', async () => {
    const res = await fetch(`${API}/api/audio/social-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId, preset: 'reels' }),
    });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('audio/mpeg'));
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 1000, 'audio output must have content');
  });

  it('POST /api/audio/social-export — full preset returns full track', async () => {
    const res = await fetch(`${API}/api/audio/social-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId, preset: 'full' }),
    });
    assert.equal(res.status, 200);
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 1000);
  });

  it('POST /api/audio/social-export — 400 for invalid preset', async () => {
    const res = await fetch(`${API}/api/audio/social-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId, preset: 'snapchat' }),
    });
    assert.equal(res.status, 400);
  });

  it('POST /api/audio/social-export — 400 for missing musicId', async () => {
    const res = await fetch(`${API}/api/audio/social-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: 'tiktok' }),
    });
    assert.equal(res.status, 400);
  });
});
