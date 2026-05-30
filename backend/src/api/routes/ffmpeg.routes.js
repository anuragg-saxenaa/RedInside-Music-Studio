import ffmpegService from '../../modules/ffmpeg/ffmpeg.service.js';
import { MusicModel } from '../../database/models/music.model.js';
import logger from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';

function tempOut(ext = 'mp3') {
  return `/tmp/ffmpeg_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
}

async function resolveFilePath(source) {
  if (!source) return null;
  const { musicId, inputPath } = source;

  if (musicId) {
    const music = await MusicModel.findById(musicId);
    if (!music) return null;
    const fp = music.processed_file_path || music.original_file_path;
    return fp && fs.existsSync(fp) ? fp : null;
  }

  if (inputPath && fs.existsSync(inputPath)) return inputPath;
  return null;
}

export const FfmpegRoutes = [
  {
    // Spec §4.5: POST /api/ffmpeg/convert-bitrate
    method: 'post',
    path: '/api/ffmpeg/convert-bitrate',
    handler: async (req, res, next) => {
      try {
        const { musicId, inputPath, bitrate = 320, format = 'mp3' } = req.body;

        const resolvedPath = await resolveFilePath({ musicId, inputPath });
        if (!resolvedPath) {
          return res.status(400).json({
            error: 'Could not resolve audio source. Provide musicId or valid inputPath',
          });
        }

        const outputPath = tempOut(format);
        await ffmpegService.processAudio(resolvedPath, outputPath, { bitrate, format });

        if (musicId) {
          await MusicModel.update(musicId, { processedFilePath: outputPath, bitrate: bitrate * 1000 });
        }

        logger.info('Bitrate conversion complete', { outputPath, bitrate });

        res.json({
          message: `Converted to ${bitrate}kbps ${format} successfully`,
          filePath: outputPath,
          downloadUrl: `/api/audio/download/${path.basename(outputPath)}`,
          bitrate,
          format,
        });
      } catch (error) {
        next(error);
      }
    },
  },
  {
    // Spec §4.5: POST /api/ffmpeg/merge
    method: 'post',
    path: '/api/ffmpeg/merge',
    handler: async (req, res, next) => {
      try {
        const { inputs, format = 'mp3', bitrate = 320 } = req.body;

        if (!Array.isArray(inputs) || inputs.length < 2) {
          return res.status(400).json({
            error: 'inputs must be an array of at least 2 sources (each with musicId or inputPath)',
          });
        }

        const resolvedPaths = await Promise.all(inputs.map(resolveFilePath));
        const missing = resolvedPaths.findIndex(p => !p);
        if (missing !== -1) {
          return res.status(400).json({
            error: `Could not resolve input[${missing}] — provide musicId or valid inputPath`,
          });
        }

        const outputPath = tempOut(format);
        const result = await ffmpegService.merge(resolvedPaths, outputPath, { format, bitrate });

        logger.info('Audio merge complete', { count: resolvedPaths.length, outputPath });

        res.json({
          message: `Merged ${resolvedPaths.length} files successfully`,
          filePath: result.filePath,
          downloadUrl: `/api/audio/download/${path.basename(result.filePath)}`,
          format: result.format,
          bitrate: result.bitrate,
        });
      } catch (error) {
        next(error);
      }
    },
  },
];
