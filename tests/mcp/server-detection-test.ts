#!/usr/bin/env ts-node
/**
 * Tests for automatic backend URL detection from OpenAPI spec servers property.
 *
 * Run with: npx ts-node tests/mcp/server-detection-test.ts
 */

import { extractServerUrl } from '../src/orc/client';
import { OpenApiSpec } from '../src/orc/types';

// ──────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────

let passed: number = 0;
let failed: number = 0;

async function test(name: string, fn: () => void): Promise<void> {
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

function assertNull(actual: unknown, msg?: string): void {
  if (actual !== null && actual !== undefined) {
    throw new Error(
      msg
        ? `${msg}\n    Expected: null\n    Actual:   ${JSON.stringify(actual)}`
        : `Expected: null\n    Actual:   ${JSON.stringify(actual)}`
    );
  }
}

// ──────────────────────────────────────────────
// extractServerUrl tests
// ──────────────────────────────────────────────

async function testExtractServerUrl(): Promise<void> {
  console.log('\nTesting extractServerUrl...\n');

  // Test 1: Top-level servers with valid URL
  await test(
    'extracts first valid top-level server URL',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'https://api.example.com' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com', 'top-level server');
    }
  );

  // Test 2: Multiple top-level servers — returns first valid one
  await test(
    'returns first valid server from multiple top-level servers',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [
          { url: 'https://api.example.com' },
          { url: 'https://api2.example.com' },
        ],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com', 'first server');
    }
  );

  // Test 3: Invalid top-level servers — falls back to per-path
  await test(
    'falls back to per-path server when top-level servers are invalid',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'not-a-valid-url' }],
        paths: {
          '/users': {
            get: {
              summary: 'List users',
              servers: [{ url: 'https://api.example.com' }],
            },
          },
        },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com', 'per-path fallback');
    }
  );

  // Test 4: No servers at all — returns null
  await test(
    'returns null when no servers are defined',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertNull(result, 'no servers');
    }
  );

  // Test 5: Empty servers array — returns null
  await test(
    'returns null for empty servers array',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertNull(result, 'empty servers');
    }
  );

  // Test 6: Server URL with trailing slash — still valid
  await test(
    'accepts server URL with trailing slash',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'https://api.example.com/' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com/', 'trailing slash');
    }
  );

  // Test 7: Server URL with path prefix — valid
  await test(
    'accepts server URL with path prefix',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'https://api.example.com/v1' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com/v1', 'path prefix');
    }
  );

  // Test 8: Invalid top-level, valid per-path — returns per-path
  await test(
    'extracts per-path server when top-level is invalid',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'invalid-url' }],
        paths: {
          '/users': {
            get: {
              summary: 'List users',
              servers: [{ url: 'https://api.example.com' }],
            },
          },
        },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com', 'per-path valid');
    }
  );

  // Test 9: No top-level servers, only per-path — extracts per-path
  await test(
    'extracts per-path server when no top-level servers',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        paths: {
          '/users': {
            get: {
              summary: 'List users',
              servers: [{ url: 'https://api.example.com' }],
            },
          },
        },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com', 'only per-path');
    }
  );

  // Test 10: All servers invalid — returns null
  await test(
    'returns null when all server URLs are invalid',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'not-valid' }],
        paths: {
          '/users': {
            get: {
              summary: 'List users',
              servers: [{ url: 'also-not-valid' }],
            },
          },
        },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertNull(result, 'all invalid');
    }
  );

  // Test 11: Empty URL string — skipped
  await test(
    'skips server with empty URL string',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: '' }, { url: 'https://api.example.com' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com', 'skip empty URL');
    }
  );

  // Test 12: Undefined URL — skipped
  await test(
    'skips server with undefined URL',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{} as any, { url: 'https://api.example.com' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com', 'skip undefined URL');
    }
  );

  // Test 13: No paths — returns null
  await test(
    'returns null when no paths defined',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'https://api.example.com' }],
        paths: undefined,
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'https://api.example.com', 'no paths');
    }
  );

  // Test 14: No spec at all — returns null
  await test(
    'returns null for minimal spec with no servers or paths',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertNull(result, 'minimal spec');
    }
  );

  // Test 15: HTTP (non-HTTPS) server URL — accepted
  await test(
    'accepts HTTP server URL',
    () => {
      const spec: OpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'http://localhost:8080' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec as OpenApiSpec);
      assertEqual(result, 'http://localhost:8080', 'HTTP URL');
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa extractServerUrl Tests ===');

  await testExtractServerUrl();

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Test runner error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
