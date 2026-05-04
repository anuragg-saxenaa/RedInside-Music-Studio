// backend/tests/utils/minimax.client.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import MinimaxClient from '../../src/utils/minimax.client.js';

test('should create client with API key', () => {
  const client = new MinimaxClient('test-key');
  assert.ok(client);
  assert.strictEqual(client.apiKey, 'test-key');
});

test('should build request headers', () => {
  const client = new MinimaxClient('test-key');
  const headers = client.getHeaders();
  assert.strictEqual(headers.Authorization, 'Bearer test-key');
  assert.strictEqual(headers['Content-Type'], 'application/json');
});
