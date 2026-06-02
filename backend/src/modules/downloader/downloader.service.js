import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import logger from '../../utils/logger.js';

// YouTube blocks datacenter IPs (Railway) unless authenticated. If YT_DLP_COOKIES
// is set (a Netscape-format cookies.txt export of a logged-in YouTube session),
// write it to a temp file so yt-dlp can pass --cookies. Returns the path or null.
function getCookiesFile() {
  // Prefer base64 (single-line, safe for env vars); fall back to raw text.
  const b64 = process.env.YT_DLP_COOKIES_B64;
  const raw = process.env.YT_DLP_COOKIES;
  let content = null;
  if (b64 && b64.trim()) {
    try { content = Buffer.from(b64.trim(), 'base64').toString('utf8'); } catch { /* bad b64 */ }
  } else if (raw && raw.trim()) {
    content = raw.replace(/\\n/g, '\n');
  }
  if (!content) return null;
  try {
    const p = path.join(os.tmpdir(), 'yt-cookies.txt');
    fs.writeFileSync(p, content, { mode: 0o600 });
    return p;
  } catch { return null; }
}

export const DownloaderService = {
  isAvailable() {
    try {
      execSync('yt-dlp --version', { stdio: 'ignore', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Search YouTube via yt-dlp (no API key needed). Returns lightweight metadata
   * for each result. Reuses our cookies/PO-token setup so it works on cloud IPs.
   */
  search(query, limit = 20) {
    return new Promise((resolve, reject) => {
      const q = String(query || '').trim();
      if (!q) return resolve([]);
      const cookiesFile = getCookiesFile();
      const args = [
        '--flat-playlist',
        '--dump-json',
        '--no-warnings',
        '--ignore-errors',
        ...(cookiesFile ? ['--cookies', cookiesFile] : []),
        '--extractor-args', 'youtube:player_client=web_safari,android',
        `ytsearch${Math.min(40, Math.max(1, limit))}:${q}`,
      ];
      const proc = spawn('yt-dlp', args);
      let out = '';
      let err = '';
      proc.stdout.on('data', d => { out += d.toString(); });
      proc.stderr.on('data', d => { err += d.toString(); });
      proc.on('close', () => {
        const results = [];
        for (const line of out.split('\n')) {
          const s = line.trim();
          if (!s) continue;
          try {
            const e = JSON.parse(s);
            if (!e.id) continue;
            const thumbs = Array.isArray(e.thumbnails) ? e.thumbnails : [];
            results.push({
              id: e.id,
              title: e.title || 'Untitled',
              channel: e.channel || e.uploader || '',
              duration: e.duration || 0,
              thumbnail: thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
              url: `https://www.youtube.com/watch?v=${e.id}`,
            });
          } catch { /* skip non-JSON line */ }
        }
        if (results.length === 0 && err) logger.warn('yt-dlp search empty', { stderr: err.slice(-200) });
        resolve(results);
      });
      proc.on('error', e => reject(new Error(`yt-dlp search error: ${e.message}`)));
    });
  },

  /**
   * Download audio from YouTube URL as MP3, save to outputDir.
   * Resilient: tries multiple extraction strategies in order (PO-token client,
   * then alternate player clients, then cookies) until one succeeds — so a single
   * blocked client never fails the whole download. Returns { filePath, title, duration }.
   */
  async download(url, outputDir, { onProgress } = {}) {
    fs.mkdirSync(outputDir, { recursive: true });
    const cookiesFile = getCookiesFile();

    // Ordered fallback strategies. The bgutil PO-token plugin (when running)
    // auto-applies to all of them; clients are tried so we survive it being down.
    const strategies = [
      { client: 'web_safari', cookies: false },
      { client: 'android',    cookies: false },
      { client: 'tv_embedded', cookies: false },
      { client: 'ios',        cookies: false },
      { client: 'mweb,web',   cookies: false },
      ...(cookiesFile ? [{ client: 'web_safari', cookies: true }, { client: 'android', cookies: true }] : []),
    ];

    let lastErr = null;
    for (let i = 0; i < strategies.length; i++) {
      const s = strategies[i];
      try {
        const result = await this._runYtDlp(url, outputDir, s, cookiesFile, onProgress);
        if (i > 0) logger.info('yt-dlp succeeded on fallback', { strategy: s, attempt: i + 1 });
        return result;
      } catch (e) {
        lastErr = e;
        logger.warn('yt-dlp strategy failed, trying next', { client: s.client, cookies: s.cookies, error: String(e.message).slice(-160) });
        // Clean any partial files before the next attempt.
        try { fs.readdirSync(outputDir).filter(f => f.endsWith('.part') || f.endsWith('.ytdl')).forEach(f => fs.unlinkSync(path.join(outputDir, f))); } catch { /* ignore */ }
      }
    }
    throw new Error(`All download strategies failed: ${lastErr ? String(lastErr.message).slice(-240) : 'unknown'}`);
  },

  _runYtDlp(url, outputDir, strategy, cookiesFile, onProgress) {
    return new Promise((resolve, reject) => {
      const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');
      const args = [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--print-json',
        '--no-playlist',
        '--concurrent-fragments', '4',
        '--socket-timeout', '30',
        '--retries', '3',
        '--no-check-certificates',
        '--force-overwrites',
        ...(strategy.cookies && cookiesFile ? ['--cookies', cookiesFile] : []),
        '--extractor-args', `youtube:player_client=${strategy.client}`,
        '--age-limit', '99',
        '-o', outputTemplate,
        url,
      ];

      const proc = spawn('yt-dlp', args);
      let jsonOutput = '';
      let stderr = '';
      proc.stdout.on('data', d => { jsonOutput += d.toString(); });
      proc.stderr.on('data', d => {
        stderr += d.toString();
        const m = stderr.match(/\[download\]\s+([\d.]+)%/);
        if (m) onProgress?.(Math.min(85, parseFloat(m[1])), `Downloading ${m[1]}%`);
      });
      proc.on('close', code => {
        if (code !== 0) {
          // Full stderr to server logs for diagnosis (plugin loading, POT, etc.)
          logger.error('yt-dlp failed', { client: strategy.client, cookies: strategy.cookies, stderr: stderr.slice(-2000) });
          return reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-300)}`));
        }
        try {
          const lines = jsonOutput.trim().split('\n').filter(Boolean);
          const info = JSON.parse(lines[lines.length - 1]);
          const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.mp3'));
          if (!files.length) return reject(new Error('Downloaded MP3 not found'));
          resolve({ filePath: path.join(outputDir, files[0]), title: info.title || 'Unknown', duration: info.duration || 0 });
        } catch (e) {
          reject(new Error(`Failed to parse yt-dlp output: ${e.message}`));
        }
      });
      proc.on('error', err => reject(new Error(`yt-dlp process error: ${err.message}`)));
    });
  },
};
