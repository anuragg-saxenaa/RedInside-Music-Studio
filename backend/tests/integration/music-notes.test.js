import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const API = 'http://localhost:3000';

describe('Music Notes API', () => {
  let projectId, musicId, noteId;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('setup: seed project with music', async () => {
    const res = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `NotesTest-${Date.now()}`, music: true }),
    });
    const data = await res.json();
    projectId = data.project.id;
    musicId = data.music[0]?.id;
    assert.ok(musicId);
  });

  it('POST /api/music/:id/notes — creates note', async () => {
    const res = await fetch(`${API}/api/music/${musicId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp_sec: 12.5, text: 'Fix the drop here' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    assert.equal(body.text, 'Fix the drop here');
    assert.equal(body.timestamp_sec, 12.5);
    noteId = body.id;
  });

  it('GET /api/music/:id/notes — returns notes array', async () => {
    const res = await fetch(`${API}/api/music/${musicId}/notes`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.some(n => n.id === noteId));
  });

  it('POST /api/music/:id/notes — 400 for missing text', async () => {
    const res = await fetch(`${API}/api/music/${musicId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp_sec: 5 }),
    });
    assert.equal(res.status, 400);
  });

  it('DELETE /api/music/:id/notes/:noteId — deletes note', async () => {
    const res = await fetch(`${API}/api/music/${musicId}/notes/${noteId}`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    const listRes = await fetch(`${API}/api/music/${musicId}/notes`);
    const notes = await listRes.json();
    assert.ok(!notes.some(n => n.id === noteId));
  });
});
