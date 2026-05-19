import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const API = 'http://localhost:3000';

describe('Share Links API', () => {
  let projectId, token;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('setup: create project', async () => {
    const res = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `ShareTest-${Date.now()}` }),
    });
    const data = await res.json();
    projectId = data.id;
    assert.ok(projectId);
  });

  it('POST /api/projects/:id/share — creates share token', async () => {
    const res = await fetch(`${API}/api/projects/${projectId}/share`, { method: 'POST' });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.token, 'must return token');
    assert.ok(body.url, 'must return url');
    assert.ok(body.expiresAt, 'must return expiresAt');
    token = body.token;
  });

  it('GET /api/share/:token — returns project + music', async () => {
    const res = await fetch(`${API}/api/share/${token}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.project?.id === projectId);
    assert.ok(Array.isArray(body.music));
    assert.ok(body.expiresAt);
  });

  it('GET /api/share/badtoken — 404', async () => {
    const res = await fetch(`${API}/api/share/this-token-does-not-exist`);
    assert.equal(res.status, 404);
  });

  it('POST /api/projects/nonexistent/share — 404', async () => {
    const res = await fetch(`${API}/api/projects/no-such-project/share`, { method: 'POST' });
    assert.equal(res.status, 404);
  });
});
