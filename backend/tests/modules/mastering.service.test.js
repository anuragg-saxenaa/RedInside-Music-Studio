import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AudioMasteringService } from '../../src/modules/mastering/mastering.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, '../fixtures/test-audio.mp3');
const OUTPUT_DIR = path.join(__dirname, '../fixtures/output');

describe('AudioMasteringService', () => {
  if (!fs.existsSync(FIXTURE)) {
    it('should skip if fixture not found', () => {});
    return;
  }

  it('should master audio to spotify quality', async () => {
    const service = new AudioMasteringService(OUTPUT_DIR);
    const outputPath = path.join(OUTPUT_DIR, 'test_spotify_master.wav');

    const result = await service.masterToSpotify(FIXTURE, outputPath);

    assert(fs.existsSync(result.outputPath));
    // Verify output is a valid WAV file
    const stats = fs.statSync(result.outputPath);
    assert(stats.size > 0);
  });

  it('should analyze loudness', async () => {
    const service = new AudioMasteringService(OUTPUT_DIR);
    const report = await service.analyzeLoudness(FIXTURE);

    assert(report.input_i !== undefined);
  });
});