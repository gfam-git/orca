#!/usr/bin/env ts-node
/**
 * Additional targeted tests for ORCA_EXCLUDE_TAGS — edge cases, integration,
 * and interaction with other ORCa features.
 *
 * Run with: npx ts-node tests/mcp/exclude-tags-additional-test.ts
 */

import { buildCommandMap, help } from '../../src/index';

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

/** Spec with multiple operations, mixed tags, and nested paths. */
const specComplex: Record<string, unknown> = {
  openapi: '3.0.0',
  info: { title: 'Complex API' },
  paths: {
    '/users': {
      get: { tags: ['users'], summary: 'List users' },
      post: { tags: ['users'], summary: 'Create user' },
    },
    '/users/{id}': {
      get: { tags: ['users'], summary: 'Get user' },
      delete: { tags: ['users'], summary: 'Delete user' },
    },
    '/admin/dashboard': {
      get: { tags: ['admin', 'internal'], summary: 'Admin dashboard' },
      post: { tags: ['admin', 'internal'], summary: 'Update dashboard' },
    },
    '/public/health': {
      get: { tags: ['public'], summary: 'Health check' },
    },
    '/public/status': {
      get: { tags: ['public', 'deprecated'], summary: 'Status (deprecated)' },
    },
    '/reports': {
      get: { tags: ['reports'], summary: 'List reports' },
      post: { tags: ['reports'], summary: 'Generate report' },
    },
    '/reports/{id}': {
      get: { tags: ['reports'], summary: 'Get report' },
    },
  },
};

/** Spec where an operation has an empty tags array. */
const specEmptyTags: Record<string, unknown> = {
  openapi: '3.0.0',
  info: { title: 'Empty Tags API' },
  paths: {
    '/items': {
      get: { tags: [], summary: 'List items' },
    },
  },
};

// ──────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────

function runTests(): void {
  console.log('=== ORCa ORCA_EXCLUDE_TAGS Additional Tests ===\n');

  // --- Test 1: Case sensitivity ---
  test('tags are case-sensitive — "Users" does not exclude "users"', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'Users';
      const map = buildCommandMap(specComplex as any);
      assertContains(map, ['users'], 'users should NOT be excluded (case mismatch)');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 2: Operation with empty tags array is never excluded ---
  test('operation with empty tags array is never excluded', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'nonexistent';
      const map = buildCommandMap(specEmptyTags as any);
      assertContains(map, ['items'], 'items with empty tags should remain');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 3: Excluding one tag does not affect operations tagged with other tags ---
  test('excluding "admin" does not affect "public" or "users" operations', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'admin';
      const map = buildCommandMap(specComplex as any);
      assertNotContains(map, ['admin'], 'admin should be excluded');
      assertContains(map, ['users', 'public', 'reports'], 'other resources remain');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 4: Excluding "deprecated" tag removes only deprecated operations ---
  test('excluding "deprecated" removes only operations with that tag', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'deprecated';
      const map = buildCommandMap(specComplex as any);
      // '/public/status' has tags ['public','deprecated'] → excluded
      // But '/public/health' has tags ['public'] → should remain
      // So 'public' resource should still be in the map
      assertContains(map, ['public'], 'public should remain (health check not deprecated)');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 5: Multiple tags on an operation — exclude ANY matching tag ---
  test('excluding one tag from multi-tagged operation removes it', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'internal';
      const map = buildCommandMap(specComplex as any);
      assertNotContains(map, ['admin'], 'admin/internal operations excluded');
      assertContains(map, ['users', 'public', 'reports'], 'other resources remain');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 6: Excluding ALL tags in a spec results in empty commandMap ---
  test('excluding all tags results in empty commandMap', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'users,admin,public,reports';
      const map = buildCommandMap(specComplex as any);
      assertEqual(Object.keys(map).length, 0, 'commandMap should be empty');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 7: Help text reflects excluded operations ---
  test('help() text reflects excluded resources', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'users';
      const map = buildCommandMap(specComplex as any);
      const spec = specComplex as any;
      const helpText = help(map, spec) as string;
      if (!helpText.includes('public')) throw new Error('help should list public');
      if (!helpText.includes('reports')) throw new Error('help should list reports');
      if (helpText.includes('users')) throw new Error('help should NOT mention users');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 8: Very long tag list (stress test) ---
  test('handles long comma-delimited tag lists', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'users,admin,public,reports,act,default,deprecated,internal,prod,staging';
      const map = buildCommandMap(specComplex as any);
      assertEqual(Object.keys(map).length, 0, 'all resources excluded');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 9: Trailing/leading commas in tag list ---
  test('trailing and leading commas are handled gracefully', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = ',users,,admin,';
      const map = buildCommandMap(specComplex as any);
      assertNotContains(map, ['users'], 'users excluded');
      assertNotContains(map, ['admin'], 'admin excluded');
      assertContains(map, ['public', 'reports'], 'other resources remain');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 10: Excluded operations do not appear in commandMap functions ---
  test('excluded operations are completely absent from commandMap', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'reports';
      const map = buildCommandMap(specComplex as any);
      assertNotContains(map, ['reports'], 'reports resource should not exist');
      assertContains(map, ['users', 'admin', 'public'], 'other resources remain');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 11: Exclusion does not mutate the original spec ---
  test('exclusion does not mutate the original spec object', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'users';
      const specCopy = JSON.parse(JSON.stringify(specComplex));
      buildCommandMap(specComplex as any);
      assertEqual(JSON.stringify(specComplex), JSON.stringify(specCopy), 'spec should not be mutated');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 12: buildCommandMap is idempotent across multiple calls ---
  test('buildCommandMap produces same result on repeated calls', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'users';
      const map1 = buildCommandMap(specComplex as any);
      const map2 = buildCommandMap(specComplex as any);
      assertEqual(JSON.stringify(map1), JSON.stringify(map2), 'repeated calls produce same result');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 13: Excluding one tag preserves all functions of other resources ---
  test('excluding one tag preserves all functions of unaffected resources', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'admin';
      const map = buildCommandMap(specComplex as any);
      const userFuncs = Object.keys(map['users'].functions);
      assertEqual(userFuncs.length, 3, 'users should have 3 functions (get, post, delete — duplicate get from /users/{id} overwrites /users)');
    } finally {
      if (oldVal !== undefined) process.env.ORCA_EXCLUDE_TAGS = oldVal;
    }
  });

  // --- Test 14: Excluding "public" removes public resource but leaves nested paths of other resources ---
  test('excluding "public" only removes public-tagged operations', () => {
    const oldVal = process.env.ORCA_EXCLUDE_TAGS;
    try {
      process.env.ORCA_EXCLUDE_TAGS = 'public';
      const map = buildCommandMap(specComplex as any);
      assertNotContains(map, ['public'], 'public should be excluded');
      assertContains(map, ['users', 'admin', 'reports'], 'other resources remain');
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
