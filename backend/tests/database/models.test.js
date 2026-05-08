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

  after(() => {
    // Cleanup
    if (testProjectId) {
      ProjectModel.delete(testProjectId);
    }
  });

  it('should validate project name on create', () => {
    assert.throws(
      () => ProjectModel.create({ name: '' }),
      /Project name is required and must be a non-empty string/
    );
    assert.throws(
      () => ProjectModel.create({ name: '   ' }),
      /Project name is required and must be a non-empty string/
    );
    assert.throws(
      () => ProjectModel.create({}),
      /Project name is required and must be a non-empty string/
    );
  });

  it('should create project with valid data', () => {
    const project = ProjectModel.create({ name: 'Test Project' });
    testProjectId = project.id;
    assert.ok(project);
    assert.strictEqual(project.name, 'Test Project');
  });

  it('should validate incrementVersion type parameter', () => {
    assert.throws(
      () => ProjectModel.incrementVersion(testProjectId, 'invalid'),
      /Invalid version type: invalid/
    );
    assert.throws(
      () => ProjectModel.incrementVersion(testProjectId, 'SELECT * FROM'),
      /Invalid version type/
    );
  });

  it('should increment version with valid type', () => {
    const before = ProjectModel.findById(testProjectId);
    ProjectModel.incrementVersion(testProjectId, 'lyrics');
    const after = ProjectModel.findById(testProjectId);
    assert.strictEqual(after.current_lyrics_version, before.current_lyrics_version + 1);
  });

  it('should handle empty update', () => {
    const before = ProjectModel.findById(testProjectId);
    const after = ProjectModel.update(testProjectId, {});
    assert.deepStrictEqual(after, before);
  });

  it('should validate name on update', () => {
    assert.throws(
      () => ProjectModel.update(testProjectId, { name: '' }),
      /Project name must be a non-empty string/
    );
    assert.throws(
      () => ProjectModel.update(testProjectId, { name: '   ' }),
      /Project name must be a non-empty string/
    );
  });
});

describe('LyricsModel', () => {
  let testProjectId;
  let testLyricsId;

  before(() => {
    const project = ProjectModel.create({ name: 'Test Project for Lyrics' });
    testProjectId = project.id;
  });

  after(() => {
    if (testProjectId) {
      ProjectModel.delete(testProjectId);
    }
  });

  it('should validate lyrics content on create', () => {
    assert.throws(
      () => LyricsModel.create({ projectId: testProjectId, content: '' }),
      /Lyrics content is required and must be a non-empty string/
    );
    assert.throws(
      () => LyricsModel.create({ projectId: testProjectId }),
      /Lyrics content is required and must be a non-empty string/
    );
  });

  it('should validate project ID on create', () => {
    assert.throws(
      () => LyricsModel.create({ content: 'test lyrics' }),
      /Project ID is required and must be a string/
    );
  });

  it('should create lyrics with valid data', () => {
    const lyrics = LyricsModel.create({
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

  it('should handle invalid JSON gracefully on findById', () => {
    // Insert a row with invalid JSON
    const id = 'test-invalid-json';
    db.prepare(`
      INSERT INTO lyrics_generations (id, project_id, version, content, structure_tags)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, testProjectId, 99, 'test', 'invalid json');

    const result = LyricsModel.findById(id);
    assert.strictEqual(result.structure_tags, null);

    // Cleanup
    db.prepare('DELETE FROM lyrics_generations WHERE id = ?').run(id);
  });

  it('should handle invalid JSON gracefully on findByProject', () => {
    // Insert a row with invalid JSON
    const id = 'test-invalid-json-2';
    db.prepare(`
      INSERT INTO lyrics_generations (id, project_id, version, content, structure_tags)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, testProjectId, 98, 'test', 'invalid json');

    const results = LyricsModel.findByProject(testProjectId);
    const invalidRow = results.find(r => r.id === id);
    assert.strictEqual(invalidRow.structure_tags, null);

    // Cleanup
    db.prepare('DELETE FROM lyrics_generations WHERE id = ?').run(id);
  });
});

describe('MusicModel', () => {
  let testProjectId;
  let testMusicId;

  before(() => {
    const project = ProjectModel.create({ name: 'Test Project for Music' });
    testProjectId = project.id;
  });

  after(() => {
    if (testProjectId) {
      ProjectModel.delete(testProjectId);
    }
  });

  it('should validate model on create', () => {
    assert.throws(
      () => MusicModel.create({ projectId: testProjectId, model: '' }),
      /Music model is required and must be a non-empty string/
    );
    assert.throws(
      () => MusicModel.create({ projectId: testProjectId }),
      /Music model is required and must be a non-empty string/
    );
  });

  it('should validate project ID on create', () => {
    assert.throws(
      () => MusicModel.create({ model: 'music-01' }),
      /Project ID is required and must be a string/
    );
  });

  it('should create music generation with valid data', () => {
    const music = MusicModel.create({
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

  it('should handle invalid JSON gracefully on findById', () => {
    // Insert a row with invalid JSON
    const id = 'test-invalid-json-music';
    db.prepare(`
      INSERT INTO music_generations (id, project_id, version, model, audio_settings)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, testProjectId, 99, 'music-01', 'invalid json');

    const result = MusicModel.findById(id);
    assert.strictEqual(result.audio_settings, null);

    // Cleanup
    db.prepare('DELETE FROM music_generations WHERE id = ?').run(id);
  });

  it('should handle invalid JSON gracefully on findByProject', () => {
    // Insert a row with invalid JSON AND valid file paths (for orphan filter)
    const id = 'test-invalid-json-music-2';
    db.prepare(`
      INSERT INTO music_generations (id, project_id, version, model, audio_settings, original_file_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, testProjectId, 98, 'music-01', 'invalid json', path.join(__dirname, '../fixtures/test-audio.mp3'));

    const results = MusicModel.findByProject(testProjectId);
    const invalidRow = results.find(r => r.id === id);
    assert.strictEqual(invalidRow.audio_settings, null);

    // Cleanup
    db.prepare('DELETE FROM music_generations WHERE id = ?').run(id);
  });

  it('should handle empty update', () => {
    const before = MusicModel.findById(testMusicId);
    const after = MusicModel.update(testMusicId, {});
    assert.deepStrictEqual(after, before);
  });
});
