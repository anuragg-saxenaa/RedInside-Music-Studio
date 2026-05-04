import { test } from 'node:test';
import assert from 'node:assert';
import { LyricsService } from '../../src/modules/lyrics/lyrics.service.js';
import { ProjectModel } from '../../src/database/models/project.model.js';

test('should generate lyrics', async () => {
  const project = ProjectModel.create({ name: 'Test Project' });
  const lyricsService = new LyricsService();

  // This will call actual MiniMax API - skip in CI
  if (process.env.CI) return;

  const result = await lyricsService.generateLyrics({
    projectId: project.id,
    prompt: 'Viral desi rap about Mumbai streets',
    stylePreset: 'hinglish-urban',
  });

  assert.ok(result.id);
  assert.ok(result.content);
  assert.strictEqual(result.version, 1);

  // Cleanup
  ProjectModel.delete(project.id);
});
