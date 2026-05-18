// backend/tests/integration/medley.test.js
// Real HTTP calls against localhost:3000 — NO mocks
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';

const API = 'http://localhost:3000';
let projectId;
let medleyId;

describe('Medley API — integration', () => {
  before(async () => {
    const res = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'medley-integration-test' }),
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

  // POST /api/medley
  test('POST /api/medley → 400 without projectId', async () => {
    const res = await fetch(`${API}/api/medley`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  test('POST /api/medley → 400 without name', async () => {
    const res = await fetch(`${API}/api/medley`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    assert.strictEqual(res.status, 400);
  });

  test('POST /api/medley → 201 creates medley', async () => {
    const res = await fetch(`${API}/api/medley`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name: 'My Test Medley' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected 201: ${JSON.stringify(data)}`);
    assert.ok(data.id, 'Missing id');
    assert.strictEqual(data.name, 'My Test Medley');
    assert.strictEqual(data.project_id, projectId);
    medleyId = data.id;
  });

  // GET /api/projects/:projectId/medleys
  test('GET /api/projects/:projectId/medleys → 200 returns array', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/medleys`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data), 'Expected array');
    assert.ok(data.length >= 1, 'Expected at least 1 medley');
    const found = data.find(m => m.id === medleyId);
    assert.ok(found, 'Created medley not in list');
  });

  // GET /api/medley/:id
  test('GET /api/medley/:id → 200 returns medley with tracks', async () => {
    const res = await fetch(`${API}/api/medley/${medleyId}`);
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(data)}`);
    assert.strictEqual(data.id, medleyId);
    assert.ok(Array.isArray(data.tracks), 'Missing tracks array');
  });

  test('GET /api/medley/:id → 404 for nonexistent', async () => {
    const res = await fetch(`${API}/api/medley/does-not-exist`);
    assert.strictEqual(res.status, 404);
  });

  // PUT /api/medley/:id
  test('PUT /api/medley/:id → 200 renames medley', async () => {
    const res = await fetch(`${API}/api/medley/${medleyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed Medley' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(data)}`);
    assert.strictEqual(data.name, 'Renamed Medley');
  });

  // POST /api/medley/:id/tracks — 400 with bad musicId
  test('POST /api/medley/:id/tracks → 400 with invalid musicId', async () => {
    const res = await fetch(`${API}/api/medley/${medleyId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId: 'does-not-exist' }),
    });
    assert.strictEqual(res.status, 400);
  });

  // GET /api/medley/:id/duration — empty medley
  test('GET /api/medley/:id/duration → 200 returns duration (0 for empty)', async () => {
    const res = await fetch(`${API}/api/medley/${medleyId}/duration`);
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(data)}`);
    assert.ok('duration' in data, 'Missing duration field');
  });

  // POST /api/medley/:id/export — no tracks
  test('POST /api/medley/:id/export → 400 when no tracks', async () => {
    const res = await fetch(`${API}/api/medley/${medleyId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'mp3' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // DELETE /api/medley/:id
  test('DELETE /api/medley/:id → 204 deletes medley', async () => {
    const res = await fetch(`${API}/api/medley/${medleyId}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 204);

    // Confirm gone
    const check = await fetch(`${API}/api/medley/${medleyId}`);
    assert.strictEqual(check.status, 404);
  });
});
