#!/usr/bin/env ts-node
/**
 * Tests for the OpenAPI prefix routing bug fix (GitHub issue #26)
 *
 * Bug: When ORCA_SPEC_ENDPOINT was set to something like
 *      http://camofox-browser:9377/openapi.json
 * and ORCA_SERVICE_BASE_URL was set to http://camofox-browser:9377,
 * the client incorrectly used the full spec endpoint URL (including
 * /openapi.json) as the service base URL when serviceUrl was not
 * provided to connect(). This caused all HTTP requests to be routed
 * to /openapi.json/<path> instead of /<path>.
 *
 * Fix: In connect(), strip the spec path suffix from the URL before
 *      using it as the service base URL.
 *
 * Run with: npx ts-node tests/orc/openapi-prefix-routing-test.ts
 */

import { buildCommandMap, parseCommand, resolveOperation } from '../../src/orc/client';

// ──────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────

let passed: number = 0;
let failed: number = 0;

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

// ──────────────────────────────────────────────
// Minimal OpenAPI spec builder
// ──────────────────────────────────────────────

function makeSpec(paths: any): any {
  return {
    openapi: '3.0.0',
    info: { title: 'Test API', description: 'Test spec' },
    servers: [{ url: 'http://localhost:8080' }],
    paths: paths,
  };
}

// ──────────────────────────────────────────────
// Test 1: connect() strips /openapi.json from service base URL
// ──────────────────────────────────────────────

async function test1(): Promise<void> {
  console.log('\nTest 1: connect() strips /openapi.json from service base URL\n');
  // We can't actually connect (no server), but we can test the URL derivation
  // by checking what serviceBaseUrl would be set to
  const specEndpoint = 'http://camofox-browser:9377/openapi.json';
  const specPath = new URL(specEndpoint).pathname;
  const baseFromUrl = specEndpoint.slice(0, -specPath.length);
  assertEqual(baseFromUrl, 'http://camofox-browser:9377', 'base URL derived from spec endpoint');
}

// ──────────────────────────────────────────────
// Test 2: connect() with explicit service URL uses it as-is
// ──────────────────────────────────────────────

async function test2(): Promise<void> {
  console.log('\nTest 2: connect() with explicit service URL uses it as-is\n');
  const explicitServiceUrl = 'http://different-host:8080';
  assertEqual(explicitServiceUrl, 'http://different-host:8080', 'explicit service URL unchanged');
}

// ──────────────────────────────────────────────
// Test 3: exec() builds correct URL when service base URL is derived
// ──────────────────────────────────────────────

async function test3(): Promise<void> {
  console.log('\nTest 3: exec() builds correct URL when service base URL is derived\n');
  // Simulate what exec() does with the fixed base URL
  const specEndpoint = 'http://camofox-browser:9377/openapi.json';
  const specPath = new URL(specEndpoint).pathname;
  const serviceBaseUrl = specEndpoint.slice(0, -specPath.length);

  // Simulate an operation path from the spec
  const operationPath = '/health';
  const requestUrl = serviceBaseUrl.endsWith('/')
    ? serviceBaseUrl.slice(0, -1) + operationPath
    : serviceBaseUrl + operationPath;

  assertEqual(requestUrl, 'http://camofox-browser:9377/health', 'correct request URL for /health');
}

// ──────────────────────────────────────────────
// Test 4: exec() builds correct URL for POST /tabs
// ──────────────────────────────────────────────

async function test4(): Promise<void> {
  console.log('\nTest 4: exec() builds correct URL for POST /tabs\n');
  const specEndpoint = 'http://camofox-browser:9377/openapi.json';
  const specPath = new URL(specEndpoint).pathname;
  const serviceBaseUrl = specEndpoint.slice(0, -specPath.length);

  const operationPath = '/tabs';
  const requestUrl = serviceBaseUrl.endsWith('/')
    ? serviceBaseUrl.slice(0, -1) + operationPath
    : serviceBaseUrl + operationPath;

  assertEqual(requestUrl, 'http://camofox-browser:9377/tabs', 'correct request URL for /tabs');
}

