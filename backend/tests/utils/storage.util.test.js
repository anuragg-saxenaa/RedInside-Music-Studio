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

test('should reject path traversal attempts', () => {
  assert.throws(() => storage.getProjectDir('../../../etc'), /invalid characters|path separators/);
  assert.throws(() => storage.getProjectDir('foo/../bar'), /invalid characters|path separators/);
  assert.throws(() => storage.getProjectDir('..'), /invalid characters|path separators/);
});

test('should reject invalid characters in projectId', () => {
  assert.throws(() => storage.getProjectDir('foo/bar'), /invalid characters|path separators/);
  assert.throws(() => storage.getProjectDir('foo\\bar'), /invalid characters|path separators/);
  assert.throws(() => storage.getProjectDir('foo bar'), /invalid characters/);
  assert.throws(() => storage.getProjectDir('foo@bar'), /invalid characters/);
  assert.throws(() => storage.getProjectDir(''), /non-empty string/);
  assert.throws(() => storage.getProjectDir(null), /non-empty string/);
});

test('should validate filename and prevent traversal', () => {
  assert.throws(() => storage.getTempFilePath('valid-project', '../etc/passwd'), /Invalid filename/);
  assert.throws(() => storage.getTempFilePath('valid-project', 'sub/dir/file.txt'), /Invalid filename/);
  assert.throws(() => storage.getTempFilePath('valid-project', '..'), /Invalid filename/);
});

test('should accept valid projectIds', () => {
  const validIds = ['project-1', 'project_2', 'ProjectABC', 'test123'];
  for (const id of validIds) {
    assert.doesNotThrow(() => storage.getProjectDir(id));
  }
});

test('should accept valid filenames', () => {
  const validFiles = ['file.txt', 'audio.mp3', 'data-123.json'];
  for (const file of validFiles) {
    assert.doesNotThrow(() => storage.getTempFilePath('valid-project', file));
  }
});
