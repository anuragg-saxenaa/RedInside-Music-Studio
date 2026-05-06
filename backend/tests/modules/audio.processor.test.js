import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { AudioProcessor } from '../../src/modules/audio/audio.processor.js';
import { AudioService } from '../../src/modules/audio/audio.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures');
const testAudioPath = path.join(fixturesDir, 'test-audio.mp3');
const outputDir = path.join(fixturesDir, 'output');

// Ensure output directory exists
async function ensureOutputDir() {
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (err) {
    // Already exists
  }
}

// Clean up test output files
async function cleanupOutput() {
  try {
    const files = await fs.readdir(outputDir);
    for (const file of files) {
      await fs.unlink(path.join(outputDir, file));
    }
  } catch (err) {
    // Directory doesn't exist
  }
}

before(async () => {
  // Skip in CI environment
  if (process.env.CI) {
    throw new Error('Skipping audio processor tests in CI');
  }

  // Verify test audio exists
  try {
    await fs.access(testAudioPath);
  } catch {
    throw new Error(`Test audio fixture not found at ${testAudioPath}`);
  }

  await ensureOutputDir();
});

beforeEach(async () => {
  await cleanupOutput();
});

after(async () => {
  await cleanupOutput();
});

test('AudioProcessor - constructor validates input', () => {
  assert.throws(() => new AudioProcessor(), /Input path is required/);
  assert.throws(() => new AudioProcessor(123), /Input path is required/);
  assert.throws(() => new AudioProcessor(''), /Input path is required/);
});

test('AudioProcessor - trim validation', () => {
  const processor = new AudioProcessor(testAudioPath);
  assert.throws(() => processor.trim(-1, 10), /startSec must be a non-negative/);
  assert.throws(() => processor.trim(10, 5), /endSec must be a number greater than startSec/);
  assert.throws(() => processor.trim(10, 10), /endSec must be a number greater than startSec/);
});

test('AudioProcessor - speed validation', () => {
  const processor = new AudioProcessor(testAudioPath);
  assert.throws(() => processor.speed(0), /tempoFactor must be a number between/);
  assert.throws(() => processor.speed(-1), /tempoFactor must be a number between/);
  assert.throws(() => processor.speed(11), /tempoFactor must be a number between/);
});

test('AudioProcessor - volume validation', () => {
  const processor = new AudioProcessor(testAudioPath);
  assert.throws(() => processor.volume(0), /gain must be a number between/);
  assert.throws(() => processor.volume(-1), /gain must be a number between/);
  assert.throws(() => processor.volume(101), /gain must be a number between/);
});

test('AudioProcessor - fadeIn validation', () => {
  const processor = new AudioProcessor(testAudioPath);
  assert.throws(() => processor.fadeIn(0), /durationSec must be a positive/);
  assert.throws(() => processor.fadeIn(-5), /durationSec must be a positive/);
});

test('AudioProcessor - fadeOut validation', () => {
  const processor = new AudioProcessor(testAudioPath);
  assert.throws(() => processor.fadeOut(0), /durationSec must be a positive/);
  assert.throws(() => processor.fadeOut(-5), /durationSec must be a positive/);
});

test('AudioProcessor - methods are chainable', () => {
  const processor = new AudioProcessor(testAudioPath)
    .trim(10, 30)
    .speed(1.5)
    .volume(0.8)
    .fadeIn(3)
    .fadeOut(5)
    .reverse();

  assert.ok(processor instanceof AudioProcessor);
});

test('AudioProcessor - export validates format', async () => {
  const processor = new AudioProcessor(testAudioPath).trim(0, 10);
  const outputPath = path.join(outputDir, 'test.mp3');

  await assert.rejects(
    async () => processor.export(outputPath, { format: 'invalid' }),
    /Invalid format/
  );
});

test('AudioProcessor - getMetadata returns correct duration', async () => {
  const processor = new AudioProcessor(testAudioPath);
  const metadata = await processor.getMetadata();

  // Test audio is 60 seconds
  assert.ok(metadata.duration >= 59 && metadata.duration <= 61,
    `Expected ~60 seconds, got ${metadata.duration}`);
  assert.ok(metadata.bitrate > 0);
  assert.ok(metadata.sampleRate > 0);
  assert.strictEqual(metadata.format, 'mp3');
});