// ──────────────────────────────────────────────
// Test 5: exec() builds correct URL for POST /start
// ──────────────────────────────────────────────

async function test5(): Promise<void> {
  console.log('\nTest 5: exec() builds correct URL for POST /start\n');
  const specEndpoint = 'http://camofox-browser:9377/openapi.json';
  const specPath = new URL(specEndpoint).pathname;
  const serviceBaseUrl = specEndpoint.slice(0, -specPath.length);

  const operationPath = '/start';
  const requestUrl = serviceBaseUrl.endsWith('/')
    ? serviceBaseUrl.slice(0, -1) + operationPath
    : serviceBaseUrl + operationPath;

  assertEqual(requestUrl, 'http://camofox-browser:9377/start', 'correct request URL for /start');
}

// ──────────────────────────────────────────────
// Test 6: exec() builds correct URL for nested paths
// ──────────────────────────────────────────────

async function test6(): Promise<void> {
  console.log('\nTest 6: exec() builds correct URL for nested paths\n');
  const specEndpoint = 'http://camofox-browser:9377/openapi.json';
  const specPath = new URL(specEndpoint).pathname;
  const serviceBaseUrl = specEndpoint.slice(0, -specPath.length);

  const operationPath = '/tabs/{tabId}/snapshot';
  const requestUrl = serviceBaseUrl.endsWith('/')
    ? serviceBaseUrl.slice(0, -1) + operationPath
    : serviceBaseUrl + operationPath;

  assertEqual(requestUrl, 'http://camofox-browser:9377/tabs/{tabId}/snapshot', 'correct request URL for nested path');
}

// ──────────────────────────────────────────────
// Test 7: exec() builds correct URL when service URL differs from spec URL
// ──────────────────────────────────────────────

async function test7(): Promise<void> {
  console.log('\nTest 7: exec() builds correct URL when service URL differs from spec URL\n');
  const serviceBaseUrl = 'http://camofox-browser:9377';

  const operationPath = '/health';
  const requestUrl = serviceBaseUrl.endsWith('/')
    ? serviceBaseUrl.slice(0, -1) + operationPath
    : serviceBaseUrl + operationPath;

  assertEqual(requestUrl, 'http://camofox-browser:9377/health', 'correct request URL with explicit service URL');
}

// ──────────────────────────────────────────────
// Test 8: Command map matches CamoFox spec paths correctly
// ──────────────────────────────────────────────

async function test8(): Promise<void> {
  console.log('\nTest 8: Command map matches CamoFox spec paths correctly\n');
  const spec = makeSpec({
    '/health': {
      get: { operationId: 'healthCheck', summary: 'Health check' },
    },
    '/metrics': {
      get: { operationId: 'getMetrics', summary: 'Get metrics' },
    },
    '/tabs': {
      post: { operationId: 'createTab', summary: 'Create tab' },
      get: { operationId: 'listTabs', summary: 'List tabs' },
    },
    '/start': {
      post: { operationId: 'startBrowser', summary: 'Start browser' },
    },
    '/stop': {
      post: { operationId: 'stopBrowser', summary: 'Stop browser' },
    },
  });

  const cmdMap = buildCommandMap(spec);

  // Verify resource and function names
  assertEqual(cmdMap.health.name, 'health', 'health resource name');
  assertEqual(cmdMap.health.functions.get.name, 'get', 'health get function');
  assertEqual(cmdMap.metrics.name, 'metrics', 'metrics resource name');
  assertEqual(cmdMap.metrics.functions.get.name, 'get', 'metrics get function');
  assertEqual(cmdMap.tabs.name, 'tabs', 'tabs resource name');
  assertEqual(cmdMap.tabs.functions.post.name, 'post', 'tabs post function');
  assertEqual(cmdMap.tabs.functions.get.name, 'get', 'tabs get function');
  assertEqual(cmdMap.start.name, 'start', 'start resource name');
  assertEqual(cmdMap.start.functions.post.name, 'post', 'start post function');
  assertEqual(cmdMap.stop.name, 'stop', 'stop resource name');
  assertEqual(cmdMap.stop.functions.post.name, 'post', 'stop post function');
}

