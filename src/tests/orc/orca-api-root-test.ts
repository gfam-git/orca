#!/usr/bin/env ts-node
/**
 * Tests for ORCA_API_ROOT environment variable
 *
 * Tests: set root, empty root, invalid root, root with trailing slash
 *
 * Run with: npx ts-node src/tests/orc/orca-api-root-test.ts
 */

import { buildCommandMap, parseApiRoot } from '../../orc/client.js';

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

function assertHasResource(commandMap: Record<string, any>, resource: string, msg?: string): void {
  if (!commandMap[resource]) {
    throw new Error(`${msg || ''} Expected resource '${resource}' to exist`);
  }
}

function assertHasFunction(commandMap: Record<string, any>, resource: string, func: string, msg?: string): void {
  if (!commandMap[resource]?.functions?.[func]) {
    throw new Error(`${msg || ''} Expected function '${func}' on resource '${resource}' to exist`);
  }
}

function assertNoResource(commandMap: Record<string, any>, resource: string, msg?: string): void {
  if (commandMap[resource]) {
    throw new Error(`${msg || ''} Expected resource '${resource}' NOT to exist`);
  }
}

// ──────────────────────────────────────────────
// parseApiRoot tests
// ──────────────────────────────────────────────

async function testParseApiRoot(): Promise<void> {
  console.log('\nTesting parseApiRoot...\n');

  // Test 1: Unset env var
  delete process.env.ORCA_API_ROOT;
  await test('returns empty string when unset', () => {
    const result = parseApiRoot();
    assertEqual(result, '', 'unset env var');
  });

  // Test 2: Empty string
  process.env.ORCA_API_ROOT = '';
  await test('returns empty string when empty', () => {
    const result = parseApiRoot();
    assertEqual(result, '', 'empty env var');
  });

  // Test 3: Normal root
  process.env.ORCA_API_ROOT = '/v1';
  await test('returns normalized root for /v1', () => {
    const result = parseApiRoot();
    assertEqual(result, '/v1', '/v1');
  });

  // Test 4: Root without leading slash
  process.env.ORCA_API_ROOT = 'v1';
  await test('adds leading slash for v1', () => {
    const result = parseApiRoot();
    assertEqual(result, '/v1', 'v1 -> /v1');
  });

  // Test 5: Root with trailing slash
  process.env.ORCA_API_ROOT = '/v1/';
  await test('strips trailing slash for /v1/', () => {
    const result = parseApiRoot();
    assertEqual(result, '/v1', '/v1/ -> /v1');
  });

  // Test 6: Root with multiple trailing slashes
  process.env.ORCA_API_ROOT = '/v1///';
  await test('strips multiple trailing slashes', () => {
    const result = parseApiRoot();
    assertEqual(result, '/v1', '/v1/// -> /v1');
  });

  // Test 7: Root with spaces
  process.env.ORCA_API_ROOT = '  /v1  ';
  await test('trims spaces', () => {
    const result = parseApiRoot();
    assertEqual(result, '/v1', 'spaces trimmed');
  });

  // Test 8: Root with multiple segments (invalid)
  process.env.ORCA_API_ROOT = '/v1/api';
  await test('rejects multiple segments', () => {
    const result = parseApiRoot();
    assertEqual(result, '', '/v1/api rejected');
  });

  // Test 9: Root as just slash
  process.env.ORCA_API_ROOT = '/';
  await test('accepts just slash', () => {
    const result = parseApiRoot();
    assertEqual(result, '/', 'just slash');
  });

  // Test 10: Root with leading slash and trailing slash
  process.env.ORCA_API_ROOT = '/api/';
  await test('normalizes /api/', () => {
    const result = parseApiRoot();
    assertEqual(result, '/api', '/api/ -> /api');
  });
}

// ──────────────────────────────────────────────
// buildCommandMap integration tests
// ──────────────────────────────────────────────

async function testBuildCommandMap(): Promise<void> {
  console.log('\nTesting buildCommandMap with ORCA_API_ROOT...\n');

  // Test spec with /v1 prefix
  const specWithRoot: any = {
    openapi: '3.0.0',
    info: { title: 'Test API' },
    paths: {
      '/v1/users': {
        get: {
          tags: ['users'],
          operationId: 'getUsers',
          summary: 'Get all users',
          parameters: [],
        },
      },
      '/v1/users/{id}': {
        get: {
          tags: ['users'],
          operationId: 'getUser',
          summary: 'Get a user',
          parameters: [
            { name: 'id', in: 'path', schema: { type: 'string' } },
          ],
        },
      },
    },
  };

  // Test 1: Set root - paths are stripped
  process.env.ORCA_API_ROOT = '/v1';
  await test('strips /v1 prefix from paths', () => {
    const commandMap = buildCommandMap(specWithRoot);
    assertHasResource(commandMap, 'users', 'users resource should exist');
    assertHasFunction(commandMap, 'users', 'get', 'get function should exist');
    assertHasFunction(commandMap, 'users', 'get', 'get function should exist');
    // Without root stripping, the resource would be 'v1' instead of 'users'
    assertNoResource(commandMap, 'v1', 'v1 should NOT be a resource');
  });

  // Test 2: Empty root - no stripping
  process.env.ORCA_API_ROOT = '';
  await test('no stripping when root is empty', () => {
    const commandMap = buildCommandMap(specWithRoot);
    // Without stripping, /v1/users would make 'v1' the resource
    assertHasResource(commandMap, 'v1', 'v1 resource should exist when no root');
    assertNoResource(commandMap, 'users', 'users should NOT exist when no root');
  });

  // Test 3: Invalid root - silently ignored
  process.env.ORCA_API_ROOT = '/v1/api';
  await test('invalid root is silently ignored', () => {
    const commandMap = buildCommandMap(specWithRoot);
    // Should behave like unset (no stripping)
    assertHasResource(commandMap, 'v1', 'v1 resource should exist');
  });

  // Test 4: Root with trailing slash
  process.env.ORCA_API_ROOT = '/v1/';
  await test('trailing slash root strips correctly', () => {
    const commandMap = buildCommandMap(specWithRoot);
    assertHasResource(commandMap, 'users', 'users should exist with trailing slash root');
    assertNoResource(commandMap, 'v1', 'v1 should NOT exist with trailing slash root');
  });

  // Test 5: Root as just slash
  const specRootSlash: any = {
    openapi: '3.0.0',
    info: { title: 'Test API' },
    paths: {
      '/users': {
        get: {
          tags: ['users'],
          operationId: 'getUsers',
          summary: 'Get all users',
          parameters: [],
        },
      },
    },
  };
  process.env.ORCA_API_ROOT = '/';
  await test('root / strips the leading slash from rootless paths', () => {
    const commandMap = buildCommandMap(specRootSlash);
    assertHasResource(commandMap, 'users', 'users should exist with root /');
  });
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCA_API_ROOT Tests ===');

  await testParseApiRoot();
  await testBuildCommandMap();

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Test runner error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
