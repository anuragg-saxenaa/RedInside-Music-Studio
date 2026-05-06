import { test } from 'node:test';
import assert from 'node:assert';
import { LyricsService } from '../../src/modules/lyrics/lyrics.service.js';
import { ProjectModel } from '../../src/database/models/project.model.js';
import { LyricsModel } from '../../src/database/models/lyrics.model.js';

test('should edit lyrics and create new version', async () => {
  const project = ProjectModel.create({ name: 'Test Project' });
  const lyricsService = new LyricsService();

  // This will call actual MiniMax API - skip in CI
  if (process.env.CI) return;

  // Generate initial lyrics
  const initial = await lyricsService.generateLyrics({
    projectId: project.id,
    prompt: 'Viral desi rap about Mumbai streets',
    stylePreset: 'hinglish-urban',
  });

  assert.ok(initial.id);
  assert.ok(initial.content);
  assert.strictEqual(initial.version, 1);
  assert.strictEqual(initial.mode, 'write_full_song');

  // Edit the lyrics
  const edited = await lyricsService.editLyrics(initial.id, {
    prompt: 'Make the hook more catchy',
    stylePreset: 'hinglish-urban',
  });

  assert.ok(edited.id);
  assert.ok(edited.content);
  assert.strictEqual(edited.version, 2);
  assert.strictEqual(edited.mode, 'edit');

  // Verify the original lyrics is still version 1
  const original = LyricsModel.findById(initial.id);
  assert.strictEqual(original.version, 1);

  // Verify all versions are accessible
  const versions = await lyricsService.getLyricsVersions(initial.id);
  assert.strictEqual(versions.length, 2);
  assert.ok(versions.find(v => v.version === 1));
  assert.ok(versions.find(v => v.version === 2));

  // Test diff
  const diff = await lyricsService.getLyricsDiff(initial.id, 1);
  assert.ok(diff.current);
  assert.ok(diff.target);
  assert.ok(diff.diff);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should get lyrics versions', async () => {
  const project = ProjectModel.create({ name: 'Test Project' });
  const lyricsService = new LyricsService();

  // This will call actual MiniMax API - skip in CI
  if (process.env.CI) return;

  // Generate initial lyrics
  const initial = await lyricsService.generateLyrics({
    projectId: project.id,
    prompt: 'Desi hip hop song',
    stylePreset: 'punjabi-swagger',
  });

  assert.ok(initial.id);

  // Get versions
  const versions = await lyricsService.getLyricsVersions(initial.id);
  assert.ok(Array.isArray(versions));
  assert.strictEqual(versions.length, 1);
  assert.strictEqual(versions[0].version, 1);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should get lyrics diff', async () => {
  const project = ProjectModel.create({ name: 'Test Project' });
  const lyricsService = new LyricsService();

  // This will call actual MiniMax API - skip in CI
  if (process.env.CI) return;

  // Generate initial lyrics
  const initial = await lyricsService.generateLyrics({
    projectId: project.id,
    prompt: 'Desi rap about Delhi',
    stylePreset: 'hinglish-urban',
  });

  assert.ok(initial.id);

  // Get diff with same version
  const diff = await lyricsService.getLyricsDiff(initial.id, 1);
  assert.ok(diff.current);
  assert.ok(diff.target);
  assert.ok(diff.diff);
  assert.strictEqual(diff.diff.title, false);
  assert.strictEqual(diff.diff.content, false);
  assert.strictEqual(diff.diff.stylePreset, false);

  // Cleanup
  ProjectModel.delete(project.id);
});