import { test } from 'node:test';
import assert from 'node:assert';
import { VideoService } from '../../src/modules/video/video.service.js';
import { ProjectModel } from '../../src/database/models/project.model.js';
import { MusicModel } from '../../src/database/models/music.model.js';

test('should create video model', async () => {
  const project = await ProjectModel.create({ name: 'Test Video Project' });
  const videoService = new VideoService();

  // Test model validation
  try {
    await videoService.generateVideo({
      projectId: project.id,
      model: 'invalid-model',
    });
    assert.fail('Should have thrown error for invalid model');
  } catch (error) {
    assert.ok(error.message.includes('Invalid model'));
  }

  // Test duration validation
  try {
    await videoService.generateVideo({
      projectId: project.id,
      model: 'MiniMax-Hailuo-2.3',
      duration: 10, // Invalid duration
    });
    assert.fail('Should have thrown error for invalid duration');
  } catch (error) {
    assert.ok(error.message.includes('Duration must be'));
  }

  // Cleanup
  await ProjectModel.delete(project.id);
});

test('should get video by id', async () => {
  const videoService = new VideoService();

  // Non-existent video should return undefined/null
  const result = await videoService.getVideo('non-existent-id');
  assert.ok(result === undefined || result === null);
});

test('should get project videos', async () => {
  const project = await ProjectModel.create({ name: 'Test Project Videos' });
  const videoService = new VideoService();

  // Should return empty array for project with no videos
  const result = await videoService.getProjectVideos(project.id);
  assert.ok(Array.isArray(result));
  assert.strictEqual(result.length, 0);

  // Cleanup
  await ProjectModel.delete(project.id);
});
