/**
 * Voice Design & Image Generation API Contract Tests
 *
 * All tests use the MiniMax mock server (backend must run with npm run dev:mock).
 * Tests verify real API contracts — request/response shapes, error handling.
 *
 * Voice endpoints: POST /api/voice/design, GET /api/voices,
 *                  DELETE /api/voice/:voiceId, POST /api/voice/clone,
 *                  GET /api/voice/clones/:projectId
 * Image endpoints: POST /api/image/generate, GET /api/projects/:id/images
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const API = 'http://localhost:3000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_AUDIO = path.join(__dirname, '../fixtures/test-audio.mp3');

// ─── VOICE DESIGN ─────────────────────────────────────────────────────────────

test.describe('Voice Design API', () => {
  test('POST /api/voice/design → 400 without required fields', async ({ request }) => {
    const res = await request.post(`${API}/api/voice/design`, { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('POST /api/voice/design → 400 without previewText', async ({ request }) => {
    const res = await request.post(`${API}/api/voice/design`, {
      data: { prompt: 'Deep male voice for Hindi hip-hop' }
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/voice/design → 200 with voiceId (mock)', async ({ request }) => {
    const res = await request.post(`${API}/api/voice/design`, {
      data: {
        prompt: 'Deep male voice with Hindi accent, urban hip-hop style',
        previewText: 'Yeh raat kuch alag hai, teri yaad mein khoye hain hum',
      }
    });
    expect(res.status(), 'Voice design must return 200 with mock server').toBe(200);
    const body = await res.json();
    expect(body.voiceId, 'Response must include voiceId').toBeTruthy();
  });

  test('GET /api/voices → 200 array of voice objects', async ({ request }) => {
    const res = await request.get(`${API}/api/voices`);
    expect(res.status()).toBe(200);
    const voices = await res.json();
    expect(Array.isArray(voices), 'Voices must be an array').toBe(true);
    // Mock returns 2 voices
    expect(voices.length, 'Must return at least 1 voice').toBeGreaterThan(0);
    const v = voices[0];
    expect(v.voice_id, 'Voice must have voice_id').toBeTruthy();
  });

  test('DELETE /api/voice/:voiceId → 200 success', async ({ request }) => {
    // Mock server returns success for any delete
    const res = await request.delete(`${API}/api/voice/mock_voice_to_delete`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /api/voice/clone → 400 without projectId', async ({ request }) => {
    const res = await request.post(`${API}/api/voice/clone`, {
      data: { name: 'My Voice' }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/projectId.*required|required.*projectId/i);
  });

  test('POST /api/voice/clone → 400 without name', async ({ request }) => {
    const res = await request.post(`${API}/api/voice/clone`, {
      data: { projectId: 'fake-project-id' }
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/voice/clone → 400 without audioFilePath', async ({ request }) => {
    const project = await (await request.post(`${API}/api/projects`, {
      data: { name: `Voice Clone Test ${Date.now()}` }
    })).json();

    const res = await request.post(`${API}/api/voice/clone`, {
      data: { projectId: project.id, name: 'Test Clone' }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/audioFilePath/i);

    await request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });

  test('POST /api/voice/clone → 200 with real fixture file (mock upload)', async ({ request }) => {
    const project = await (await request.post(`${API}/api/projects`, {
      data: { name: `Voice Clone Real Test ${Date.now()}` }
    })).json();

    // Use absolute path to fixture audio file (backend reads from filesystem)
    const res = await request.post(`${API}/api/voice/clone`, {
      data: {
        projectId: project.id,
        name: 'Cloned Hindi Voice',
        audioFilePath: FIXTURE_AUDIO,
      }
    });

    expect(res.status(), 'Voice clone with real file must return 200').toBe(200);
    const body = await res.json();
    expect(body.id, 'Clone response must have id').toBeTruthy();
    expect(body.projectId, 'Clone response must have projectId').toBe(project.id);
    expect(body.name, 'Clone response must have name').toBe('Cloned Hindi Voice');
    expect(body.voiceId, 'Clone response must have voiceId (file_id from MiniMax)').toBeTruthy();
    // voiceId must NOT be the file path (old stub bug)
    expect(body.voiceId, 'voiceId must not be the audioFilePath').not.toBe(FIXTURE_AUDIO);

    // Verify clone is persisted
    const clones = await request.get(`${API}/api/voice/clones/${project.id}`);
    expect(clones.status()).toBe(200);
    const cloneList = await clones.json();
    expect(cloneList.length, 'Clone must be persisted in DB').toBeGreaterThan(0);
    expect(cloneList[0].name).toBe('Cloned Hindi Voice');

    await request.delete(`${API}/api/projects/${project.id}`).catch(() => {});
  });
});

// ─── IMAGE GENERATION ─────────────────────────────────────────────────────────

test.describe('Image Generation API', () => {
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API}/api/projects`, {
      data: { name: `Image Test ${Date.now()}` }
    });
    const project = await res.json();
    projectId = project.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await request.delete(`${API}/api/projects/${projectId}`).catch(() => {});
  });

  test('POST /api/image/generate → 400 without prompt', async ({ request }) => {
    const res = await request.post(`${API}/api/image/generate`, {
      data: { projectId }
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('POST /api/image/generate → 400 without projectId', async ({ request }) => {
    const res = await request.post(`${API}/api/image/generate`, {
      data: { prompt: 'Bollywood hip-hop album cover' }
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/image/generate → 200 with imageUrls array (mock)', async ({ request }) => {
    const res = await request.post(`${API}/api/image/generate`, {
      data: {
        projectId,
        prompt: 'Album cover art for desi hip-hop: neon city lights, street art',
        model: 'image-01',
      }
    });
    expect(res.status(), 'Image generate must return 200 with mock').toBe(200);
    const body = await res.json();
    expect(body.imageUrls || body.image_urls, 'Response must include imageUrls').toBeTruthy();
    const urls = body.imageUrls || body.image_urls;
    expect(Array.isArray(urls), 'imageUrls must be array').toBe(true);
    expect(urls.length, 'Must have at least 1 image URL').toBeGreaterThan(0);
    expect(body.id, 'Response must have id').toBeTruthy();
    expect(body.projectId || body.project_id, 'Response must have projectId').toBeTruthy();
  });

  test('GET /api/projects/:id/images → 200 array after generation', async ({ request }) => {
    // Generate one first
    await request.post(`${API}/api/image/generate`, {
      data: { projectId, prompt: 'Dark hip-hop album art', model: 'image-01' }
    });

    const res = await request.get(`${API}/api/projects/${projectId}/images`);
    expect(res.status()).toBe(200);
    const images = await res.json();
    expect(Array.isArray(images), 'Images must be array').toBe(true);
    expect(images.length, 'Must have at least 1 image after generation').toBeGreaterThan(0);
    const img = images[0];
    expect(img.id).toBeTruthy();
    expect(img.project_id || img.projectId).toBeTruthy();
    expect(img.prompt).toBeTruthy();
  });

  test('GET /api/projects/nonexistent/images → 200 empty array', async ({ request }) => {
    const res = await request.get(`${API}/api/projects/nonexistent-project-xyz/images`);
    // Should return empty array, not 404 (project may just have no images)
    expect(res.status()).toBe(200);
    const images = await res.json();
    expect(Array.isArray(images)).toBe(true);
    expect(images.length).toBe(0);
  });
});
