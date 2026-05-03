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

test('should throw for invalid port', async () => {
  const originalPort = process.env.PORT;
  const originalRedisPort = process.env.REDIS_PORT;

  // Test invalid port value
  process.env.PORT = 'invalid';

  await assert.rejects(
    async () => {
      // Clear module cache and re-import to trigger validation
      const modulePath = '../../src/config/env.config.js';
      delete (await import(modulePath));
      await import(`${modulePath}?t=${Date.now()}`);
    },
    (err) => {
      return err.message.includes('Invalid port');
    },
    'Should throw error for invalid port'
  );

  // Test port out of range
  process.env.PORT = '99999';

  await assert.rejects(
    async () => {
      const modulePath = '../../src/config/env.config.js';
      await import(`${modulePath}?t=${Date.now()}`);
    },
    (err) => {
      return err.message.includes('Invalid port');
    },
    'Should throw error for port out of range'
  );

  // Restore original values
  if (originalPort) {
    process.env.PORT = originalPort;
  } else {
    delete process.env.PORT;
  }
  if (originalRedisPort) {
    process.env.REDIS_PORT = originalRedisPort;
  } else {
    delete process.env.REDIS_PORT;
  }
});
