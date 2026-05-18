import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger.js';

export const VocalRemovalService = {
  _engine: null,

  async detectEngine() {
    if (this._engine) return this._engine;
    try {
      execSync('python3 -m demucs --help', { stdio: 'ignore', timeout: 5000 });
      this._engine = 'demucs';
    } catch {
      this._engine = 'ffmpeg';
    }
    logger.info('VocalRemovalService engine detected', { engine: this._engine });
    return this._engine;
  },

  async removeVocals(inputPath, outputDir, { onProgress } = {}) {
    const engine = await this.detectEngine();
    fs.mkdirSync(outputDir, { recursive: true });
    if (engine === 'demucs') {
      return this._runDemucs(inputPath, outputDir, onProgress);
    }
    return this._runFfmpeg(inputPath, outputDir, onProgress);
  },

  _runDemucs(inputPath, outputDir, onProgress) {
    return new Promise((resolve, reject) => {
      onProgress?.(10, 'Starting Demucs...');
      const proc = spawn('python3', [
        '-m', 'demucs',
        '--two-stems=vocals',
        '-o', outputDir,
        inputPath,
      ]);

      let stderr = '';
      proc.stderr.on('data', d => {
        stderr += d.toString();
        if (stderr.includes('Separating')) onProgress?.(40, 'Separating stems...');
        if (stderr.includes('vocals.wav')) onProgress?.(80, 'Finalising stems...');
      });

      proc.on('close', code => {
        if (code !== 0) return reject(new Error(`Demucs exited ${code}: ${stderr.slice(-200)}`));
        const basename = path.basename(inputPath, path.extname(inputPath));
        const htDir = path.join(outputDir, 'htdemucs', basename);
        const instrumentalPath = path.join(htDir, 'no_vocals.wav');
        const vocalPath = path.join(htDir, 'vocals.wav');
        if (!fs.existsSync(instrumentalPath)) {
          return reject(new Error(`Demucs output not found at ${instrumentalPath}`));
        }
        onProgress?.(100, 'Done');
        resolve({ instrumentalPath, vocalPath: fs.existsSync(vocalPath) ? vocalPath : null, engine: 'demucs' });
      });
    });
  },

  _runFfmpeg(inputPath, outputDir, onProgress) {
    return new Promise((resolve, reject) => {
      onProgress?.(20, 'Applying center-channel subtraction...');
      const outFile = path.join(outputDir, `instrumental_${Date.now()}.mp3`);
      const proc = spawn('ffmpeg', [
        '-i', inputPath,
        '-af', 'pan=stereo|c0=c0-c1|c1=c1-c0',
        '-q:a', '0',
        outFile,
        '-y',
      ]);
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code !== 0) return reject(new Error(`FFmpeg vocal removal exited ${code}: ${stderr.slice(-200)}`));
        onProgress?.(100, 'Done');
        resolve({ instrumentalPath: outFile, vocalPath: null, engine: 'ffmpeg' });
      });
    });
  },
};
