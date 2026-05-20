import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const API = 'http://localhost:3000';

describe('Music metadata PATCH', () => {
  let projectId, musicId;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('setup: seed project with music', async () => {
    const res = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `MetadataTest-${Date.now()}`, music: true }),
    });
    const data = await res.json();
    projectId = data.project.id;
    musicId = data.music[0]?.id;
    assert.ok(musicId, 'musicId must exist after seed');
  });

  it('PATCH /api/music/:id saves artist/genre/year/track_number/composer/lyrics_credit', async () => {
    const res = await fetch(`${API}/api/music/${musicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artist: 'RedInside',
        genre: 'Desi Hip-Hop',
        year: 2026,
        track_number: 1,
        composer: 'Test Composer',
        lyrics_credit: 'Test Lyricist',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.artist, 'RedInside');
    assert.equal(data.genre, 'Desi Hip-Hop');
    assert.equal(data.year, 2026);
    assert.equal(data.track_number, 1);
    assert.equal(data.composer, 'Test Composer');
    assert.equal(data.lyrics_credit, 'Test Lyricist');
  });
});

describe('Album CRUD', () => {
  let projectId, musicId, albumId;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('setup: seed project with music', async () => {
    const res = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `AlbumTest-${Date.now()}`, music: true }),
    });
    const data = await res.json();
    projectId = data.project.id;
    musicId = data.music[0]?.id;
    assert.ok(musicId, 'musicId must exist after seed');
  });

  it('POST /api/projects/:id/albums creates album', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dil Se EP', artist: 'RedInside', year: 2026 }),
    });
    assert.equal(res.status, 201);
    const album = await res.json();
    albumId = album.id;
    assert.ok(albumId);
    assert.equal(album.title, 'Dil Se EP');
    assert.equal(album.artist, 'RedInside');
    assert.equal(album.year, 2026);
  });

  it('GET /api/projects/:id/albums lists albums', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums`);
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    assert.ok(list.some(a => a.id === albumId));
  });

  it('PUT /api/projects/:id/albums/:albumId updates album', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dil Se EP Vol.2', genre: 'Desi Hip-Hop' }),
    });
    assert.equal(res.status, 200);
    const album = await res.json();
    assert.equal(album.title, 'Dil Se EP Vol.2');
    assert.equal(album.genre, 'Desi Hip-Hop');
  });

  it('POST .../tracks adds track to album', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId }),
    });
    assert.equal(res.status, 201);
    const tracks = await res.json();
    assert.ok(Array.isArray(tracks));
    assert.ok(tracks.some(t => t.id === musicId));
  });

  it('GET .../tracks lists album tracks', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks`);
    assert.equal(res.status, 200);
    const tracks = await res.json();
    assert.ok(tracks.some(t => t.id === musicId));
  });

  it('PUT .../tracks/reorder reorders tracks', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: [musicId] }),
    });
    assert.equal(res.status, 200);
  });

  it('DELETE .../tracks/:musicId removes track', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks/${musicId}`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    const tracks = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}/tracks`).then(r => r.json());
    assert.ok(!tracks.some(t => t.id === musicId));
  });

  it('DELETE /api/projects/:id/albums/:albumId deletes album', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/${albumId}`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    const list = await fetch(`${API}/api/projects/${projectId}/albums`).then(r => r.json());
    assert.ok(!list.some(a => a.id === albumId));
  });

  it('returns 404 for nonexistent album tracks', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums/fake-id/tracks`);
    assert.equal(res.status, 404);
  });

  it('returns 400 when creating album without title', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });
});