test('AudioProcessor - trim creates shorter audio', async () => {
  const processor = new AudioProcessor(testAudioPath);
  const originalMetadata = await processor.getMetadata();
  const outputPath = path.join(outputDir, 'trimmed.mp3');

  const result = await processor
    .trim(10, 30)
    .export(outputPath, { format: 'mp3' });

  assert.ok(result.filePath === outputPath);
  assert.ok(result.duration > 0);

  // Verify output file exists
  await fs.access(outputPath);

  // Get output duration
  const outputProcessor = new AudioProcessor(outputPath);
  const outputMetadata = await outputProcessor.getMetadata();

  // Should be approximately 20 seconds (30 - 10)
  assert.ok(
    outputMetadata.duration >= 19 && outputMetadata.duration <= 21,
    `Expected ~20 seconds, got ${outputMetadata.duration}`
  );

  // Original should still be 60 seconds
  const originalCheck = await new AudioProcessor(testAudioPath).getMetadata();
  assert.ok(
    originalCheck.duration >= 59 && originalCheck.duration <= 61,
    `Original should still be ~60 seconds, got ${originalCheck.duration}`
  );
});

test('AudioProcessor - speed operation executes', async () => {
  const outputPath = path.join(outputDir, 'faster.mp3');

  // Speed operation executes without error
  const result = await new AudioProcessor(testAudioPath)
    .trim(0, 10)
    .speed(2.0)
    .export(outputPath);

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);

  // Verify output is a valid audio file
  const outputMetadata = await new AudioProcessor(outputPath).getMetadata();
  assert.ok(outputMetadata.duration > 0, 'Output should have duration');
  assert.ok(outputMetadata.format === 'mp3');
});

test('AudioProcessor - volume adjustment works', async () => {
  const outputPath = path.join(outputDir, 'volume.mp3');

  // We can't easily verify volume change without analyzing audio,
  // but we can verify the command succeeds and file is created
  const result = await new AudioProcessor(testAudioPath)
    .trim(0, 5)
    .volume(2.0)
    .export(outputPath);

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);
});

test('AudioProcessor - fadeIn works', async () => {
  const outputPath = path.join(outputDir, 'fadein.mp3');

  const result = await new AudioProcessor(testAudioPath)
    .trim(0, 10)
    .fadeIn(3)
    .export(outputPath);

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);

  const outputMetadata = await new AudioProcessor(outputPath).getMetadata();
  assert.ok(
    outputMetadata.duration >= 9 && outputMetadata.duration <= 11,
    `Expected ~10 seconds, got ${outputMetadata.duration}`
  );
});

test('AudioProcessor - fadeOut works', async () => {
  const outputPath = path.join(outputDir, 'fadeout.mp3');

  const result = await new AudioProcessor(testAudioPath)
    .trim(0, 10)
    .fadeOut(3)
    .export(outputPath);

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);

  const outputMetadata = await new AudioProcessor(outputPath).getMetadata();
  assert.ok(
    outputMetadata.duration >= 9 && outputMetadata.duration <= 11,
    `Expected ~10 seconds, got ${outputMetadata.duration}`
  );
});

test('AudioProcessor - reverse works', async () => {
  const outputPath = path.join(outputDir, 'reversed.mp3');

  const result = await new AudioProcessor(testAudioPath)
    .trim(0, 5)
    .reverse()
    .export(outputPath);

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);

  // Duration should be preserved
  const outputMetadata = await new AudioProcessor(outputPath).getMetadata();
  assert.ok(
    outputMetadata.duration >= 4 && outputMetadata.duration <= 6,
    `Expected ~5 seconds, got ${outputMetadata.duration}`
  );
});

test('AudioProcessor - complex chain works', async () => {
  const outputPath = path.join(outputDir, 'complex.mp3');

  const result = await new AudioProcessor(testAudioPath)
    .trim(10, 40)
    .volume(0.8)
    .speed(1.5)
    .fadeIn(2)
    .fadeOut(3)
    .export(outputPath);

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);

  // Verify output is valid audio
  const outputMetadata = await new AudioProcessor(outputPath).getMetadata();
  assert.ok(outputMetadata.duration > 0, 'Output should have valid duration');
  assert.ok(outputMetadata.format === 'mp3');
});

