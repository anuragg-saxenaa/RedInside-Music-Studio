/**
 * CONTRACT VERIFICATION TESTS
 *
 * Tests every API endpoint defined in the Phase 1 + Phase 2 specs.
 * No mocks. Real backend. Real FFmpeg. Real SQLite.
 *
 * These tests FIND bugs — they are written against the spec contract,
 * not against the implementation.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API = 'http://localhost:3000';
const FIXTURE_AUDIO = path.resolve(__dirname, '../../../backend/tests/fixtures/test-audio.mp3');

// ─── helpers ───────────────────────────────────────────────────────────────

async function createProject(request: any, name = 'CONTRACT_TEST') {
  const res = await request.post(`${API}/api/projects`, {
    data: { name, description: 'Automated contract test' },
  });
  expect([200, 201]).toContain(res.status());
  const proj = await res.json();
  expect(proj.id).toBeTruthy();
  return proj;
}

async function deleteProject(request: any, id: string) {
  await request.delete(`${API}/api/projects/${id}`);
}

async function uploadAudio(request: any, projectId: string): Promise<string> {
  const fileBytes = fs.readFileSync(FIXTURE_AUDIO);
  const res = await request.post(`${API}/api/mastering/upload/${projectId}`, {
    multipart: {
      files: { name: 'test-audio.mp3', mimeType: 'audio/mpeg', buffer: fileBytes },
    },
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.files?.[0]?.id).toBeTruthy();
  return data.files[0].id;
}

// ─── Projects CRUD (spec §4.1) ─────────────────────────────────────────────

test.describe('Projects CRUD — spec §4.1', () => {
  test('POST /api/projects creates project', async ({ request }) => {
    const res = await request.post(`${API}/api/projects`, {
      data: { name: 'Test Project', description: 'desc' },
    });
    expect([200, 201]).toContain(res.status());
    const data = await res.json();
    expect(data.id).toBeTruthy();
    expect(data.name).toBe('Test Project');
    expect(data.current_lyrics_version).toBe(0);
    expect(data.current_music_version).toBe(0);
    expect(data.current_video_version).toBe(0);
    await deleteProject(request, data.id);
  });

  test('GET /api/projects lists projects', async ({ request }) => {
    const res = await request.get(`${API}/api/projects`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/projects/:id returns project', async ({ request }) => {
    const proj = await createProject(request);
    const res = await request.get(`${API}/api/projects/${proj.id}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(proj.id);
    await deleteProject(request, proj.id);
  });

  test('GET /api/projects/:id → 404 for nonexistent', async ({ request }) => {
    const res = await request.get(`${API}/api/projects/nonexistent-id-xyz`);
    expect(res.status()).toBe(404);
  });

  test('PUT /api/projects/:id updates project', async ({ request }) => {
    const proj = await createProject(request);
    const res = await request.put(`${API}/api/projects/${proj.id}`, {
      data: { name: 'Updated Name' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('Updated Name');
    await deleteProject(request, proj.id);
  });

  test('DELETE /api/projects/:id deletes project', async ({ request }) => {
    const proj = await createProject(request);
    const del = await request.delete(`${API}/api/projects/${proj.id}`);
    expect(del.status()).toBe(204);
    const get = await request.get(`${API}/api/projects/${proj.id}`);
    expect(get.status()).toBe(404);
  });

  test('POST /api/projects → 400 without name', async ({ request }) => {
    const res = await request.post(`${API}/api/projects`, {
      data: { description: 'no name' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Lyrics endpoints (spec §4.2) ──────────────────────────────────────────

test.describe('Lyrics API — spec §4.2', () => {
  test('GET /api/lyrics/presets returns 5 style presets', async ({ request }) => {
    const res = await request.get(`${API}/api/lyrics/presets`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    const keys = Object.keys(data);
    expect(keys.length).toBeGreaterThanOrEqual(5);
    expect(keys).toContain('hinglish-urban');
    expect(keys).toContain('hindi-urdu-classical');
    expect(keys).toContain('punjabi-swagger');
    expect(keys).toContain('regional-fusion');
    expect(keys).toContain('custom');
  });

  test('POST /api/lyrics/generate → 400 with empty prompt', async ({ request }) => {
    const proj = await createProject(request);
    const res = await request.post(`${API}/api/lyrics/generate`, {
      data: { projectId: proj.id, prompt: '', stylePreset: 'hinglish-urban' },
    });
    expect(res.status()).toBe(400);
    await deleteProject(request, proj.id);
  });

  test('POST /api/lyrics/generate → 400 with nonexistent projectId', async ({ request }) => {
    const res = await request.post(`${API}/api/lyrics/generate`, {
      data: { projectId: 'fake-project-xyz', prompt: 'test', stylePreset: 'hinglish-urban' },
    });
    expect(res.status()).toBe(404);
  });

  test('GET /api/lyrics/:id → 404 for nonexistent', async ({ request }) => {
    const res = await request.get(`${API}/api/lyrics/nonexistent-lyrics-id`);
    expect(res.status()).toBe(404);
  });

  test('GET /api/projects/:id/lyrics returns array', async ({ request }) => {
    const proj = await createProject(request);
    const res = await request.get(`${API}/api/projects/${proj.id}/lyrics`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
    await deleteProject(request, proj.id);
  });
});

// ─── Music endpoints (spec §4.3) ───────────────────────────────────────────

test.describe('Music API — spec §4.3', () => {
  test('GET /api/music/settings returns audio options', async ({ request }) => {
    const res = await request.get(`${API}/api/music/settings`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.data?.models).toBeTruthy();
    expect(data.data?.bitrates).toBeTruthy();
    expect(data.data?.sampleRates).toBeTruthy();
    expect(data.data?.formats).toBeTruthy();
  });

  test('GET /api/music/:id → 404 for nonexistent', async ({ request }) => {
    const res = await request.get(`${API}/api/music/nonexistent-music-id`);
    expect(res.status()).toBe(404);
  });

  test('POST /api/music/generate → 400 with invalid model', async ({ request }) => {
    const proj = await createProject(request);
    const res = await request.post(`${API}/api/music/generate`, {
      data: { projectId: proj.id, model: 'invalid-model', prompt: 'test' },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid model');
    await deleteProject(request, proj.id);
  });

  test('POST /api/music/generate → 404 with nonexistent projectId', async ({ request }) => {
    const res = await request.post(`${API}/api/music/generate`, {
      data: { projectId: 'fake-xyz', model: 'music-2.6', prompt: 'test' },
    });
    expect(res.status()).toBe(404);
  });

  test('GET /api/projects/:id/music returns array', async ({ request }) => {
    const proj = await createProject(request);
    const res = await request.get(`${API}/api/projects/${proj.id}/music`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
    await deleteProject(request, proj.id);
  });

  test('GET /api/music/:id/file → 404 for nonexistent', async ({ request }) => {
    const res = await request.get(`${API}/api/music/nonexistent-id/file`);
    expect(res.status()).toBe(404);
  });

  test('POST /api/music/:id/convert → 404 for nonexistent music', async ({ request }) => {
    const res = await request.post(`${API}/api/music/nonexistent-id/convert`);
    expect(res.status()).toBe(404);
  });
});

// ─── Video endpoints (spec §4.4) ───────────────────────────────────────────

test.describe('Video API — spec §4.4', () => {
  test('GET /api/video/:id → 404 for nonexistent', async ({ request }) => {
    const res = await request.get(`${API}/api/video/nonexistent-video-id`);
    expect(res.status()).toBe(404);
  });

  test('GET /api/video/poll/:taskId → 404 for nonexistent task', async ({ request }) => {
    const res = await request.get(`${API}/api/video/poll/nonexistent-task-id`);
    expect(res.status()).toBe(404);
  });

  test('POST /api/video/generate → 400 without projectId', async ({ request }) => {
    const res = await request.post(`${API}/api/video/generate`, {
      data: { prompt: 'test video', model: 'MiniMax-Hailuo-2.3' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/video/generate → 404 with nonexistent project', async ({ request }) => {
    const res = await request.post(`${API}/api/video/generate`, {
      data: { projectId: 'fake-xyz', prompt: 'test', model: 'MiniMax-Hailuo-2.3' },
    });
    expect(res.status()).toBe(404);
  });

  test('GET /api/projects/:id/video returns array', async ({ request }) => {
    const proj = await createProject(request);
    const res = await request.get(`${API}/api/projects/${proj.id}/video`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
    await deleteProject(request, proj.id);
  });
});

// ─── Audio processing (spec §2.5 / Phase 2) ────────────────────────────────

test.describe('Audio Processing API — Phase 2 spec §2.5', () => {
  let projectId: string;
  let fileId: string;
  let resolvedFilePath: string;

  test.beforeAll(async ({ request }) => {
    const proj = await createProject(request, 'AUDIO_TEST');
    projectId = proj.id;
    fileId = await uploadAudio(request, projectId);

    // Get the actual filesystem path so we can pass it directly
    const filesRes = await request.get(`${API}/api/mastering/files/${projectId}`);
    const filesData = await filesRes.json();
    const filesList = Array.isArray(filesData) ? filesData : (filesData.files || []);
    const ourFile = filesList.find((f: any) => f.id === fileId);
    resolvedFilePath = ourFile?.originalPath || ourFile?.filePath || ourFile?.path;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await deleteProject(request, projectId);
  });

  test('POST /api/audio/trim processes audio', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/trim`, {
      data: {
        inputPath: resolvedFilePath,
        startSec: 0,
        endSec: 2,
        outputPath: `/tmp/trim_test_${Date.now()}.mp3`,
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.filePath).toBeTruthy();
    expect(data.duration).toBeGreaterThan(0);
  });

  test('POST /api/audio/speed changes tempo', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/speed`, {
      data: {
        inputPath: resolvedFilePath,
        tempoFactor: 1.5,
        outputPath: `/tmp/speed_test_${Date.now()}.mp3`,
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.filePath).toBeTruthy();
  });

  test('POST /api/audio/volume adjusts volume', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/volume`, {
      data: {
        inputPath: resolvedFilePath,
        gain: 0.8,
        outputPath: `/tmp/vol_test_${Date.now()}.mp3`,
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/audio/fade-in adds fade', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/fade-in`, {
      data: {
        inputPath: resolvedFilePath,
        durationSec: 1.0,
        outputPath: `/tmp/fadein_test_${Date.now()}.mp3`,
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/audio/fade-out adds fade', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/fade-out`, {
      data: {
        inputPath: resolvedFilePath,
        durationSec: 1.0,
        outputPath: `/tmp/fadeout_test_${Date.now()}.mp3`,
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/audio/reverse reverses audio', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/reverse`, {
      data: {
        inputPath: resolvedFilePath,
        outputPath: `/tmp/rev_test_${Date.now()}.mp3`,
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/audio/normalize normalizes audio', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/normalize`, {
      data: {
        inputPath: resolvedFilePath,
        outputPath: `/tmp/norm_test_${Date.now()}.mp3`,
        targetLUFS: -14,
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/audio/reverb applies reverb', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/reverb`, {
      data: {
        inputPath: resolvedFilePath,
        outputPath: `/tmp/reverb_test_${Date.now()}.mp3`,
        roomScale: 50,
        damping: 50,
        wetLevel: 0.3,
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/audio/echo applies echo', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/echo`, {
      data: {
        inputPath: resolvedFilePath,
        outputPath: `/tmp/echo_test_${Date.now()}.mp3`,
        delay: 0.3,
        decay: 0.5,
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/audio/bass-boost boosts bass', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/bass-boost`, {
      data: {
        inputPath: resolvedFilePath,
        outputPath: `/tmp/bass_test_${Date.now()}.mp3`,
        gainDb: 6,
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/audio/pitch-shift shifts pitch', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/pitch-shift`, {
      data: {
        inputPath: resolvedFilePath,
        outputPath: `/tmp/pitch_test_${Date.now()}.mp3`,
        semitones: 2,
      },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/audio/process chains multiple operations', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/process`, {
      data: {
        inputPath: resolvedFilePath,
        outputPath: `/tmp/chain_test_${Date.now()}.mp3`,
        operations: [
          { type: 'trim', startSec: 0, endSec: 3 },
          { type: 'volume', gain: 0.9 },
          { type: 'fadeIn', durationSec: 0.5 },
          { type: 'fadeOut', durationSec: 0.5 },
        ],
        options: { format: 'mp3', bitrate: '320k' },
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.downloadUrl).toBeTruthy();
    expect(data.masteredFile || data.filePath).toBeTruthy();
  });

  test('POST /api/audio/process with normalize + bassBoost + reverb', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/process`, {
      data: {
        inputPath: resolvedFilePath,
        outputPath: `/tmp/effects_test_${Date.now()}.mp3`,
        operations: [
          { type: 'normalize', targetLUFS: -14 },
          { type: 'bassBoost', gainDb: 4 },
          { type: 'reverb', roomScale: 30, damping: 40, wetLevel: 0.2 },
        ],
        options: { format: 'mp3', bitrate: '320k' },
      },
    });
    expect(res.status()).toBe(200);
  });

  test('GET /api/audio/:id/metadata → 404 for bad music ID', async ({ request }) => {
    const res = await request.get(`${API}/api/audio/nonexistent-music-id/metadata`);
    expect(res.status()).toBe(404);
  });

  test('POST /api/audio/trim → 400 without required fields', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/trim`, {
      data: { inputPath: resolvedFilePath },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/audio/speed → 400 with invalid tempoFactor', async ({ request }) => {
    const res = await request.post(`${API}/api/audio/speed`, {
      data: { inputPath: resolvedFilePath, tempoFactor: 0, outputPath: '/tmp/x.mp3' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Medley (spec Phase 2 §2.3) ────────────────────────────────────────────

test.describe('Medley API — Phase 2 spec §2.3', () => {
  let projectId: string;
  let fileId: string;
  let resolvedFilePath: string;

  test.beforeAll(async ({ request }) => {
    const proj = await createProject(request, 'MEDLEY_TEST');
    projectId = proj.id;
    fileId = await uploadAudio(request, projectId);

    const filesRes = await request.get(`${API}/api/mastering/files/${projectId}`);
    const filesData = await filesRes.json();
    const filesList = Array.isArray(filesData) ? filesData : (filesData.files || []);
    const ourFile = filesList.find((f: any) => f.id === fileId);
    resolvedFilePath = ourFile?.originalPath || ourFile?.filePath || ourFile?.path;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await deleteProject(request, projectId);
  });

  test('POST /api/medley creates medley', async ({ request }) => {
    const res = await request.post(`${API}/api/medley`, {
      data: { projectId, name: 'Test Medley' },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();
    expect(data.project_id).toBe(projectId);
    expect(data.name).toBe('Test Medley');
  });

  test('POST /api/medley → 400 without projectId', async ({ request }) => {
    const res = await request.post(`${API}/api/medley`, {
      data: { name: 'No Project' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/medley/:id returns medley with tracks', async ({ request }) => {
    const create = await request.post(`${API}/api/medley`, {
      data: { projectId, name: 'Medley With Tracks' },
    });
    const medley = await create.json();

    await request.post(`${API}/api/medley/${medley.id}/tracks`, {
      data: { sourceFilePath: resolvedFilePath, name: 'track 1' },
    });

    const res = await request.get(`${API}/api/medley/${medley.id}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.tracks).toBeDefined();
    expect(data.tracks.length).toBe(1);
  });

  test('POST /api/medley/:id/tracks adds track', async ({ request }) => {
    const create = await request.post(`${API}/api/medley`, {
      data: { projectId, name: 'Track Test Medley' },
    });
    const medley = await create.json();

    const res = await request.post(`${API}/api/medley/${medley.id}/tracks`, {
      data: { sourceFilePath: resolvedFilePath, name: 'my track', trimStart: 0, trimEnd: 3 },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();
    expect(data.source_file_path).toBe(resolvedFilePath);
  });

  test('POST /api/medley/:id/export exports with real files', async ({ request }) => {
    const create = await request.post(`${API}/api/medley`, {
      data: { projectId, name: 'Export Test Medley' },
    });
    const medley = await create.json();

    await request.post(`${API}/api/medley/${medley.id}/tracks`, {
      data: { sourceFilePath: resolvedFilePath, name: 'track 1', trimStart: 0, trimEnd: 2 },
    });
    await request.post(`${API}/api/medley/${medley.id}/tracks`, {
      data: { sourceFilePath: resolvedFilePath, name: 'track 2', trimStart: 1, trimEnd: 3 },
    });

    const res = await request.post(`${API}/api/medley/${medley.id}/export`, {
      data: { format: 'mp3', bitrate: '320k' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.filePath).toBeTruthy();
    expect(data.duration).toBeGreaterThan(0);
  });

  test('DELETE /api/medley/:id/tracks/:trackId removes track', async ({ request }) => {
    const create = await request.post(`${API}/api/medley`, {
      data: { projectId, name: 'Delete Track Medley' },
    });
    const medley = await create.json();
    const trackRes = await request.post(`${API}/api/medley/${medley.id}/tracks`, {
      data: { sourceFilePath: resolvedFilePath },
    });
    const track = await trackRes.json();

    const del = await request.delete(`${API}/api/medley/${medley.id}/tracks/${track.id}`);
    expect([200, 204]).toContain(del.status());

    const get = await request.get(`${API}/api/medley/${medley.id}`);
    const data = await get.json();
    expect(data.tracks.length).toBe(0);
  });

  test('POST /api/medley/:id/export → 400 with API URL as sourceFilePath', async ({ request }) => {
    const create = await request.post(`${API}/api/medley`, {
      data: { projectId, name: 'Bad URL Medley' },
    });
    const medley = await create.json();

    await request.post(`${API}/api/medley/${medley.id}/tracks`, {
      data: { sourceFilePath: '/api/music/nonexistent-id/file', name: 'bad track' },
    });

    const res = await request.post(`${API}/api/medley/${medley.id}/export`, {
      data: { format: 'mp3' },
    });
    // Should be 4xx (file not found) not 500 (uncaught crash)
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });
});

// ─── Upload API (spec Phase 2 §2.5) ────────────────────────────────────────

test.describe('Upload API — Phase 2 spec §2.5', () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const proj = await createProject(request, 'UPLOAD_TEST');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await deleteProject(request, projectId);
  });

  test('POST /api/mastering/upload/:projectId uploads audio file', async ({ request }) => {
    const fileBytes = fs.readFileSync(FIXTURE_AUDIO);
    const res = await request.post(`${API}/api/mastering/upload/${projectId}`, {
      multipart: {
        files: { name: 'test.mp3', mimeType: 'audio/mpeg', buffer: fileBytes },
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.files).toBeTruthy();
    expect(data.files.length).toBeGreaterThan(0);
    expect(data.files[0].id).toBeTruthy();
  });

  test('GET /api/mastering/files/:projectId lists uploaded files', async ({ request }) => {
    const res = await request.get(`${API}/api/mastering/files/${projectId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    const files = Array.isArray(data) ? data : data.files;
    expect(Array.isArray(files)).toBe(true);
  });

  test('GET /api/upload/supported-formats returns formats', async ({ request }) => {
    const res = await request.get(`${API}/api/upload/supported-formats`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.formats || data.supportedFormats).toBeTruthy();
  });

  test('POST /api/mastering/process processes uploaded file', async ({ request }) => {
    const fileBytes = fs.readFileSync(FIXTURE_AUDIO);
    const uploadRes = await request.post(`${API}/api/mastering/upload/${projectId}`, {
      multipart: {
        files: { name: 'proc-test.mp3', mimeType: 'audio/mpeg', buffer: fileBytes },
      },
    });
    const uploadData = await uploadRes.json();
    const fId = uploadData.files[0].id;

    const res = await request.post(`${API}/api/mastering/process`, {
      data: { fileId: fId, projectId, preset: 'spotify' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    // API returns { results: [{ masteredPath }], errors: [] } for batch-style, or { success, masteredPath } for musicId flow
    const masteredPath = data.masteredPath || data.masteredFile || data.results?.[0]?.masteredPath;
    expect(masteredPath).toBeTruthy();
  });

  test('POST /api/mastering/save-to-music saves mastered file to music list', async ({ request }) => {
    const fileBytes = fs.readFileSync(FIXTURE_AUDIO);
    const uploadRes = await request.post(`${API}/api/mastering/upload/${projectId}`, {
      multipart: {
        files: { name: 'save-test.mp3', mimeType: 'audio/mpeg', buffer: fileBytes },
      },
    });
    const uploadData = await uploadRes.json();
    const fId = uploadData.files[0].id;

    // Must process (master) before saving to music list
    await request.post(`${API}/api/mastering/process`, {
      data: { fileId: fId, projectId, preset: 'spotify' },
    });

    const saveRes = await request.post(`${API}/api/mastering/save-to-music`, {
      data: { projectId, fileIds: [fId] },
    });
    expect(saveRes.status()).toBe(200);
    const saveData = await saveRes.json();
    // API returns { saved: [{ fileId, musicId, version }] }
    expect(saveData.saved?.[0]?.musicId || saveData.music?.id || saveData.id).toBeTruthy();

    // Verify it appears in music list
    const musicRes = await request.get(`${API}/api/projects/${projectId}/music`);
    const musicList = await musicRes.json();
    expect(musicList.length).toBeGreaterThan(0);
  });
});

// ─── History API (spec §4.6) ───────────────────────────────────────────────

test.describe('History API — spec §4.6', () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const proj = await createProject(request, 'HISTORY_TEST');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await deleteProject(request, projectId);
  });

  test('GET /api/history/:projectId returns history object', async ({ request }) => {
    const res = await request.get(`${API}/api/history/${projectId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.lyrics).toBeDefined();
    expect(data.music).toBeDefined();
    expect(data.video).toBeDefined();
    expect(data.chains).toBeDefined();
    expect(Array.isArray(data.lyrics)).toBe(true);
    expect(Array.isArray(data.music)).toBe(true);
    expect(Array.isArray(data.video)).toBe(true);
  });

  test('GET /api/projects/:id/history alias works', async ({ request }) => {
    const res = await request.get(`${API}/api/projects/${projectId}/history`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.lyrics).toBeDefined();
  });

  test('GET /api/history/:id → 404 for nonexistent project', async ({ request }) => {
    const res = await request.get(`${API}/api/history/nonexistent-project-xyz`);
    expect(res.status()).toBe(404);
  });

  test('GET /api/history/chain/:id → 404 for nonexistent chain', async ({ request }) => {
    const res = await request.get(`${API}/api/history/chain/nonexistent-id`);
    expect(res.status()).toBe(404);
  });

  test('POST /api/history/compare → 400 without required fields', async ({ request }) => {
    const res = await request.post(`${API}/api/history/compare`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('DELETE /api/history/:id → 404 for nonexistent (no type param needed)', async ({ request }) => {
    const res = await request.delete(`${API}/api/history/nonexistent-generation-id`);
    expect(res.status()).toBe(404);
  });

  test('GET /api/history/export/:projectId returns zip', async ({ request }) => {
    const res = await request.get(`${API}/api/history/export/${projectId}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('zip');
  });
});

// ─── Viral Toolkit (spec §4.7) ─────────────────────────────────────────────

test.describe('Viral Toolkit API — spec §4.7', () => {
  test('GET /api/viral/trends returns trending topics', async ({ request }) => {
    const res = await request.get(`${API}/api/viral/trends`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    const trends = data.trends || data.data || data;
    expect(Array.isArray(trends) ? trends.length > 0 : !!trends).toBe(true);
  });

  test('GET /api/viral/templates returns song structures', async ({ request }) => {
    const res = await request.get(`${API}/api/viral/templates`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    const templates = data.templates || data.data || data;
    expect(Array.isArray(templates) ? templates.length > 0 : !!templates).toBe(true);
  });

  test('POST /api/viral/analyze-hook → 400 without lyrics', async ({ request }) => {
    const res = await request.post(`${API}/api/viral/analyze-hook`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/viral/analyze-hook scores lyrics quality', async ({ request }) => {
    const res = await request.post(`${API}/api/viral/analyze-hook`, {
      data: { lyrics: '[Verse]\nTest lyrics content\n[Chorus]\nTest hook repeating\nTest hook repeating' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    const score = data.hookScore ?? data.score ?? data.data?.score;
    expect(score !== undefined).toBe(true);
  });

  test('POST /api/viral/analyze-reference → 400 without URL', async ({ request }) => {
    const res = await request.post(`${API}/api/viral/analyze-reference`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Jobs API (spec §4.8) ──────────────────────────────────────────────────

test.describe('Jobs API — spec §4.8', () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const proj = await createProject(request, 'JOBS_TEST');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await deleteProject(request, projectId);
  });

  test('GET /api/jobs/:id → 404 for nonexistent', async ({ request }) => {
    const res = await request.get(`${API}/api/jobs/nonexistent-job-id`);
    expect(res.status()).toBe(404);
  });

  test('GET /api/projects/:id/jobs returns array', async ({ request }) => {
    const res = await request.get(`${API}/api/projects/${projectId}/jobs`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('GET /api/jobs/project/:projectId returns array (spec route)', async ({ request }) => {
    const res = await request.get(`${API}/api/jobs/project/${projectId}`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('POST /api/jobs/:id/cancel → 404 for nonexistent job', async ({ request }) => {
    const res = await request.post(`${API}/api/jobs/nonexistent-job/cancel`);
    expect(res.status()).toBe(404);
  });
});

// ─── Settings API (implemented) ────────────────────────────────────────────

test.describe('Settings API', () => {
  test('GET /api/settings returns all settings', async ({ request }) => {
    const res = await request.get(`${API}/api/settings`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.data?.default_workflow_mode).toBeTruthy();
    expect(data.data?.auto_ffmpeg_320kbps).toBeTruthy();
    expect(data.data?.default_music_model).toBeTruthy();
    expect(data.data?.default_video_model).toBeTruthy();
  });

  test('GET /api/settings/:key returns single setting', async ({ request }) => {
    const res = await request.get(`${API}/api/settings/default_music_model`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.data?.value).toBeTruthy();
  });

  test('GET /api/settings/:key → 404 for unknown key', async ({ request }) => {
    const res = await request.get(`${API}/api/settings/unknown_key_xyz`);
    expect(res.status()).toBe(404);
  });

  test('PATCH /api/settings updates settings', async ({ request }) => {
    const res = await request.patch(`${API}/api/settings`, {
      data: { default_workflow_mode: 'manual' },
    });
    expect(res.status()).toBe(200);
    // Restore
    await request.patch(`${API}/api/settings`, {
      data: { default_workflow_mode: 'hybrid' },
    });
  });

  test('PATCH /api/settings → 400 for unknown key', async ({ request }) => {
    const res = await request.patch(`${API}/api/settings`, {
      data: { unknown_key_xyz: 'value' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Mastering ZIP download ─────────────────────────────────────────────────

test.describe('Mastering ZIP download', () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const proj = await createProject(request, 'ZIP_TEST');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await deleteProject(request, projectId);
  });

  test('GET /api/mastering/zip returns ZIP with mastered files', async ({ request }) => {
    // Upload and process a file first
    const fileBytes = fs.readFileSync(FIXTURE_AUDIO);
    const upload1 = await request.post(`${API}/api/mastering/upload/${projectId}`, {
      multipart: { files: { name: 'zip1.mp3', mimeType: 'audio/mpeg', buffer: fileBytes } },
    });
    const f1 = (await upload1.json()).files[0].id;

    await request.post(`${API}/api/mastering/process`, {
      data: { fileId: f1, projectId, preset: 'spotify' },
    });

    const res = await request.get(`${API}/api/mastering/zip?projectId=${projectId}&fileIds=${f1}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('zip');
  });
});
