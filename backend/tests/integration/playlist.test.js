import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const API = 'http://localhost:3000';

describe('Playlist API', () => {
  let playlistId;

  after(async () => {
    if (playlistId) {
      await fetch(`${API}/api/playlists/${playlistId}`, { method: 'DELETE' }).catch(() => {});
    }
  });

  it('POST /api/playlists — creates playlist', async () => {
    const res = await fetch(`${API}/api/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Playlist' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    assert.equal(body.name, 'Test Playlist');
    playlistId = body.id;
  });

  it('GET /api/playlists — lists playlists including new one', async () => {
    const res = await fetch(`${API}/api/playlists`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.some(p => p.id === playlistId));
  });

  it('PUT /api/playlists/:id — renames playlist', async () => {
    const res = await fetch(`${API}/api/playlists/${playlistId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed Playlist' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.name, 'Renamed Playlist');
  });

  it('POST /api/playlists — 400 for missing name', async () => {
    const res = await fetch(`${API}/api/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('POST /api/playlists/:id/tracks — adds seeded music track', async () => {
    const seedRes = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `PlaylistTrackTest-${Date.now()}`, music: true }),
    });
    const { project, music } = await seedRes.json();
    const musicId = music[0]?.id;
    assert.ok(musicId, 'seed must return music');

    const addRes = await fetch(`${API}/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId }),
    });
    assert.equal(addRes.status, 201);
    const tracks = await addRes.json();
    assert.ok(Array.isArray(tracks));
    assert.ok(tracks.some(t => t.id === musicId));

    const delRes = await fetch(`${API}/api/playlists/${playlistId}/tracks/${musicId}`, { method: 'DELETE' });
    assert.equal(delRes.status, 204);

    await fetch(`${API}/api/projects/${project.id}`, { method: 'DELETE' }).catch(() => {});
  });

  it('DELETE /api/playlists/:id — deletes playlist', async () => {
    const res = await fetch(`${API}/api/playlists/${playlistId}`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    playlistId = null;
  });
});
