import { execSync } from 'child_process';
import { MusicModel } from '../../database/models/music.model.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database/connection.js';
import os from 'os';

const PRESETS = {
  tiktok: { duration: 60, label: 'TikTok 60s' },
  reels:  { duration: 30, label: 'Instagram Reels 30s' },
  shorts: { duration: 60, label: 'YouTube Shorts 60s' },
  full:   { duration: null, label: 'Full Track' },
};

export const SocialExportController = {
  async export(req, res, next) {
    try {
      const { musicId, preset = 'full', startSec = 0 } = req.body;
      if (!musicId) return res.status(400).json({ error: 'musicId is required' });
      if (!PRESETS[preset]) return res.status(400).json({ error: `preset must be one of: ${Object.keys(PRESETS).join(', ')}` });

      const music = MusicModel.findById(musicId);
      if (!music) return res.status(404).json({ error: 'Music not found' });

      const inputPath = music.processed_file_path || music.original_file_path;
      if (!inputPath || !fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Audio file not found' });
      }

      const { duration } = PRESETS[preset];
      const outputId = uuidv4();
      const tempDir = os.tmpdir();
      const outputPath = path.join(tempDir, `${outputId}_${preset}.mp3`);

      let ffmpegCmd;
      if (duration) {
        ffmpegCmd = `ffmpeg -y -i "${inputPath}" -ss ${startSec} -t ${duration} -acodec libmp3lame -b:a 320k "${outputPath}"`;
      } else {
        ffmpegCmd = `ffmpeg -y -i "${inputPath}" -acodec libmp3lame -b:a 320k "${outputPath}"`;
      }

      execSync(ffmpegCmd, { stdio: 'pipe' });

      db.prepare(
        `INSERT INTO social_exports (id, music_id, preset, output_path) VALUES (?, ?, ?, ?)`
      ).run(uuidv4(), musicId, preset, outputPath);

      const stat = fs.statSync(outputPath);
      const filename = `${(music.title || 'track').replace(/[^a-zA-Z0-9-_]/g, '_')}_${preset}.mp3`;

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(outputPath).pipe(res).on('finish', () => {
        fs.unlink(outputPath, () => {});
      });
    } catch (e) { next(e); }
  },
};
