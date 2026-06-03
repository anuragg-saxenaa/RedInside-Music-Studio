#!/bin/bash
# RedInside YouTube worker — Mac Mini setup
# Run once: bash setup-macmini-worker.sh
set -e

echo "==> Installing dependencies..."
command -v brew >/dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null || true
brew install node yt-dlp ffmpeg 2>/dev/null || true

echo "==> Writing worker..."
mkdir -p ~/redinside
cat > ~/redinside/youtube-worker.mjs <<'WORKER_EOF'
#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const API_BASE = 'https://redinside-music-studio-production.up.railway.app';
const TOKEN    = '5aae34f9855442a8a3e3fce79c820d15918666fbf471dfff';
const POLL_MS  = 4000;
const HDR      = { 'X-Desktop-Token': TOKEN, 'Content-Type': 'application/json' };
const log      = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

function ytDownload(url, id) {
  return new Promise((resolve, reject) => {
    const outTpl = path.join(os.tmpdir(), `ris-${id}.%(ext)s`);
    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '--no-playlist', '--print-json', '--no-warnings', '--no-part',
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
        const file = fs.readdirSync(os.tmpdir())
          .map(f => path.join(os.tmpdir(), f))
          .find(f => path.basename(f).startsWith(`ris-${id}.`));
        if (!file) return reject(new Error('output file not found'));
        resolve({ file, title: info.title || 'YouTube import', duration: info.duration || 0, ext: path.extname(file).slice(1) || 'm4a' });
      } catch (e) { reject(new Error('parse failed: ' + e.message)); }
    });
    p.on('error', e => reject(e));
  });
}

async function processJob(job) {
  log('▶', job.id, job.url);
  try {
    const { file, title, duration, ext } = await ytDownload(job.url, job.id);
    const audioBase64 = fs.readFileSync(file).toString('base64');
    fs.rmSync(file, { force: true });
    const r = await fetch(`${API_BASE}/api/youtube/jobs/${job.id}/result`, {
      method: 'POST', headers: HDR,
      body: JSON.stringify({ audioBase64, title, duration, ext }),
    });
    const d = await r.json();
    if (r.ok) log('✓', job.id, '→', title, `musicId=${d.musicId}`);
    else log('✗ upload failed', d.error);
  } catch (e) {
    log('✗', job.id, e.message);
    await fetch(`${API_BASE}/api/youtube/jobs/${job.id}/result`, {
      method: 'POST', headers: HDR, body: JSON.stringify({ error: e.message }),
    }).catch(() => {});
  }
}

async function loop() {
  try {
    const r = await fetch(`${API_BASE}/api/youtube/jobs/next`, { headers: HDR });
    if (r.ok) { const { job } = await r.json(); if (job) await processJob(job); }
  } catch { /* network blip */ }
  setTimeout(loop, POLL_MS);
}

log(`RedInside Mac Mini worker started → ${API_BASE}`);
loop();
WORKER_EOF

echo "==> Installing launchd daemon (auto-start on boot)..."
NODE=$(command -v node || echo /opt/homebrew/bin/node)
PLIST=~/Library/LaunchAgents/com.redinside.ytworker.plist
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.redinside.ytworker</string>
  <key>ProgramArguments</key><array>
    <string>${NODE}</string>
    <string>${HOME}/redinside/youtube-worker.mjs</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/ris-ytworker.log</string>
  <key>StandardErrorPath</key><string>/tmp/ris-ytworker.log</string>
</dict></plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo ""
echo "==> Waiting 3 seconds for worker to start..."
sleep 3
echo ""
echo "==> Worker log:"
tail -5 /tmp/ris-ytworker.log

echo ""
echo "==> Status:"
launchctl list | grep redinside && echo "✓ running" || echo "✗ not running — check /tmp/ris-ytworker.log"

echo ""
echo "Done. Worker runs 24/7, auto-restarts on crash, auto-starts on reboot."
echo "Log: tail -f /tmp/ris-ytworker.log"