test('AudioProcessor - WAV format export', async () => {
  const outputPath = path.join(outputDir, 'exported.wav');

  const result = await new AudioProcessor(testAudioPath)
    .trim(0, 10)
    .export(outputPath, { format: 'wav' });

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);

  const outputMetadata = await new AudioProcessor(outputPath).getMetadata();
  assert.ok(outputMetadata.format.includes('wav'));
});

test('AudioProcessor - slow tempo (0.5x) executes', async () => {
  const outputPath = path.join(outputDir, 'slow.mp3');

  const result = await new AudioProcessor(testAudioPath)
    .trim(0, 10)
    .speed(0.5)
    .export(outputPath);

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);

  // Verify output is a valid audio file
  const outputMetadata = await new AudioProcessor(outputPath).getMetadata();
  assert.ok(outputMetadata.duration > 0, 'Output should have duration');
  assert.ok(outputMetadata.format === 'mp3');
});

test('AudioService - processAudio with operations array', async () => {
  const outputPath = path.join(outputDir, 'service-test.mp3');

  const audioService = new AudioService();
  const operations = [
    { type: 'trim', startSec: 15, endSec: 35 },
    { type: 'volume', gain: 1.5 },
    { type: 'fadeIn', durationSec: 2 },
  ];

  const result = await audioService.processAudio(
    testAudioPath,
    operations,
    outputPath
  );

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);

  const outputMetadata = await audioService.getMetadata(outputPath);
  // 35 - 15 = 20 seconds
  assert.ok(
    outputMetadata.duration >= 19 && outputMetadata.duration <= 21,
    `Expected ~20 seconds, got ${outputMetadata.duration}`
  );
});

test('AudioService - trimAudio helper', async () => {
  const outputPath = path.join(outputDir, 'service-trim.mp3');

  const audioService = new AudioService();
  const result = await audioService.trimAudio(
    testAudioPath,
    5,
    25,
    outputPath
  );

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);

  const outputMetadata = await audioService.getMetadata(outputPath);
  assert.ok(
    outputMetadata.duration >= 19 && outputMetadata.duration <= 21,
    `Expected ~20 seconds, got ${outputMetadata.duration}`
  );
});

test('AudioService - changeSpeed helper', async () => {
  const outputPath = path.join(outputDir, 'service-speed.mp3');

  const audioService = new AudioService();
  const result = await audioService.changeSpeed(
    testAudioPath,
    0.75,
    outputPath
  );

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);
});

test('AudioService - adjustVolume helper', async () => {
  const outputPath = path.join(outputDir, 'service-volume.mp3');

  const audioService = new AudioService();
  const result = await audioService.adjustVolume(
    testAudioPath,
    0.5,
    outputPath
  );

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);
});

test('AudioService - fadeIn helper', async () => {
  const outputPath = path.join(outputDir, 'service-fadein.mp3');

  const audioService = new AudioService();
  const result = await audioService.fadeIn(
    testAudioPath,
    5,
    outputPath
  );

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);
});

test('AudioService - fadeOut helper', async () => {
  const outputPath = path.join(outputDir, 'service-fadeout.mp3');

  const audioService = new AudioService();
  const result = await audioService.fadeOut(
    testAudioPath,
    5,
    outputPath
  );

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);
});

test('AudioService - reverseAudio helper', async () => {
  const outputPath = path.join(outputDir, 'service-reverse.mp3');

  const audioService = new AudioService();
  const result = await audioService.reverseAudio(
    testAudioPath,
    outputPath
  );

  assert.ok(result.filePath === outputPath);
  await fs.access(outputPath);
});

test('AudioService - getMetadata works', async () => {
  const audioService = new AudioService();
  const metadata = await audioService.getMetadata(testAudioPath);

  assert.ok(metadata.duration >= 59 && metadata.duration <= 61);
  assert.ok(metadata.bitrate > 0);
  assert.ok(metadata.format === 'mp3');
  assert.ok(metadata.sampleRate === 44100);
});
