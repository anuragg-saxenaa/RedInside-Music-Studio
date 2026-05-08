import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

export class AudioMasteringService {
  constructor(storageDir) {
    this.storageDir = storageDir;
  }

  // Spotify loudness standard: I=-14:TP=-1:LRA=11
  async masterToSpotify(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters('loudnorm=I=-14:TP=-1:LRA=11')
        .audioCodec('pcm_s16le') // WAV format
        .output(outputPath)
        .on('end', () => resolve({ outputPath }))
        .on('error', reject)
        .run();
    });
  }

  async analyzeLoudness(inputPath) {
    return new Promise((resolve, reject) => {
      let stderrOutput = '';
      ffmpeg(inputPath)
        .audioFilters('loudnorm=I=-14:TP=-1:LRA=11:print_format=json')
        .outputOptions(['-f', 'null'])
        .output(process.platform === 'win32' ? 'NUL' : '/dev/null')
        .on('stderr', (data) => {
          stderrOutput += data;
        })
        .on('end', () => {
          // Parse JSON from stderr output
          const jsonMatch = stderrOutput.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
          if (jsonMatch) {
            try {
              const report = JSON.parse(jsonMatch[0]);
              resolve(report);
            } catch {
              resolve({});
            }
          } else {
            resolve({});
          }
        })
        .on('error', reject)
        .run();
    });
  }
}