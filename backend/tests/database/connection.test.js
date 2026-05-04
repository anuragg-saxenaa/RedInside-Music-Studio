import { test } from 'node:test';
import assert from 'node:assert';
import db from '../../src/database/connection.js';

test('should connect to SQLite database', () => {
  const result = db.prepare('SELECT 1 as value').get();
  assert.strictEqual(result.value, 1);
});

test('should have projects table', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").get();
  assert.ok(tables, 'projects table should exist');
});
