import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

export class AudioMasteringService {
  constructor(storageDir) {
    this.storageDir = storageDir;
  }

  // Spotify loudness standard: I=-14:TP=-1:LRA=11. Output 320kbps MP3 — a mastered
  // WAV is 50MB+ which stalls the R2 upload and is impractical to stream; 320k MP3
  // is ~5MB, transparent quality, uploads in ~1s.
  async masterToSpotify(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters('loudnorm=I=-14:TP=-1:LRA=11')
        .audioCodec('libmp3lame')
        .audioBitrate('320k')
        .format('mp3')
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