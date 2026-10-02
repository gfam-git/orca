/**
 * Tests for automatic backend URL detection from OpenAPI spec servers property.
 *
 * Run with: node tests/mcp/server-detection-test.js
 */

const { extractServerUrl } = require('../../dist/orc/client');

// ──────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function assertEqual(actual, expected, msg) {
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

function assertNull(actual, msg) {
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

function testExtractServerUrl() {
  console.log('\nTesting extractServerUrl...\n');

  // Test 1: Top-level servers with valid URL
  test(
    'extracts first valid top-level server URL',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'https://api.example.com' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com', 'top-level server');
    }
  );

  // Test 2: Multiple top-level servers — returns first valid one
  test(
    'returns first valid server from multiple top-level servers',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [
          { url: 'https://api.example.com' },
          { url: 'https://api2.example.com' },
        ],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com', 'first server');
    }
  );

  // Test 3: Invalid top-level servers — falls back to per-path
  test(
    'falls back to per-path server when top-level servers are invalid',
    () => {
      const spec = {
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
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com', 'per-path fallback');
    }
  );

  // Test 4: No servers at all — returns null
  test(
    'returns null when no servers are defined',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec);
      assertNull(result, 'no servers');
    }
  );

  // Test 5: Empty servers array — returns null
  test(
    'returns null for empty servers array',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec);
      assertNull(result, 'empty servers');
    }
  );

  // Test 6: Server URL with trailing slash — still valid
  test(
    'accepts server URL with trailing slash',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'https://api.example.com/' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com/', 'trailing slash');
    }
  );

  // Test 7: Server URL with path prefix — valid
  test(
    'accepts server URL with path prefix',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'https://api.example.com/v1' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com/v1', 'path prefix');
    }
  );

  // Test 8: Invalid top-level, valid per-path — returns per-path
  test(
    'extracts per-path server when top-level is invalid',
    () => {
      const spec = {
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
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com', 'per-path valid');
    }
  );

  // Test 9: No top-level servers, only per-path — extracts per-path
  test(
    'extracts per-path server when no top-level servers',
    () => {
      const spec = {
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
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com', 'only per-path');
    }
  );

  // Test 10: All servers invalid — returns null
  test(
    'returns null when all server URLs are invalid',
    () => {
      const spec = {
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
      const result = extractServerUrl(spec);
      assertNull(result, 'all invalid');
    }
  );

  // Test 11: Empty URL string — skipped
  test(
    'skips server with empty URL string',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: '' }, { url: 'https://api.example.com' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com', 'skip empty URL');
    }
  );

  // Test 12: Undefined URL — skipped
  test(
    'skips server with undefined URL',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [null, { url: 'https://api.example.com' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com', 'skip null URL');
    }
  );

  // Test 13: No paths — returns top-level server
  test(
    'returns top-level server when no paths defined',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'https://api.example.com' }],
        paths: undefined,
      };
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://api.example.com', 'no paths');
    }
  );

  // Test 14: No spec at all — returns null
  test(
    'returns null for minimal spec with no servers or paths',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
      };
      const result = extractServerUrl(spec);
      assertNull(result, 'minimal spec');
    }
  );

  // Test 15: HTTP (non-HTTPS) server URL — accepted
  test(
    'accepts HTTP server URL',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        servers: [{ url: 'http://localhost:8080' }],
        paths: { '/users': { get: { summary: 'List users' } } },
      };
      const result = extractServerUrl(spec);
      assertEqual(result, 'http://localhost:8080', 'HTTP URL');
    }
  );

  // Test 16: Per-path servers on multiple operations — returns first valid found
  test(
    'extracts first valid per-path server across operations',
    () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        paths: {
          '/users': {
            get: { summary: 'List users' },
            post: { summary: 'Create user' },
          },
          '/items': {
            get: {
              summary: 'List items',
              servers: [{ url: 'https://items-api.example.com' }],
            },
          },
        },
      };
      const result = extractServerUrl(spec);
      assertEqual(result, 'https://items-api.example.com', 'multi-path first valid');
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

console.log('=== ORCa extractServerUrl Tests ===');

testExtractServerUrl();

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