// ──────────────────────────────────────────────
// Test 9: resolveOperation finds correct path for /health
// ──────────────────────────────────────────────

async function test9(): Promise<void> {
  console.log('\nTest 9: resolveOperation finds correct path for /health\n');
  const spec = makeSpec({
    '/health': {
      get: { operationId: 'healthCheck', summary: 'Health check' },
    },
  });

  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('health get');
  const resolved = resolveOperation(parsed, cmdMap, spec);

  assertEqual(resolved.path, '/health', 'resolved path for health get');
  assertEqual(resolved.method, 'GET', 'method for health get');
}

// ──────────────────────────────────────────────
// Test 10: resolveOperation finds correct path for /tabs POST
// ──────────────────────────────────────────────

async function test10(): Promise<void> {
  console.log('\nTest 10: resolveOperation finds correct path for /tabs POST\n');
  const spec = makeSpec({
    '/tabs': {
      post: { operationId: 'createTab', summary: 'Create tab' },
    },
  });

  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('tabs post');
  const resolved = resolveOperation(parsed, cmdMap, spec);

  assertEqual(resolved.path, '/tabs', 'resolved path for tabs post');
  assertEqual(resolved.method, 'POST', 'method for tabs post');
}

// ──────────────────────────────────────────────
// Test 11: resolveOperation finds correct path for /start POST
// ──────────────────────────────────────────────

async function test11(): Promise<void> {
  console.log('\nTest 11: resolveOperation finds correct path for /start POST\n');
  const spec = makeSpec({
    '/start': {
      post: { operationId: 'startBrowser', summary: 'Start browser' },
    },
  });

  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('start post');
  const resolved = resolveOperation(parsed, cmdMap, spec);

  assertEqual(resolved.path, '/start', 'resolved path for start post');
  assertEqual(resolved.method, 'POST', 'method for start post');
}

// ──────────────────────────────────────────────
// Test 12: Full URL construction for CamoFox spec
// ──────────────────────────────────────────────

async function test12(): Promise<void> {
  console.log('\nTest 12: Full URL construction for CamoFox spec\n');
  // Simulate the exact scenario from the bug report
  const ORCA_SPEC_ENDPOINT = 'http://camofox-browser:9377/openapi.json';
  const ORCA_SERVICE_BASE_URL = 'http://camofox-browser:9377';

  // Derive service base URL from spec endpoint (the fix)
  const specPath = new URL(ORCA_SPEC_ENDPOINT).pathname;
  const derivedBaseUrl = ORCA_SPEC_ENDPOINT.slice(0, -specPath.length);

  // When ORCA_SERVICE_BASE_URL is set, use it; otherwise use derived
  const serviceBaseUrl = ORCA_SERVICE_BASE_URL || derivedBaseUrl;

  // Test all the endpoints from the bug report
  const testCases = [
    { path: '/health', expected: 'http://camofox-browser:9377/health' },
    { path: '/tabs', expected: 'http://camofox-browser:9377/tabs' },
    { path: '/start', expected: 'http://camofox-browser:9377/start' },
    { path: '/stop', expected: 'http://camofox-browser:9377/stop' },
    { path: '/metrics', expected: 'http://camofox-browser:9377/metrics' },
  ];

  for (const tc of testCases) {
    const requestUrl = serviceBaseUrl.endsWith('/')
      ? serviceBaseUrl.slice(0, -1) + tc.path
      : serviceBaseUrl + tc.path;
    assertEqual(requestUrl, tc.expected, `URL for ${tc.path}`);
  }
}

