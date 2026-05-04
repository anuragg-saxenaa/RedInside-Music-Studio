// backend/tests/utils/storage.util.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import storage from '../../src/utils/storage.util.js';
import fs from 'fs';

test('should create project directory structure', () => {
  const projectId = 'test-project-123';
  storage.createProjectDirs(projectId);

  assert.ok(fs.existsSync(storage.getProjectDir(projectId)));
  assert.ok(fs.existsSync(storage.getLyricsDir(projectId)));
  assert.ok(fs.existsSync(storage.getMusicDir(projectId)));

  // Cleanup
  fs.rmSync(storage.getProjectDir(projectId), { recursive: true });
});

test('should generate file paths', () => {
  const projectId = 'proj-1';
  const lyricsPath = storage.getLyricsFilePath(projectId, 1);
  assert.ok(lyricsPath.includes('proj-1'));
  assert.ok(lyricsPath.includes('v1.json'));
});
