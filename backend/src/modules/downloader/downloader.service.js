import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger.js';

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
   * Download audio from YouTube URL as MP3, save to outputDir.
   * Returns { filePath, title, duration }.
   */
  download(url, outputDir, { onProgress } = {}) {
    return new Promise((resolve, reject) => {
      fs.mkdirSync(outputDir, { recursive: true });

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
          return reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-300)}`));
        }
        try {
          const lines = jsonOutput.trim().split('\n').filter(Boolean);
          const info = JSON.parse(lines[lines.length - 1]);
          const title = info.title || 'Unknown';
          const duration = info.duration || 0;

          // yt-dlp --print-json prints before conversion; find the final mp3 file
          const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.mp3'));
          if (!files.length) return reject(new Error('Downloaded MP3 not found in output directory'));
          const filePath = path.join(outputDir, files[0]);
          resolve({ filePath, title, duration });
        } catch (e) {
          reject(new Error(`Failed to parse yt-dlp output: ${e.message}`));
        }
      });

      proc.on('error', err => {
        reject(new Error(`yt-dlp process error: ${err.message}`));
      });
    });
  },
};
