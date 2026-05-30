import { test } from 'node:test';
import assert from 'node:assert';
import { LyricsService } from '../../src/modules/lyrics/lyrics.service.js';
import { ProjectModel } from '../../src/database/models/project.model.js';

test('should generate lyrics', async () => {
  const project = await ProjectModel.create({ name: 'Test Project' });
  const lyricsService = new LyricsService();

  // This will call actual MiniMax API - skip in CI
  if (process.env.CI) {
    await ProjectModel.delete(project.id);
    return;
  }

  const result = await lyricsService.generateLyrics({
    projectId: project.id,
    prompt: 'Viral desi rap about Mumbai streets',
    stylePreset: 'hinglish-urban',
  });

  assert.ok(result.id);
  assert.ok(result.content);
  assert.strictEqual(result.version, 1);

  // Cleanup
  await ProjectModel.delete(project.id);
});
