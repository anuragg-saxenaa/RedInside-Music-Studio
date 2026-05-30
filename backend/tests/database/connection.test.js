import { test } from 'node:test';
import assert from 'node:assert';
import db from '../../src/database/connection.js';

test('should connect to SQLite database', async () => {
  const result = await db.execute({ sql: 'SELECT 1 as value', args: [] });
  assert.strictEqual(result.rows[0].value, 1);
});

test('should have projects table', async () => {
  const result = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'",
    args: [],
  });
  assert.ok(result.rows.length > 0, 'projects table should exist');
});
