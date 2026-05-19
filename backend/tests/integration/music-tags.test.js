import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const API = 'http://localhost:3000';

describe('Music Tags API', () => {
  let projectId;

  after(async () => {
    if (projectId) await fetch(`${API}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {});
  });

  it('GET /api/music/:id/tags — returns tag object with bpm/key/mood', async () => {
    const seedRes = await fetch(`${API}/api/test/seed-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `TagsTest-${Date.now()}`, music: true }),
    });
    const { project, music } = await seedRes.json();
    projectId = project.id;
    const musicId = music[0]?.id;
    assert.ok(musicId);

    const res = await fetch(`${API}/api/music/${musicId}/tags`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok('bpm' in body, 'response must have bpm field');
    assert.ok('key' in body, 'response must have key field');
    assert.ok('mood' in body, 'response must have mood field');
  });

  it('GET /api/music/nonexistent/tags — returns gracefully', async () => {
    const res = await fetch(`${API}/api/music/nonexistent-id/tags`);
    assert.ok([200, 404].includes(res.status));
    if (res.status === 200) {
      const body = await res.json();
      assert.equal(body.bpm, null);
    }
  });
});
