import { test, before, after, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../src/config/env.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
// Use actual storage path from config
const STORAGE_DIR = config.storage.path;

// Helper to check network availability
async function isNetworkAvailable() {
  try {
    const { default: axios } = await import('axios');
    await axios.get('https://www.google.com', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

describe('Upload E2E Tests', () => {
  const testProjectId = 'test-project-upload';
  let uploadService;
  let networkAvailable;

  before(async () => {
    networkAvailable = await isNetworkAvailable();

    // Import service once for all tests
    const module = await import('../../src/modules/upload/upload.service.js');
    uploadService = module.default;

    // Clean up any leftover test directories
    const testDirs = ['test-project-upload', 'test-project-new', 'test-project-url'];
    for (const dir of testDirs) {
      const projectDir = path.join(STORAGE_DIR, 'projects', dir);
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    }
  });

  after(async () => {
    // Final cleanup
    const testDirs = ['test-project-upload', 'test-project-new', 'test-project-url'];
    for (const dir of testDirs) {
      const projectDir = path.join(STORAGE_DIR, 'projects', dir);
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    }
  });

  describe('UploadService', () => {
    test('should be importable', async () => {
      assert.ok(uploadService);
    });

    test('should validate supported formats', async () => {
      assert.strictEqual(uploadService.isValidFormat('mp3'), true);
      assert.strictEqual(uploadService.isValidFormat('wav'), true);
      assert.strictEqual(uploadService.isValidFormat('flac'), true);
      assert.strictEqual(uploadService.isValidFormat('ogg'), true);
      assert.strictEqual(uploadService.isValidFormat('m4a'), true);
      assert.strictEqual(uploadService.isValidFormat('pdf'), false);
      assert.strictEqual(uploadService.isValidFormat('exe'), false);
    });

    test('should validate file size - 50MB limit', async () => {
      assert.strictEqual(uploadService.isValidSize(1024 * 1024), true);
      assert.strictEqual(uploadService.isValidSize(50 * 1024 * 1024), true);
      assert.strictEqual(uploadService.isValidSize(50 * 1024 * 1024 + 1), false);
      assert.strictEqual(uploadService.isValidSize(100 * 1024 * 1024), false);
    });

    test('should handle MIME type to extension mapping', async () => {
      assert.strictEqual(uploadService.getExtensionFromMimeType('audio/mpeg'), 'mp3');
      assert.strictEqual(uploadService.getExtensionFromMimeType('audio/wav'), 'wav');
      assert.strictEqual(uploadService.getExtensionFromMimeType('audio/flac'), 'flac');
      assert.strictEqual(uploadService.getExtensionFromMimeType('audio/ogg'), 'ogg');
      assert.strictEqual(uploadService.getExtensionFromMimeType('audio/mp4'), 'm4a');
      assert.strictEqual(uploadService.getExtensionFromMimeType('audio/x-m4a'), 'm4a');
    });

    test('should upload real file from disk', async () => {
      const testFilePath = path.join(FIXTURES_DIR, 'test-audio.mp3');
      assert.ok(fs.existsSync(testFilePath), 'Test file should exist');

      const fileBuffer = fs.readFileSync(testFilePath);
      const file = {
        originalname: 'test-audio.mp3',
        buffer: fileBuffer,
        size: fileBuffer.length,
      };

      const result = await uploadService.uploadFile(file, testProjectId);

      assert.ok(result.id, 'Should have an id');
      assert.ok(result.filePath, 'Should have filePath');
      assert.strictEqual(result.originalName, 'test-audio.mp3');
      assert.strictEqual(result.format, 'mp3');
      assert.ok(result.size > 0, 'Should have size > 0');

      // Verify file exists on disk
      assert.ok(fs.existsSync(result.filePath), 'Uploaded file should exist on disk');

      // Verify file content matches
      const savedBuffer = fs.readFileSync(result.filePath);
      assert.deepStrictEqual(savedBuffer, fileBuffer, 'File content should match');

      // Cleanup
      fs.unlinkSync(result.filePath);
    });

    test('should create audio directory for project', async () => {
      const testProjectId2 = 'test-project-new';
      const audioDir = path.join(STORAGE_DIR, 'projects', testProjectId2, 'audio');

      // Ensure clean state
      if (fs.existsSync(audioDir)) {
        fs.rmSync(audioDir, { recursive: true, force: true });
      }
      // Also ensure parent is clean
      const parentDir = path.join(STORAGE_DIR, 'projects', testProjectId2);
      if (fs.existsSync(parentDir)) {
        fs.rmSync(parentDir, { recursive: true, force: true });
      }

      // Upload will create the directory
      const testFilePath = path.join(FIXTURES_DIR, 'test-audio.mp3');
      const fileBuffer = fs.readFileSync(testFilePath);
      const file = {
        originalname: 'test-audio.mp3',
        buffer: fileBuffer,
        size: fileBuffer.length,
      };

      await uploadService.uploadFile(file, testProjectId2);

      // Verify directory was created
      assert.ok(fs.existsSync(audioDir), 'Audio directory should be created');
    });

    test('should reject invalid format', async () => {
      const file = {
        originalname: 'evil.exe',
        buffer: Buffer.from('fake content'),
        size: 12,
      };

      await assert.rejects(
        async () => uploadService.uploadFile(file, testProjectId),
        { message: /Unsupported format/ }
      );
    });

    test('should reject files without extension', async () => {
      const file = {
        originalname: 'noextension',
        buffer: Buffer.from('fake content'),
        size: 12,
      };

      await assert.rejects(
        async () => uploadService.uploadFile(file, testProjectId),
        { message: /must have an extension/ }
      );
    });

    test('should reject oversized files', async () => {
      const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024, 0);
      const file = {
        originalname: 'huge.mp3',
        buffer: oversizedBuffer,
        size: oversizedBuffer.length,
      };

      await assert.rejects(
        async () => uploadService.uploadFile(file, testProjectId),
        { message: /File too large/ }
      );
    });

    test('should reject invalid projectId (path traversal)', async () => {
      const file = {
        originalname: 'test.mp3',
        buffer: Buffer.from('content'),
        size: 7,
      };

      await assert.rejects(
        async () => uploadService.uploadFile(file, '../../../etc/passwd'),
        { message: /invalid characters/ }
      );

      await assert.rejects(
        async () => uploadService.uploadFile(file, '..\\windows\\system32'),
        { message: /invalid characters/ }
      );
    });

    test('should fetch from a real URL', { skip: !networkAvailable }, async () => {
      if (!networkAvailable) {
        return;
      }

      // Use a small public domain audio file
      const testUrl = 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav';

      const result = await uploadService.fetchFromUrl(testUrl, 'test-project-url');

      assert.ok(result.id, 'Should have an id');
      assert.ok(result.filePath, 'Should have filePath');
      assert.strictEqual(result.format, 'wav');
      assert.ok(result.size > 0, 'Should have size > 0');

      assert.ok(fs.existsSync(result.filePath), 'Downloaded file should exist on disk');

      // Cleanup
      fs.unlinkSync(result.filePath);
    });

    test('should reject invalid URL', async () => {
      await assert.rejects(
        async () => uploadService.fetchFromUrl('not-a-url', testProjectId),
        { message: /Invalid URL format/ }
      );

      await assert.rejects(
        async () => uploadService.fetchFromUrl('', testProjectId),
        { message: /URL is required/ }
      );
    });

    test('should return max file size', async () => {
      const maxSize = uploadService.getMaxSize();
      assert.strictEqual(maxSize, 50 * 1024 * 1024);
    });
  });

  describe('UploadController', () => {
    let uploadController;

    test('should be importable', async () => {
      const { UploadController } = await import('../../src/modules/upload/upload.controller.js');
      assert.ok(UploadController);
      uploadController = UploadController;
    });

    test('should have required methods', async () => {
      assert.ok(typeof uploadController.uploadAudio === 'function');
      assert.ok(typeof uploadController.uploadFromUrl === 'function');
      assert.ok(typeof uploadController.getSupportedFormats === 'function');
    });

    test('should return supported formats info', async () => {
      let capturedData;
      const mockReq = {};
      const mockRes = {
        json: (data) => { capturedData = data; },
      };

      uploadController.getSupportedFormats(mockReq, mockRes);

      assert.deepStrictEqual(capturedData.formats, ['mp3', 'wav', 'flac', 'ogg', 'm4a']);
      assert.strictEqual(capturedData.maxSize, 50 * 1024 * 1024);
      assert.strictEqual(capturedData.maxSizeMB, 50);
    });
  });
});