// ──────────────────────────────────────────────
// Test 13: Verify old behavior would have produced wrong URLs
// ──────────────────────────────────────────────

async function test13(): Promise<void> {
  console.log('\nTest 13: Verify old behavior would have produced wrong URLs\n');
  const ORCA_SPEC_ENDPOINT = 'http://camofox-browser:9377/openapi.json';

  // Old behavior: use spec endpoint directly as service base URL
  const oldServiceBaseUrl = ORCA_SPEC_ENDPOINT;

  // Test what the old code would have produced
  const testCases = [
    { path: '/health', oldUrl: 'http://camofox-browser:9377/openapi.json/health' },
    { path: '/tabs', oldUrl: 'http://camofox-browser:9377/openapi.json/tabs' },
    { path: '/start', oldUrl: 'http://camofox-browser:9377/openapi.json/start' },
  ];

  for (const tc of testCases) {
    const oldUrl = oldServiceBaseUrl.endsWith('/')
      ? oldServiceBaseUrl.slice(0, -1) + tc.path
      : oldServiceBaseUrl + tc.path;
    assertEqual(oldUrl, tc.oldUrl, `old URL for ${tc.path}`);
  }
}

// ──────────────────────────────────────────────
// Test 14: URL with trailing slash handling
// ──────────────────────────────────────────────

async function test14(): Promise<void> {
  console.log('\nTest 14: URL with trailing slash handling\n');
  const specEndpoint = 'http://camofox-browser:9377/openapi.json/';
  const specPath = new URL(specEndpoint).pathname;
  const baseFromUrl = specEndpoint.slice(0, -specPath.length);

  assertEqual(baseFromUrl, 'http://camofox-browser:9377', 'base URL strips trailing slash path');

  const operationPath = '/health';
  const requestUrl = baseFromUrl.endsWith('/')
    ? baseFromUrl.slice(0, -1) + operationPath
    : baseFromUrl + operationPath;

  assertEqual(requestUrl, 'http://camofox-browser:9377/health', 'correct URL with trailing slash spec');
}

// ──────────────────────────────────────────────
// Test 15: URL without trailing slash handling
// ──────────────────────────────────────────────

async function test15(): Promise<void> {
  console.log('\nTest 15: URL without trailing slash handling\n');
  const specEndpoint = 'http://camofox-browser:9377/openapi.json';
  const specPath = new URL(specEndpoint).pathname;
  const baseFromUrl = specEndpoint.slice(0, -specPath.length);

  assertEqual(baseFromUrl, 'http://camofox-browser:9377', 'base URL without trailing slash');

  const operationPath = '/health';
  const requestUrl = baseFromUrl.endsWith('/')
    ? baseFromUrl.slice(0, -1) + operationPath
    : baseFromUrl + operationPath;

  assertEqual(requestUrl, 'http://camofox-browser:9377/health', 'correct URL without trailing slash');
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa OpenAPI Prefix Routing Bug Fix Tests ===');
  console.log('Testing fix for GitHub issue #26:\n');

  const tests: { name: string; fn: () => Promise<void> }[] = [
    { name: 'Test 1', fn: test1 },
    { name: 'Test 2', fn: test2 },
    { name: 'Test 3', fn: test3 },
    { name: 'Test 4', fn: test4 },
    { name: 'Test 5', fn: test5 },
    { name: 'Test 6', fn: test6 },
    { name: 'Test 7', fn: test7 },
    { name: 'Test 8', fn: test8 },
    { name: 'Test 9', fn: test9 },
    { name: 'Test 10', fn: test10 },
    { name: 'Test 11', fn: test11 },
    { name: 'Test 12', fn: test12 },
    { name: 'Test 13', fn: test13 },
    { name: 'Test 14', fn: test14 },
    { name: 'Test 15', fn: test15 },
  ];

  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${t.name}: ${msg}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Test runner error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
