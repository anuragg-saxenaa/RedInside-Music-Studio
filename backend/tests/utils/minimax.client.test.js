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

test('should throw for invalid params in generateLyrics', async () => {
  const client = new MinimaxClient('test-key');
  await assert.rejects(async () => client.generateLyrics(null), {
    message: 'params must be an object'
  });
  await assert.rejects(async () => client.generateLyrics('invalid'), {
    message: 'params must be an object'
  });
});

test('should throw for invalid params in generateMusic', async () => {
  const client = new MinimaxClient('test-key');
  await assert.rejects(async () => client.generateMusic(null), {
    message: 'params must be an object'
  });
  await assert.rejects(async () => client.generateMusic(123), {
    message: 'params must be an object'
  });
});

test('should throw for invalid params in generateVideo', async () => {
  const client = new MinimaxClient('test-key');
  await assert.rejects(async () => client.generateVideo(null), {
    message: 'params must be an object'
  });
  await assert.rejects(async () => client.generateVideo([]), {
    message: 'params must be an object'
  });
});

test('should throw for invalid taskId in queryVideoStatus', async () => {
  const client = new MinimaxClient('test-key');
  await assert.rejects(async () => client.queryVideoStatus(null), {
    message: 'taskId must be a non-empty string'
  });
  await assert.rejects(async () => client.queryVideoStatus(''), {
    message: 'taskId must be a non-empty string'
  });
  await assert.rejects(async () => client.queryVideoStatus(123), {
    message: 'taskId must be a non-empty string'
  });
});

test('should throw for invalid fileId in retrieveFile', async () => {
  const client = new MinimaxClient('test-key');
  await assert.rejects(async () => client.retrieveFile(null), {
    message: 'fileId must be a non-empty string'
  });
  await assert.rejects(async () => client.retrieveFile(''), {
    message: 'fileId must be a non-empty string'
  });
  await assert.rejects(async () => client.retrieveFile({}), {
    message: 'fileId must be a non-empty string'
  });
});
