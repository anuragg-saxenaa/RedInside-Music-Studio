// backend/tests/integration/lyrics.e2e.test.js
// Real HTTP calls against localhost:3000 — NO mocks
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';

const API = 'http://localhost:3000';
let projectId;

describe('Lyrics API — end-to-end', () => {
  before(async () => {
    const res = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'e2e-lyrics-test' }),
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

  test('GET /api/lyrics/presets → 200 with all 5 presets', async () => {
    const res = await fetch(`${API}/api/lyrics/presets`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const keys = Object.keys(data);
    assert.ok(keys.includes('hinglish-urban'), 'Missing hinglish-urban preset');
    assert.ok(keys.includes('hindi-urdu-classical'), 'Missing hindi-urdu-classical preset');
    assert.ok(keys.includes('punjabi-swagger'), 'Missing punjabi-swagger preset');
    assert.ok(keys.includes('regional-fusion'), 'Missing regional-fusion preset');
    assert.ok(keys.includes('custom'), 'Missing custom preset');
    assert.strictEqual(keys.length, 5, 'Expected exactly 5 presets');
  });

  test('POST /api/lyrics/generate → 400 without projectId', async () => {
    const res = await fetch(`${API}/api/lyrics/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error, 'Missing error field in 400 response');
  });

  test('POST /api/lyrics/generate → 404 for nonexistent projectId', async () => {
    const res = await fetch(`${API}/api/lyrics/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', projectId: 'nonexistent-project-id' }),
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error, 'Missing error in 404 response');
  });

  test('POST /api/lyrics/generate → 200 returns lyrics with real structure', async () => {
    const res = await fetch(`${API}/api/lyrics/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        prompt: 'Viral desi rap about Mumbai streets',
        stylePreset: 'hinglish-urban',
      }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.id, 'Missing id field');
    assert.ok(data.content, 'Missing content field');
    assert.ok(data.project_id === projectId, 'project_id mismatch');
    assert.strictEqual(data.version, 1, 'First generation should be version 1');
    assert.ok(typeof data.content === 'string' && data.content.length > 0, 'Content must be non-empty string');
  });

  test('GET /api/lyrics/:id → 200 returns lyrics by id', async () => {
    // Generate first
    const genRes = await fetch(`${API}/api/lyrics/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, prompt: 'Test song' }),
    });
    const generated = await genRes.json();
    assert.ok(generated.id, 'Generation failed — no id');

    // Fetch by id
    const res = await fetch(`${API}/api/lyrics/${generated.id}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.id, generated.id);
    assert.strictEqual(data.project_id, projectId);
    assert.ok(data.content, 'Missing content in retrieved lyrics');
  });

  test('GET /api/lyrics/:id → 404 for nonexistent id', async () => {
    const res = await fetch(`${API}/api/lyrics/nonexistent-lyrics-id`);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error, 'Missing error field in 404');
  });

  test('POST /api/lyrics/edit/:id → 404 for nonexistent lyrics', async () => {
    const res = await fetch(`${API}/api/lyrics/edit/nonexistent-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'make it more aggressive' }),
    });
    assert.strictEqual(res.status, 404);
  });

  test('GET /api/projects/:id/lyrics → 200 returns list for project', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/lyrics`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data), 'Expected array response');
  });

  test('version increments across multiple generations', async () => {
    const gen1 = await fetch(`${API}/api/lyrics/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, prompt: 'first song' }),
    }).then(r => r.json());

    const gen2 = await fetch(`${API}/api/lyrics/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, prompt: 'second song' }),
    }).then(r => r.json());

    assert.ok(gen2.version > gen1.version, `v2 (${gen2.version}) should be > v1 (${gen1.version})`);
  });

  test('project current_lyrics_version increments after generation', async () => {
    const before = await fetch(`${API}/api/projects/${projectId}`).then(r => r.json());
    await fetch(`${API}/api/lyrics/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, prompt: 'version test' }),
    });
    const after = await fetch(`${API}/api/projects/${projectId}`).then(r => r.json());
    assert.ok(
      after.current_lyrics_version > before.current_lyrics_version,
      `current_lyrics_version should increase: ${before.current_lyrics_version} → ${after.current_lyrics_version}`
    );
  });
});
