#!/usr/bin/env node
/**
 * RedInside YouTube download worker.
 *
 * Runs on a machine with a RESIDENTIAL IP (your Mac / desktop) where yt-dlp is
 * not blocked by YouTube. Polls the cloud job queue, downloads each requested
 * track locally, and uploads the audio back — so iOS/web just enqueue a job and
 * the song syncs in. No datacenter-IP block, no proxy, no cookies.
 *
 * Usage:  API_BASE=... DESKTOP_TOKEN=... node youtube-worker.mjs
 * Defaults target the production backend.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const API_BASE = process.env.API_BASE || 'https://redinside-music-studio-production.up.railway.app';
const TOKEN = process.env.DESKTOP_TOKEN || '5aae34f9855442a8a3e3fce79c820d15918666fbf471dfff';
const POLL_MS = Number(process.env.POLL_MS || 4000);
const HDR = { 'X-Desktop-Token': TOKEN, 'Content-Type': 'application/json' };

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function ytDownload(url, id) {
  return new Promise((resolve, reject) => {
    const outTpl = path.join(os.tmpdir(), `ris-${id}.%(ext)s`);
    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '--no-playlist', '--print-json', '--no-warnings',
      '--no-part', '-o', outTpl, url,
    ];
    const p = spawn('yt-dlp', args);
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('close', code => {
      if (code !== 0) return reject(new Error(err.slice(-300) || `yt-dlp exit ${code}`));
      try {
        const info = JSON.parse(out.trim().split('\n').filter(Boolean).pop());
        // find the produced file
        const dir = os.tmpdir();
        const file = fs.readdirSync(dir).map(f => path.join(dir, f)).find(f => path.basename(f).startsWith(`ris-${id}.`));
        if (!file) return reject(new Error('output file not found'));
        resolve({ file, title: info.title || 'YouTube import', duration: info.duration || 0, ext: path.extname(file).slice(1) || 'm4a' });
      } catch (e) { reject(new Error('parse failed: ' + e.message)); }
    });
    p.on('error', e => reject(e));
  });
}

async function processJob(job) {
  log('▶ job', job.id, job.url);
  try {
    const { file, title, duration, ext } = await ytDownload(job.url, job.id);
    const audioBase64 = fs.readFileSync(file).toString('base64');
    fs.rmSync(file, { force: true });
    const r = await fetch(`${API_BASE}/api/youtube/jobs/${job.id}/result`, {
      method: 'POST', headers: HDR,
      body: JSON.stringify({ audioBase64, title, duration, ext }),
    });
    const data = await r.json();
    if (r.ok) log('✓ done', job.id, '→', title, `(musicId ${data.musicId})`);
    else log('✗ upload failed', job.id, data.error);
  } catch (e) {
    log('✗ failed', job.id, e.message);
    await fetch(`${API_BASE}/api/youtube/jobs/${job.id}/result`, { method: 'POST', headers: HDR, body: JSON.stringify({ error: e.message }) }).catch(() => {});
  }
}

async function loop() {
  try {
    const r = await fetch(`${API_BASE}/api/youtube/jobs/next`, { headers: HDR });
    if (r.ok) { const { job } = await r.json(); if (job) await processJob(job); }
  } catch (e) { /* network blip — keep polling */ }
  setTimeout(loop, POLL_MS);
}

log(`RedInside worker started → ${API_BASE} (polling ${POLL_MS}ms)`);
loop();
