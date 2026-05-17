#!/usr/bin/env node
/**
 * MiniMax API Mock Server
 *
 * Runs on port 8999 (or MOCK_PORT env). Start with:
 *   node backend/tests/minimax-mock-server.js
 *
 * Then start backend with:
 *   MINIMAX_BASE_URL=http://localhost:8999 npm run dev
 *
 * Returns realistic fake responses for all MiniMax endpoints so
 * E2E tests can exercise the full generate flow without burning real API credits.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.MOCK_PORT || '8999', 10);

// Fixture audio file to serve as fake music URL response
const FIXTURE_AUDIO = path.join(__dirname, 'fixtures/test-audio.mp3');
const FIXTURE_MASTERING = path.join(__dirname, 'fixtures/output-mastering/test_spotify_master.wav');

function success(data) {
  return { base_resp: { status_code: 0, status_msg: 'success' }, ...data };
}

function jsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '';
  const qs = Object.fromEntries(new URL(`http://x${req.url}`).searchParams);

  console.log(`[minimax-mock] ${req.method} ${req.url}`);

  // ── Serve mock image (1x1 PNG) for image generation tests ────────────────
  if (url === '/mock-image') {
    // Minimal 1x1 white PNG
    const PNG_1x1 = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
      '2e00000000c4944415408d7636060600000000200015fe37ea0000000049454e44ae426082',
      'hex'
    );
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': PNG_1x1.length });
    res.end(PNG_1x1);
    return;
  }

  // ── Serve file used as "audio URL" in music generation response ───────────
  if (url === '/mock-audio-file') {
    const audioPath = fs.existsSync(FIXTURE_AUDIO) ? FIXTURE_AUDIO : null;
    if (!audioPath) {
      res.writeHead(404); res.end('not found'); return;
    }
    const buf = fs.readFileSync(audioPath);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': buf.length,
      'Accept-Ranges': 'bytes',
    });
    res.end(buf);
    return;
  }

  await jsonBody(req); // consume body

  let body = null;

  // ── POST /v1/lyrics_generation ─────────────────────────────────────────────
  if (url === '/v1/lyrics_generation') {
    body = success({
      song_title: 'Dil Ki Baat (Mock)',
      lyrics: `[verse]\nYeh raat kuch alag hai\nTeri yaad mein khoye hain hum\n\n[chorus]\nTu hi meri duniya hai\nBin tere sab soona hai\n\n[outro]\nHar pal tera intezaar hai`,
      style_tags: 'hinglish, emotional, romantic',
    });
  }

  // ── POST /v1/music_generation ──────────────────────────────────────────────
  else if (url === '/v1/music_generation') {
    body = success({
      data: {
        status: 2, // 2 = complete
        audio: `http://localhost:${PORT}/mock-audio-file`,
        extra_info: { duration: 30 },
      },
    });
  }

  // ── POST /v1/music_cover_preprocess ───────────────────────────────────────
  else if (url === '/v1/music_cover_preprocess') {
    body = success({
      data: { cover_feature_id: `mock_cover_${Date.now()}` },
    });
  }

  // ── POST /v1/video_generation ──────────────────────────────────────────────
  else if (url === '/v1/video_generation') {
    body = success({
      task_id: `mock_video_task_${Date.now()}`,
    });
  }

  // ── GET /v1/query/video_generation ────────────────────────────────────────
  else if (url === '/v1/query/video_generation') {
    body = success({
      status: 'Success',
      file_id: `mock_file_${Date.now()}`,
    });
  }

  // ── GET /v1/files/retrieve ─────────────────────────────────────────────────
  else if (url === '/v1/files/retrieve') {
    body = success({
      file: {
        file_id: qs.file_id || 'mock_file',
        download_url: `http://localhost:${PORT}/mock-audio-file`,
        filename: 'mock_video.mp4',
      },
    });
  }

  // ── POST /v1/files/upload ──────────────────────────────────────────────────
  else if (url === '/v1/files/upload') {
    body = success({
      file: {
        file_id: `mock_upload_${Date.now()}`,
        filename: 'mock_upload',
        bytes: 1000,
      },
    });
  }

  // ── POST /v1/image_generation ─────────────────────────────────────────────
  else if (url === '/v1/image_generation') {
    body = success({
      data: {
        image_urls: [`http://localhost:${PORT}/mock-image`],
      },
    });
  }

  // ── POST /v1/voice_design ─────────────────────────────────────────────────
  else if (url === '/v1/voice_design') {
    body = success({
      voice_id: `mock_voice_${Date.now()}`,
      audio_sample_url: `http://localhost:${PORT}/mock-audio-file`,
    });
  }

  // ── GET /v1/voice/list ────────────────────────────────────────────────────
  else if (url === '/v1/voice/list') {
    body = success({
      voices: [
        { voice_id: 'mock_voice_1', name: 'Mock Hindi Male', gender: 'male', language: 'hi' },
        { voice_id: 'mock_voice_2', name: 'Mock Hindi Female', gender: 'female', language: 'hi' },
      ],
    });
  }

  // ── Unknown endpoint ──────────────────────────────────────────────────────
  else {
    console.log(`[minimax-mock] UNKNOWN endpoint: ${url}`);
    body = success({});
  }

  const json = JSON.stringify(body);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
});

server.listen(PORT, () => {
  console.log(`[minimax-mock] MiniMax mock server running on http://localhost:${PORT}`);
  console.log(`[minimax-mock] Start backend with: MINIMAX_BASE_URL=http://localhost:${PORT} npm run dev`);
});

server.on('error', (err) => {
  console.error('[minimax-mock] Server error:', err.message);
  process.exit(1);
});
