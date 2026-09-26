#!/usr/bin/env ts-node
/**
 * Tests for ORCA_EXCLUDE_TAGS — tag-based path exclusion in buildCommandMap.
 *
 * Run with: npx ts-node tests/mcp/exclude-tags-test.ts
 */

import { buildCommandMap } from '../../src/index';

// ──────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────

let passed: number = 0;
let failed: number = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, msg?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      msg
        ? `${msg}\n    Expected: ${expectedStr}\n    Actual:   ${actualStr}`
        : `Expected: ${expectedStr}\n    Actual:   ${actualStr}`
    );
  }
}

function assertContains(obj: Record<string, unknown>, keys: string[], msg?: string): void {
  for (const k of keys) {
    if (!(k in obj)) {
      throw new Error(`${msg ? msg + ': ' : ''}Missing key "${k}"`);
    }
  }
}

function assertNotContains(obj: Record<string, unknown>, keys: string[], msg?: string): void {
  for (const k of keys) {
    if (k in obj) {
      throw new Error(`${msg ? msg + ': ' : ''}Unexpected key "${k}"`);
    }
  }
}

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

/** A spec with multiple operations tagged differently. */
const specWithTags: Record<string, unknown> = {
  openapi: '3.0.0',
  info: { title: 'Test API' },
  paths: {
    '/users': {
      get: { tags: ['users'], summary: 'List users' },
      post: { tags: ['users'], summary: 'Create user' },
    },
    '/users/{id}': {
      get: { tags: ['users'], summary: 'Get user' },
      delete: { tags: ['users'], summary: 'Delete user' },
    },
    '/tabs': {
      get: { tags: ['tabs', 'act'], summary: 'List tabs' },
    },
    '/sessions': {
      get: { tags: ['sessions', 'default'], summary: 'List sessions' },
    },
    '/health': {
      get: { tags: ['health'], summary: 'Health check' },
    },
  },
};

/** A spec with no tags on any operation. */
const specNoTags: Record<string, unknown> = {
  openapi: '3.0.0',
  info: { title: 'No Tags API' },
  paths: {
    '/items': {
      get: { summary: 'List items' },
    },
  },
};

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

function runTests(): void {
  console.log('=== ORCa ORCA_EXCLUDE_TAGS Tests ===\n');

  // --- Test 1: No env var — all operations included ---
  test('buildCommandMap includes all operations when ORCA_EXCLUDE_TAGS is unset', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      delete process.env.ORCA_EXCLUDE_TAGS;
      const map = buildCommandMap(specWithTags as any);
      assertContains(map, ['users', 'tabs', 'sessions', 'health'], 'all resources present');
      const userFuncs = Object.keys(map['users'].functions);
      assertEqual(userFuncs.length, 3, 'users has 3 unique functions (get, post, delete)');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 2: Exclude single tag ---
  test('ORCA_EXCLUDE_TAGS=users filters out users resources', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'users';
      const map = buildCommandMap(specWithTags as any);
      assertNotContains(map, ['users'], 'users should be excluded');
      assertContains(map, ['tabs', 'sessions', 'health'], 'other resources remain');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 3: Exclude multiple tags ---
  test('ORCA_EXCLUDE_TAGS=act,default filters out matching operations', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'act,default';
      const map = buildCommandMap(specWithTags as any);
      // '/tabs' has tags ['tabs','act'] — should be excluded
      assertNotContains(map, ['tabs'], 'tabs should be excluded (tag "act")');
      // '/sessions' has tags ['sessions','default'] — should be excluded
      assertNotContains(map, ['sessions'], 'sessions should be excluded (tag "default")');
      // '/users' and '/health' should remain
      assertContains(map, ['users', 'health'], 'users and health remain');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 4: Empty string — same as unset ---
  test('ORCA_EXCLUDE_TAGS="" behaves like unset', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = '';
      const map = buildCommandMap(specWithTags as any);
      assertContains(map, ['users', 'tabs', 'sessions', 'health'], 'all resources present');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 5: Whitespace in tag values is trimmed ---
  test('ORCA_EXCLUDE_TAGS trims whitespace around tag names', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = '  users  ,  health  ';
      const map = buildCommandMap(specWithTags as any);
      assertNotContains(map, ['users'], 'users should be excluded');
      assertNotContains(map, ['health'], 'health should be excluded');
      assertContains(map, ['tabs', 'sessions'], 'other resources remain');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 6: No tags on operations — nothing to exclude ---
  test('buildCommandMap works with no-tag operations regardless of ORCA_EXCLUDE_TAGS', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'nonexistent';
      const map = buildCommandMap(specNoTags as any);
      assertContains(map, ['items'], 'items resource still present');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 7: Partial tag match does NOT exclude ---
  test('partial tag matches do not exclude operations', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'tab';
      const map = buildCommandMap(specWithTags as any);
      // '/tabs' has tags ['tabs','act'] — 'tab' is NOT an exact match for 'tabs'
      assertContains(map, ['tabs'], 'tabs should NOT be excluded (tag "tabs" != "tab")');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 8: Empty tag in comma list is ignored ---
  test('empty tags in comma list are ignored', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'users,,health';
      const map = buildCommandMap(specWithTags as any);
      assertNotContains(map, ['users'], 'users excluded');
      assertNotContains(map, ['health'], 'health excluded');
      assertContains(map, ['tabs', 'sessions'], 'other resources remain');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Summary ---
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
