import { test } from 'node:test';
import assert from 'node:assert';
import config from '../../src/config/env.config.js';

test('should load environment configuration', () => {
  assert.ok(config.minimax.apiKey, 'API key should be loaded');
  assert.strictEqual(config.server.port, 3000);
  assert.strictEqual(config.redis.host, 'localhost');
});

test('should have all required configuration sections', () => {
  assert.ok(config.minimax, 'MiniMax config should exist');
  assert.ok(config.server, 'Server config should exist');
  assert.ok(config.redis, 'Redis config should exist');
  assert.ok(config.database, 'Database config should exist');
  assert.ok(config.storage, 'Storage config should exist');
});
