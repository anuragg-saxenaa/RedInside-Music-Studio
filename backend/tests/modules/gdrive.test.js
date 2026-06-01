import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { keyToDriveName, isConfigured, getAuthUrl } from '../../src/modules/storage/gdrive.js';

describe('gdrive storage module', () => {
  it('maps a storage key to a flat Drive name', () => {
    assert.equal(
      keyToDriveName('projects/p1/generations/music/v1-original.mp3'),
      'projects__p1__generations__music__v1-original.mp3',
    );
    assert.equal(keyToDriveName('/projects/x/artwork/music-y.png'), 'projects__x__artwork__music-y.png');
  });

  it('reports not-configured when no creds present (default test env)', () => {
    // No GOOGLE_* env in CI/test → disabled, additive-safe.
    assert.equal(isConfigured(), false);
  });

  it('getAuthUrl throws when not configured', () => {
    assert.throws(() => getAuthUrl(), /not configured/);
  });
});
