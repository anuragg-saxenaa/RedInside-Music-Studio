import { test } from 'node:test';
import assert from 'node:assert';
import { HistoryService } from '../../src/modules/history/history.service.js';
import { HistoryModel } from '../../src/modules/history/history.model.js';
import { ProjectModel } from '../../src/database/models/project.model.js';
import { LyricsModel } from '../../src/database/models/lyrics.model.js';
import { MusicModel } from '../../src/database/models/music.model.js';

const historyService = new HistoryService();

test('should create generation chain', () => {
  const project = ProjectModel.create({ name: 'Test History Project' });

  const chain = HistoryModel.create({
    projectId: project.id,
  });

  assert.ok(chain.id);
  assert.strictEqual(chain.project_id, project.id);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should get project history with no generations', async () => {
  const project = ProjectModel.create({ name: 'Empty History Project' });

  const history = await historyService.getProjectHistory(project.id);

  assert.ok(Array.isArray(history.lyrics));
  assert.ok(Array.isArray(history.music));
  assert.ok(Array.isArray(history.video));
  assert.ok(Array.isArray(history.chains));

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should get project history with generations', async () => {
  const project = ProjectModel.create({ name: 'History with Generations' });

  // Create a chain and add some generations
  const chain = HistoryModel.create({
    projectId: project.id,
  });

  // Create lyrics
  const lyrics = LyricsModel.create({
    projectId: project.id,
    version: 1,
    content: 'Test lyrics content',
    title: 'Test Song',
    prompt: 'Test prompt',
    stylePreset: 'hinglish-urban',
  });

  // Update chain with lyrics
  HistoryModel.update(chain.id, { lyricsId: lyrics.id });

  const history = await historyService.getProjectHistory(project.id);

  assert.ok(Array.isArray(history.lyrics));
  assert.strictEqual(history.lyrics.length, 1);
  assert.strictEqual(history.lyrics[0].id, lyrics.id);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should get version chain by lyrics ID', async () => {
  const project = ProjectModel.create({ name: 'Version Chain Test' });

  const chain = HistoryModel.create({
    projectId: project.id,
  });

  const lyrics = LyricsModel.create({
    projectId: project.id,
    version: 1,
    content: 'Chain lyrics',
    title: 'Chained Song',
  });

  HistoryModel.update(chain.id, { lyricsId: lyrics.id });

  const result = await historyService.getVersionChain(lyrics.id);

  assert.ok(result.chain);
  assert.strictEqual(result.chain.id, chain.id);
  assert.ok(result.lyrics);
  assert.strictEqual(result.lyrics.id, lyrics.id);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should throw error for non-existent generation in getVersionChain', async () => {
  await assert.rejects(
    async () => {
      await historyService.getVersionChain('non-existent-id');
    },
    { message: /not found/i }
  );
});

test('should replay lyrics version', async () => {
  const project = ProjectModel.create({ name: 'Replay Test' });

  const lyrics = LyricsModel.create({
    projectId: project.id,
    version: 1,
    content: 'Original lyrics',
    title: 'Original Title',
    prompt: 'Original prompt',
    stylePreset: 'hinglish-urban',
    mode: 'write_full_song',
  });

  const result = await historyService.replayVersion(lyrics.id, 'lyrics');

  assert.ok(result.generation);
  assert.strictEqual(result.type, 'lyrics');
  assert.strictEqual(result.nextVersion, 2); // Next version after v1
  assert.ok(result.regenerationParams);
  assert.strictEqual(result.regenerationParams.projectId, project.id);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should throw error for invalid type in replayVersion', async () => {
  const project = ProjectModel.create({ name: 'Invalid Replay Type' });

  const lyrics = LyricsModel.create({
    projectId: project.id,
    version: 1,
    content: 'Test',
    title: 'Test',
  });

  await assert.rejects(
    async () => {
      await historyService.replayVersion(lyrics.id, 'invalid');
    },
    { message: /Invalid type/i }
  );

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should compare two lyrics versions', async () => {
  const project = ProjectModel.create({ name: 'Compare Versions Test' });

  const lyrics1 = LyricsModel.create({
    projectId: project.id,
    version: 1,
    content: 'Original content',
    title: 'Version 1',
    stylePreset: 'hinglish-urban',
  });

  const lyrics2 = LyricsModel.create({
    projectId: project.id,
    version: 2,
    content: 'Updated content',
    title: 'Version 2',
    stylePreset: 'hinglish-urban',
  });

  const comparison = await historyService.compareVersions(lyrics1.id, lyrics2.id, 'lyrics');

  assert.strictEqual(comparison.type, 'lyrics');
  assert.ok(comparison.versions);
  assert.ok(comparison.differences);
  assert.ok(comparison.contentDiff);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should throw error for non-existent versions in compareVersions', async () => {
  await assert.rejects(
    async () => {
      await historyService.compareVersions('id1', 'id2', 'lyrics');
    },
    { message: /not found/i }
  );
});

test('should delete version (soft delete)', async () => {
  const project = ProjectModel.create({ name: 'Delete Version Test' });

  const lyrics = LyricsModel.create({
    projectId: project.id,
    version: 1,
    content: 'To be deleted',
    title: 'Delete Me',
  });

  const chain = HistoryModel.create({
    projectId: project.id,
    lyricsId: lyrics.id,
  });

  const result = await historyService.deleteVersion(lyrics.id, 'lyrics');

  assert.ok(result.success);
  assert.strictEqual(result.generationId, lyrics.id);
  assert.strictEqual(result.type, 'lyrics');

  // Verify chain was updated (lyrics_id set to null)
  const updatedChain = HistoryModel.findById(chain.id);
  assert.strictEqual(updatedChain.lyrics_id, null);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should link generation to chain', async () => {
  const project = ProjectModel.create({ name: 'Link Generation Test' });

  const chain = HistoryModel.create({
    projectId: project.id,
  });

  const lyrics = LyricsModel.create({
    projectId: project.id,
    version: 1,
    content: 'Linked lyrics',
    title: 'Link Test',
  });

  const result = await historyService.linkGeneration(project.id, {
    type: 'lyrics',
    id: lyrics.id,
  });

  assert.ok(result);
  assert.strictEqual(result.lyrics_id, lyrics.id);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should create new chain when linking first generation', async () => {
  const project = ProjectModel.create({ name: 'New Chain Test' });

  const lyrics = LyricsModel.create({
    projectId: project.id,
    version: 1,
    content: 'First generation',
    title: 'First',
  });

  // No existing chain, should create new one
  const result = await historyService.linkGeneration(project.id, {
    type: 'lyrics',
    id: lyrics.id,
  });

  assert.ok(result);
  assert.ok(result.id);

  // Cleanup
  ProjectModel.delete(project.id);
});

test('should get project generations grouped by type', async () => {
  const project = ProjectModel.create({ name: 'Grouped Generations Test' });

  // Create multiple generations of each type
  const lyrics1 = LyricsModel.create({
    projectId: project.id,
    version: 1,
    content: 'Lyrics v1',
    title: 'L1',
  });

  const lyrics2 = LyricsModel.create({
    projectId: project.id,
    version: 2,
    content: 'Lyrics v2',
    title: 'L2',
  });

  const music1 = MusicModel.create({
    projectId: project.id,
    version: 1,
    model: 'music-2.6',
  });

  const history = await historyService.getProjectHistory(project.id);

  assert.strictEqual(history.lyrics.length, 2);
  assert.strictEqual(history.music.length, 1);
  assert.strictEqual(history.video.length, 0);

  // Cleanup
  ProjectModel.delete(project.id);
});