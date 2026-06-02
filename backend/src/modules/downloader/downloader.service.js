import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import logger from '../../utils/logger.js';

// YouTube blocks datacenter IPs unless authenticated. A throwaway-account cookie
// is configured ONCE on the server (DB setting `yt_dlp_cookies_b64`, or env) and
// used for ALL downloads — no per-user setup. Writes it to a temp cookies.txt and
// returns the path (cached), or null if none configured.
let _cookieCache = { content: null, path: null };
async function getCookiesFile() {
  let content = null;
  // 1) DB (owner-set via Settings — survives restarts, no redeploy to refresh).
  try {
    const { SettingsModel } = await import('../../database/models/settings.model.js');
    const row = await SettingsModel.get('yt_dlp_cookies_b64');
    if (row?.value && row.value.trim()) {
      try { content = Buffer.from(row.value.trim(), 'base64').toString('utf8'); } catch { /* bad b64 */ }
    }
  } catch { /* settings unavailable */ }
  // 2) Env fallback.
  if (!content) {
    const b64 = process.env.YT_DLP_COOKIES_B64;
    const raw = process.env.YT_DLP_COOKIES;
    if (b64 && b64.trim()) { try { content = Buffer.from(b64.trim(), 'base64').toString('utf8'); } catch { /* */ } }
    else if (raw && raw.trim()) content = raw.replace(/\\n/g, '\n');
  }
  if (!content) return null;
  if (_cookieCache.content === content && _cookieCache.path && fs.existsSync(_cookieCache.path)) return _cookieCache.path;
  try {
    const p = path.join(os.tmpdir(), 'yt-cookies.txt');
    fs.writeFileSync(p, content, { mode: 0o600 });
    _cookieCache = { content, path: p };
    return p;
  } catch { return null; }
}

export async function hasCookies() {
  return !!(await getCookiesFile());
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
   * Instant search suggestions (YouTube's public autocomplete — fast, no key).
   * Returns up to 10 query strings for type-ahead.
   */
  async suggest(query) {
    const q = String(query || '').trim();
    if (!q) return [];
    try {
      const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(2500),
      });
      const data = await res.json(); // ["query", ["s1","s2",...]]
      return Array.isArray(data?.[1]) ? data[1].slice(0, 10) : [];
    } catch { return []; }
  },

  /**
   * Search YouTube via yt-dlp (no API key needed). Returns lightweight metadata
   * for each result. Reuses our cookies/PO-token setup so it works on cloud IPs.
   */
  async search(query, limit = 20) {
    const q = String(query || '').trim();
    if (!q) return [];
    const cookiesFile = await getCookiesFile();
    return new Promise((resolve, reject) => {
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
    const cookiesFile = await getCookiesFile();

    // Ordered fallback strategies. The bgutil PO-token plugin (when running)
    // auto-applies to all of them; clients are tried so we survive it being down.
    // Cookie-authenticated strategies FIRST (reliable bypass of bot-check/429).
    // android needs no JS challenge + authenticated = most robust. No-cookie
    // clients remain as fallback for when no cookie is configured.
    // Note: ios/android clients don't support cookies in yt-dlp — only web* do.
    const strategies = [
      ...(cookiesFile ? [
        { client: 'web',        cookies: true },
        { client: 'web_safari', cookies: true },
        { client: 'mweb',       cookies: true },
      ] : []),
      { client: 'android',    cookies: false },
      { client: 'web',        cookies: false },
      { client: 'web_safari', cookies: false },
      { client: 'ios',        cookies: false },
      { client: 'mweb',       cookies: false },
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
        // Enable the EJS (deno) challenge solver so web clients can solve YouTube's
        // signature / n-challenge — required now, else only images are returned.
        '--remote-components', 'ejs:github',
        // Be gentle to avoid IP rate-limiting (429) on shared/datacenter IPs.
        '--sleep-requests', '1',
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
