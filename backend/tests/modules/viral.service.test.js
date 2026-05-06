/**
 * Viral Toolkit Service Tests
 * Real integration tests - no mocks
 */

import { analyzeHook } from '../../src/modules/viral/hook-analyzer.js';
import { getAllTemplates, getTemplateById, STRUCTURE_TEMPLATES } from '../../src/modules/viral/structure-templates.js';
import { fetchTrendingTopics } from '../../src/modules/viral/trends-scraper.js';

// Skip tests in CI
if (process.env.CI) {
  console.log('Skipping viral toolkit tests in CI');
  process.exit(0);
}

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

// Test results tracking
let passed = 0;
let failed = 0;

function test(name, fn) {
  it(name, async () => {
    try {
      await fn();
      passed++;
      console.log(`  PASS: ${name}`);
    } catch (error) {
      failed++;
      console.log(`  FAIL: ${name}`);
      console.log(`    Error: ${error.message}`);
      throw error;
    }
  });
}

describe('Viral Toolkit', async () => {

  describe('Hook Analyzer', async () => {
    test('should return score 0 for empty lyrics', () => {
      const result = analyzeHook('');
      assert.strictEqual(result.score, 0);
      assert.ok(result.suggestions.length > 0);
    });

    test('should analyze lyrics with hook', () => {
      const lyrics = `YO BHANJI TRAP
WE THE BEST
WE THE BEST
STREET STORIES
VERSE ONE...
WE THE BEST
WE THE BEST
TRAP LIFE`;

      const result = analyzeHook(lyrics);
      assert.ok(result.score >= 0 && result.score <= 100);
      assert.ok(result.details);
      assert.ok(Array.isArray(result.suggestions));
    });

    test('should detect repeated lines', () => {
      const lyrics = `REPEAT THIS
REPEAT THIS
REPEAT THIS
SOMETHING ELSE
REPEAT THIS
ALSO REPEAT
ALSO REPEAT`;

      const result = analyzeHook(lyrics);
      assert.ok(result.details.repetitionCount >= 1);
    });

    test('should identify hook candidates', () => {
      const lyrics = `HOOK LINE ONE
VERSE CONTENT
HOOK LINE ONE
MORE VERSE`;

      const result = analyzeHook(lyrics);
      assert.ok(result.details.hookLines.length > 0);
    });
  });

  describe('Structure Templates', async () => {
    test('should return all templates', () => {
      const templates = getAllTemplates();
      assert.ok(templates.length >= 4);
      assert.ok(templates.some(t => t.id === 'hook-first'));
      assert.ok(templates.some(t => t.id === 'drill'));
    });

    test('should get template by ID', () => {
      const template = getTemplateById('hook-first');
      assert.ok(template);
      assert.strictEqual(template.id, 'hook-first');
      assert.ok(Array.isArray(template.structure));
    });

    test('should return null for invalid template ID', () => {
      const template = getTemplateById('invalid-template');
      assert.strictEqual(template, null);
    });

    test('should include all required template fields', () => {
      const template = getTemplateById('traditional');
      assert.ok(template.id);
      assert.ok(template.name);
      assert.ok(template.description);
      assert.ok(Array.isArray(template.structure));
      assert.ok(template.sections);
      assert.ok(Array.isArray(template.recommendedFor));
    });

    test('hook-first structure should be correct', () => {
      const template = getTemplateById('hook-first');
      const expected = ['Hook', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Hook', 'Outro'];
      assert.deepStrictEqual(template.structure, expected);
    });

    test('drill structure should be correct', () => {
      const template = getTemplateById('drill');
      const expected = ['Intro', 'Hook', 'Verse', 'Hook', 'Verse', 'Hook', 'Outro'];
      assert.deepStrictEqual(template.structure, expected);
    });

    test('build-up structure should include Drop', () => {
      const template = getTemplateById('build-up');
      assert.ok(template.structure.includes('Drop'));
    });
  });

  describe('Trends Scraper', async () => {
    test('should fetch trending topics', async () => {
      const trends = await fetchTrendingTopics(10);
      assert.ok(trends.length <= 10);
      assert.ok(trends[0].topic);
      assert.ok(trends[0].hashtag);
    });

    test('should return trend with required fields', async () => {
      const trends = await fetchTrendingTopics(5);
      const trend = trends[0];
      assert.ok(trend.topic);
      assert.ok(trend.hashtag);
      assert.ok(trend.category);
      assert.ok(typeof trend.momentum === 'number');
    });

    test('should limit results correctly', async () => {
      const trends3 = await fetchTrendingTopics(3);
      const trends5 = await fetchTrendingTopics(5);
      assert.ok(trends3.length <= 3);
      assert.ok(trends5.length <= 5);
    });
  });

});

// Run tests and report
process.on('exit', () => {
  console.log(`\nViral Toolkit Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
});