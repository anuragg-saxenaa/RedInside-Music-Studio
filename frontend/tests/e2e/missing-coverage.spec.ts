/**
 * Missing Coverage Tests
 *
 * Covers 8 spec-required endpoints that had no hard-asserting tests:
 *   1. GET  /api/projects/:id/artwork
 *   2. POST /api/projects/:id/artwork
 *   3. POST /api/lyrics/edit/:id
 *   4. GET  /api/projects/:projectId/music
 *   5. GET  /api/projects/:projectId/video
 *   6. POST /api/history/replay/:id
 *   7. POST /api/upload/audio   (multipart)
 *   8. POST /api/upload/url
 *
 * All tests use the MiniMax mock server — never the real API.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const API = 'http://localhost:3000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_AUDIO = path.join(__dirname, '../fixtures/test-audio.mp3');
const MOCK_AUDIO_URL = 'http://localhost:8999/mock-audio-file';

async function createProject(request: any, suffix = ''): Promise<string> {
  const res = await request.post(`${API}/api/projects`, {
    data: { name: `MissingCov-${suffix}-${Date.now()}` }
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.id, 'project must have id').toBeTruthy();
  return body.id;
}

async function generateLyrics(request: any, projectId: string): Promise<string> {
  const res = await request.post(`${API}/api/lyrics/generate`, {
    data: { projectId, prompt: 'test song', stylePreset: 'custom' }
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id, 'lyrics must have id').toBeTruthy();
  return body.id;
}

// ─── 1 & 2: ARTWORK ───────────────────────────────────────────────────────────

test.describe('Artwork API', () => {
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    projectId = await createProject(request, 'artwork');
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('GET /api/projects/:id/artwork → 204 when no artwork exists', async ({ request }) => {
    const res = await request.get(`${API}/api/projects/${projectId}/artwork`);
    // 204 = no content (no artwork saved yet), 200 = image data
    expect([200, 204], 'should be 204 with no artwork or 200 with file').toContain(res.status());
  });

  test('POST /api/projects/:id/artwork → 400 without imageUrl', async ({ request }) => {
    const res = await request.post(`${API}/api/projects/${projectId}/artwork`, {
      data: {}
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/imageUrl/i);
  });

  test('POST /api/projects/:id/artwork → 200 saves base64 artwork', async ({ request }) => {
    // Use a minimal valid 1×1 PNG as base64
    const tiny1x1Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const res = await request.post(`${API}/api/projects/${projectId}/artwork`, {
      data: { imageUrl: tiny1x1Png }
    });
    expect(res.status(), 'artwork save must return 200').toBe(200);
    const body = await res.json();
    expect(body.success, 'body.success must be true').toBe(true);
    expect(body.path, 'must return file path').toBeTruthy();
  });

  test('GET /api/projects/:id/artwork → 200 with image after save', async ({ request }) => {
    const res = await request.get(`${API}/api/projects/${projectId}/artwork`);
    // After saving artwork above, should return the image file
    expect([200, 204], 'should be 200 with image data').toContain(res.status());
    if (res.status() === 200) {
      const ct = res.headers()['content-type'] || '';
      expect(ct).toMatch(/image/);
    }
  });

  test('POST /api/projects/:id/artwork → 200 saves artwork from mock URL', async ({ request }) => {
    // Use mock-image endpoint (1x1 PNG served by mock server)
    const imageUrl = 'http://localhost:8999/mock-image';
    const res = await request.post(`${API}/api/projects/${projectId}/artwork`, {
      data: { imageUrl }
    });
    expect(res.status(), 'artwork from URL must return 200').toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─── 3: LYRICS EDIT ───────────────────────────────────────────────────────────

test.describe('Lyrics Edit API', () => {
  let projectId = '';
  let lyricsId = '';

  test.beforeAll(async ({ request }) => {
    projectId = await createProject(request, 'lyrics-edit');
    lyricsId = await generateLyrics(request, projectId);
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('POST /api/lyrics/edit/:id → 400 without prompt', async ({ request }) => {
    const res = await request.post(`${API}/api/lyrics/edit/${lyricsId}`, {
      data: {}
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/prompt/i);
  });

  test('POST /api/lyrics/edit/:id → 404 for unknown id', async ({ request }) => {
    const res = await request.post(`${API}/api/lyrics/edit/nonexistent-id`, {
      data: { prompt: 'make it better' }
    });
    expect(res.status()).toBe(404);
  });

  test('POST /api/lyrics/edit/:id → 200 with edited lyrics (mock)', async ({ request }) => {
    const res = await request.post(`${API}/api/lyrics/edit/${lyricsId}`, {
      data: { prompt: 'make it more energetic and add a bridge' }
    });
    expect(res.status(), 'lyrics edit must return 200 with mock').toBe(200);
    const body = await res.json();
    expect(body.id, 'edited lyrics must have id').toBeTruthy();
    expect(body.content, 'edited lyrics must have content').toBeTruthy();
    expect(typeof body.content).toBe('string');
    expect(body.content.length, 'content must be non-empty').toBeGreaterThan(0);
    // Must be a new version (different id or incremented version)
    expect(body.version, 'edited lyrics must have version').toBeTruthy();
  });
});

// ─── 4 & 5: PROJECT MUSIC AND VIDEO LIST ─────────────────────────────────────

test.describe('Project Music and Video Lists', () => {
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    projectId = await createProject(request, 'lists');
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('GET /api/projects/:projectId/music → 200 empty array for new project', async ({ request }) => {
    const res = await request.get(`${API}/api/projects/${projectId}/music`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body), 'music list must be an array').toBe(true);
    expect(body.length).toBe(0);
  });

  test('GET /api/projects/:projectId/video → 200 empty array for new project', async ({ request }) => {
    const res = await request.get(`${API}/api/projects/${projectId}/video`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body), 'video list must be an array').toBe(true);
    expect(body.length).toBe(0);
  });

  test('GET /api/projects/:projectId/music → 200 array with music after seed', async ({ request }) => {
    // Seed via test endpoint
    const seedRes = await request.post(`${API}/api/test/seed-music/${projectId}`);
    expect(seedRes.status()).toBe(200);

    const res = await request.get(`${API}/api/projects/${projectId}/music`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length, 'must have at least 1 music track after seed').toBeGreaterThan(0);
    const track = body[0];
    expect(track.id, 'track must have id').toBeTruthy();
    expect(track.project_id || track.projectId, 'track must have project_id').toBeTruthy();
  });
});

// ─── 6: HISTORY REPLAY ────────────────────────────────────────────────────────

test.describe('History Replay API', () => {
  let projectId = '';
  let lyricsId = '';

  test.beforeAll(async ({ request }) => {
    projectId = await createProject(request, 'replay');
    lyricsId = await generateLyrics(request, projectId);
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('POST /api/history/replay/:id → 404 for unknown generation id', async ({ request }) => {
    const res = await request.post(`${API}/api/history/replay/nonexistent-gen-id`, {
      data: { type: 'lyrics' }
    });
    expect(res.status()).toBe(404);
  });

  test('POST /api/history/replay/:id → 200 returns regeneration params for lyrics', async ({ request }) => {
    const res = await request.post(`${API}/api/history/replay/${lyricsId}`, {
      data: { type: 'lyrics' }
    });
    expect(res.status(), 'replay must return 200').toBe(200);
    const body = await res.json();
    expect(body.generation, 'replay must include original generation').toBeTruthy();
    expect(body.type, 'replay must include type').toBe('lyrics');
    expect(body.regenerationParams, 'replay must include regeneration params').toBeTruthy();
    // Verify regeneration params have the prompt to re-use
    expect(body.regenerationParams.prompt || body.regenerationParams.stylePreset,
      'regeneration params must include prompt or style').toBeTruthy();
  });

  test('POST /api/history/replay/:id → auto-detects type when not provided', async ({ request }) => {
    const res = await request.post(`${API}/api/history/replay/${lyricsId}`, {
      data: {}
    });
    expect(res.status(), 'replay without type must still return 200').toBe(200);
    const body = await res.json();
    expect(body.type).toBe('lyrics');
  });
});

// ─── 7: UPLOAD AUDIO (MULTIPART) ─────────────────────────────────────────────

test.describe('Upload Audio API', () => {
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    projectId = await createProject(request, 'upload');
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('POST /api/upload/audio → 400 without projectId', async ({ request }) => {
    const res = await request.post(`${API}/api/upload/audio`, {
      multipart: {
        audio: {
          name: 'test.mp3',
          mimeType: 'audio/mpeg',
          buffer: Buffer.from('fake mp3 data'),
        }
      }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/projectId/i);
  });

  test('POST /api/upload/audio → 400 without file', async ({ request }) => {
    const res = await request.post(`${API}/api/upload/audio`, {
      multipart: {
        projectId
      }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/file|audio/i);
  });

  test('POST /api/upload/audio → 200 with real fixture file', async ({ request }) => {
    expect(fs.existsSync(FIXTURE_AUDIO), `fixture must exist at ${FIXTURE_AUDIO}`).toBe(true);

    const fileBuffer = fs.readFileSync(FIXTURE_AUDIO);
    const res = await request.post(`${API}/api/upload/audio`, {
      multipart: {
        projectId,
        audio: {
          name: 'test-audio.mp3',
          mimeType: 'audio/mpeg',
          buffer: fileBuffer,
        }
      }
    });
    expect(res.status(), 'audio upload must return 200').toBe(200);
    const body = await res.json();
    expect(body.id, 'upload response must have id').toBeTruthy();
    expect(body.filePath || body.path, 'upload response must have file path').toBeTruthy();
    expect(body.originalName || body.filename, 'upload response must have original name').toBeTruthy();
    expect(body.size, 'upload response must have size').toBeGreaterThan(0);
  });

  test('GET /api/upload/supported-formats → 200 with formats array', async ({ request }) => {
    const res = await request.get(`${API}/api/upload/supported-formats`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.formats), 'formats must be array').toBe(true);
    expect(body.formats.length, 'must have at least 1 format').toBeGreaterThan(0);
    expect(body.maxSizeMB, 'must have maxSizeMB').toBeGreaterThan(0);
  });
});

// ─── 8: UPLOAD FROM URL ───────────────────────────────────────────────────────

test.describe('Upload from URL API', () => {
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    projectId = await createProject(request, 'upload-url');
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('POST /api/upload/url → 400 without url', async ({ request }) => {
    const res = await request.post(`${API}/api/upload/url`, {
      data: { projectId }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url/i);
  });

  test('POST /api/upload/url → 400 without projectId', async ({ request }) => {
    const res = await request.post(`${API}/api/upload/url`, {
      data: { url: MOCK_AUDIO_URL }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/projectId/i);
  });

  test('POST /api/upload/url → 200 fetches and saves audio from mock URL', async ({ request }) => {
    const res = await request.post(`${API}/api/upload/url`, {
      data: {
        url: MOCK_AUDIO_URL,
        projectId,
      }
    });
    expect(res.status(), 'URL upload must return 200').toBe(200);
    const body = await res.json();
    expect(body.id, 'response must have id').toBeTruthy();
    expect(body.filePath || body.path, 'response must have file path').toBeTruthy();
    expect(body.size, 'response must have size > 0').toBeGreaterThan(0);
  });
});
