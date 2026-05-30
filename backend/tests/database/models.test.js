import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProjectModel } from '../../src/database/models/project.model.js';
import { LyricsModel } from '../../src/database/models/lyrics.model.js';
import { MusicModel } from '../../src/database/models/music.model.js';
import db from '../../src/database/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ProjectModel', () => {
  let testProjectId;

  after(async () => {
    if (testProjectId) {
      await ProjectModel.delete(testProjectId);
    }
  });

  it('should validate project name on create', async () => {
    await assert.rejects(
      () => ProjectModel.create({ name: '' }),
      /Project name is required and must be a non-empty string/
    );
    await assert.rejects(
      () => ProjectModel.create({ name: '   ' }),
      /Project name is required and must be a non-empty string/
    );
    await assert.rejects(
      () => ProjectModel.create({}),
      /Project name is required and must be a non-empty string/
    );
  });

  it('should create project with valid data', async () => {
    const project = await ProjectModel.create({ name: 'Test Project' });
    testProjectId = project.id;
    assert.ok(project);
    assert.strictEqual(project.name, 'Test Project');
  });

  it('should validate incrementVersion type parameter', async () => {
    await assert.rejects(
      () => ProjectModel.incrementVersion(testProjectId, 'invalid'),
      /Invalid version type: invalid/
    );
    await assert.rejects(
      () => ProjectModel.incrementVersion(testProjectId, 'SELECT * FROM'),
      /Invalid version type/
    );
  });

  it('should increment version with valid type', async () => {
    const before = await ProjectModel.findById(testProjectId);
    await ProjectModel.incrementVersion(testProjectId, 'lyrics');
    const after = await ProjectModel.findById(testProjectId);
    assert.strictEqual(after.current_lyrics_version, before.current_lyrics_version + 1);
  });

  it('should handle empty update', async () => {
    const before = await ProjectModel.findById(testProjectId);
    const after = await ProjectModel.update(testProjectId, {});
    assert.deepStrictEqual(after, before);
  });

  it('should validate name on update', async () => {
    await assert.rejects(
      () => ProjectModel.update(testProjectId, { name: '' }),
      /Project name must be a non-empty string/
    );
    await assert.rejects(
      () => ProjectModel.update(testProjectId, { name: '   ' }),
      /Project name must be a non-empty string/
    );
  });
});

describe('LyricsModel', () => {
  let testProjectId;
  let testLyricsId;

  before(async () => {
    const project = await ProjectModel.create({ name: 'Test Project for Lyrics' });
    testProjectId = project.id;
  });

  after(async () => {
    if (testProjectId) {
      await ProjectModel.delete(testProjectId);
    }
  });

  it('should validate lyrics content on create', async () => {
    await assert.rejects(
      () => LyricsModel.create({ projectId: testProjectId, content: '' }),
      /Lyrics content is required and must be a non-empty string/
    );
    await assert.rejects(
      () => LyricsModel.create({ projectId: testProjectId }),
      /Lyrics content is required and must be a non-empty string/
    );
  });

  it('should validate project ID on create', async () => {
    await assert.rejects(
      () => LyricsModel.create({ content: 'test lyrics' }),
      /Project ID is required and must be a string/
    );
  });

  it('should create lyrics with valid data', async () => {
    const lyrics = await LyricsModel.create({
      projectId: testProjectId,
      content: 'Test lyrics content',
      version: 1,
      structureTags: { verse: 1, chorus: 2 }
    });
    testLyricsId = lyrics.id;
    assert.ok(lyrics);
    assert.strictEqual(lyrics.content, 'Test lyrics content');
    assert.deepStrictEqual(lyrics.structure_tags, { verse: 1, chorus: 2 });
  });

  it('should handle invalid JSON gracefully on findById', async () => {
    const id = 'test-invalid-json';
    await db.execute({
      sql: `INSERT INTO lyrics_generations (id, project_id, version, content, structure_tags) VALUES (?, ?, ?, ?, ?)`,
      args: [id, testProjectId, 99, 'test', 'invalid json'],
    });

    const result = await LyricsModel.findById(id);
    assert.strictEqual(result.structure_tags, null);

    await db.execute({ sql: 'DELETE FROM lyrics_generations WHERE id = ?', args: [id] });
  });

  it('should handle invalid JSON gracefully on findByProject', async () => {
    const id = 'test-invalid-json-2';
    await db.execute({
      sql: `INSERT INTO lyrics_generations (id, project_id, version, content, structure_tags) VALUES (?, ?, ?, ?, ?)`,
      args: [id, testProjectId, 98, 'test', 'invalid json'],
    });

    const results = await LyricsModel.findByProject(testProjectId);
    const invalidRow = results.find(r => r.id === id);
    assert.strictEqual(invalidRow.structure_tags, null);

    await db.execute({ sql: 'DELETE FROM lyrics_generations WHERE id = ?', args: [id] });
  });
});

describe('MusicModel', () => {
  let testProjectId;
  let testMusicId;

  before(async () => {
    const project = await ProjectModel.create({ name: 'Test Project for Music' });
    testProjectId = project.id;
  });

  after(async () => {
    if (testProjectId) {
      await ProjectModel.delete(testProjectId);
    }
  });

  it('should validate model on create', async () => {
    await assert.rejects(
      () => MusicModel.create({ projectId: testProjectId, model: '' }),
      /Music model is required and must be a non-empty string/
    );
    await assert.rejects(
      () => MusicModel.create({ projectId: testProjectId }),
      /Music model is required and must be a non-empty string/
    );
  });

  it('should validate project ID on create', async () => {
    await assert.rejects(
      () => MusicModel.create({ model: 'music-01' }),
      /Project ID is required and must be a string/
    );
  });

  it('should create music generation with valid data', async () => {
    const music = await MusicModel.create({
      projectId: testProjectId,
      model: 'music-01',
      version: 1,
      audioSettings: { tempo: 120 }
    });
    testMusicId = music.id;
    assert.ok(music);
    assert.strictEqual(music.model, 'music-01');
    assert.deepStrictEqual(music.audio_settings, { tempo: 120 });
  });

  it('should handle invalid JSON gracefully on findById', async () => {
    const id = 'test-invalid-json-music';
    await db.execute({
      sql: `INSERT INTO music_generations (id, project_id, version, model, audio_settings) VALUES (?, ?, ?, ?, ?)`,
      args: [id, testProjectId, 99, 'music-01', 'invalid json'],
    });

    const result = await MusicModel.findById(id);
    assert.strictEqual(result.audio_settings, null);

    await db.execute({ sql: 'DELETE FROM music_generations WHERE id = ?', args: [id] });
  });

  it('should handle invalid JSON gracefully on findByProject', async () => {
    const id = 'test-invalid-json-music-2';
    await db.execute({
      sql: `INSERT INTO music_generations (id, project_id, version, model, audio_settings, original_file_path) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, testProjectId, 98, 'music-01', 'invalid json', path.join(__dirname, '../fixtures/test-audio.mp3')],
    });

    const results = await MusicModel.findByProject(testProjectId);
    const invalidRow = results.find(r => r.id === id);
    assert.strictEqual(invalidRow.audio_settings, null);

    await db.execute({ sql: 'DELETE FROM music_generations WHERE id = ?', args: [id] });
  });

  it('should handle empty update', async () => {
    const before = await MusicModel.findById(testMusicId);
    const after = await MusicModel.update(testMusicId, {});
    assert.deepStrictEqual(after, before);
  });
});
