#!/bin/bash
# cloud-init: install docker + bgutil + tail the worker. Runs once at first boot.
set -e
apt-get update
apt-get install -y python3-pip ffmpeg curl ca-certificates nodejs npm

# yt-dlp
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# bgutil PO-token sidecar
docker run -d --name bgutil --restart=always -p 4416:4416 brainicism/bgutil-ytdlp-pot-provider

# Inline-copy the worker (no GitHub dep — repo may be private). Same source as the
# Mac daemon. The hardened yt-dlp args below add the bgutil PO-token provider so
# the OCI IP gets a meaningful warm window before YouTube re-flags it.
mkdir -p /opt/ris
cat > /opt/ris/worker.mjs <<'WORKER_EOF'
#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const API_BASE = process.env.API_BASE || 'https://redinside-music-studio-production.up.railway.app';
const TOKEN = process.env.DESKTOP_TOKEN || '5aae34f9855442a8a3e3fce79c820d15918666fbf471dfff';
const POLL_MS = Number(process.env.POLL_MS || 4000);
const POT_URL = process.env.POT_URL || 'http://127.0.0.1:4416';
const HDR = { 'X-Desktop-Token': TOKEN, 'Content-Type': 'application/json' };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function ytDownload(url, id) {
  return new Promise((resolve, reject) => {
    const outTpl = path.join(os.tmpdir(), `ris-${id}.%(ext)s`);
    // bgutil PO-token sidecar extends the IP's warm window. tv_embedded / web_embedded
    // clients don't require PO tokens — they're the cheapest fallback when bgutil is
    // rate-limited (per yt-dlp PO-Token-Guide).
    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '--no-playlist', '--print-json', '--no-warnings', '--no-part',
      '--extractor-args', 'youtube:player-client=tv,web_embedded,mweb',
      '--extractor-args', `youtubepot-bgutilhttp:base_url=${POT_URL}`,
      '--concurrent-fragments', '4',
      '-o', outTpl, url,
    ];
    const p = spawn('yt-dlp', args);
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('close', code => {
      if (code !== 0) return reject(new Error(err.slice(-300) || `yt-dlp exit ${code}`));
      try {
        const info = JSON.parse(out.trim().split('\n').filter(Boolean).pop());
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
log(`RedInside OCI worker started → ${API_BASE} (polling ${POLL_MS}ms, PO-token at ${POT_URL})`);
loop();
WORKER_EOF
chmod +x /opt/ris/worker.mjs

# systemd unit — auto-restart on crash
cat > /etc/systemd/system/ris-yt-worker.service <<'EOF'
[Unit]
Description=RedInside YouTube worker
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=API_BASE=https://redinside-music-studio-production.up.railway.app
Environment=DESKTOP_TOKEN=5aae34f9855442a8a3e3fce79c820d15918666fbf471dfff
Environment=POLL_MS=4000
ExecStart=/usr/bin/node /opt/ris/worker.mjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# bgutil takes ~10s to come up; delay the worker a touch
sed -i '/^\[Service\]/a ExecStartPre=/bin/sleep 15' /etc/systemd/system/ris-yt-worker.service

systemctl daemon-reload
systemctl enable ris-yt-worker
systemctl start ris-yt-worker

# Tiny health endpoint so UptimeRobot (or any ping) keeps Oracle from reclaiming
# the Always Free instance for being "idle."
cat > /etc/systemd/system/ris-health.service <<'EOF'
[Unit]
Description=RedInside worker health pinger
[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -o /dev/null https://www.youtube.com
EOF
cat > /etc/systemd/system/ris-health.timer <<'EOF'
[Unit]
Description=Ping YouTube every 5 min to keep instance warm
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
EOF
systemctl enable ris-health.timer
