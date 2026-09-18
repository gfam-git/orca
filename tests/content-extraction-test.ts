#!/usr/bin/env ts-node
/**
 * Tests for content extraction MCP resources (browser_links, browser_downloads,
 * browser_images, browser_stats, browser_screenshot)
 *
 * Run with: npx ts-node tests/content-extraction-test.ts
 */

import { parseCommand } from '../src/orc/client';

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

// ──────────────────────────────────────────────
// Content extraction command format tests
// ──────────────────────────────────────────────
// The content extraction tools build commands like:
//   tabs <function> --userId '<userId>' --tabId '<tabId>'
// and route them through the ORC client.

async function testContentExtractionCommands(): Promise<void> {
  console.log('\nTesting content extraction command format...\n');

  const functions = ['links', 'downloads', 'images', 'stats', 'screenshot'];

  for (const func of functions) {
    await test(
      `tabs ${func} command parses correctly`,
      () => {
        const cmd = `tabs ${func} --userId 'test-user' --tabId 'tab123'`;
        const parsed = parseCommand(cmd);
        assertEqual(parsed.resource, 'tabs', `resource for ${func}`);
        assertEqual(parsed.func, func, `function for ${func}`);
        assertEqual(parsed.flags['userId'], 'test-user', `userId for ${func}`);
        assertEqual(parsed.flags['tabId'], 'tab123', `tabId for ${func}`);
      }
    );
  }
}

// ──────────────────────────────────────────────
// Command parsing edge cases
// ──────────────────────────────────────────────

async function testParsingEdgeCases(): Promise<void> {
  console.log('\nTesting parsing edge cases...\n');

  // Test 1: userId with special characters
  await test(
    'parses userId with hyphens',
    () => {
      const cmd = "tabs links --userId 'user-123' --tabId 'tab-abc'";
      const parsed = parseCommand(cmd);
      assertEqual(parsed.flags['userId'], 'user-123', 'userId with hyphens');
    }
  );

  // Test 2: tabId with underscores
  await test(
    'parses tabId with underscores',
    () => {
      const cmd = "tabs downloads --userId 'u' --tabId 'tab_001'";
      const parsed = parseCommand(cmd);
      assertEqual(parsed.flags['tabId'], 'tab_001', 'tabId with underscores');
    }
  );

  // Test 3: quoted values with spaces
  await test(
    'handles userId with spaces in quotes',
    () => {
      const cmd = "tabs stats --userId 'test user' --tabId 'tab1'";
      const parsed = parseCommand(cmd);
      assertEqual(parsed.flags['userId'], 'test user', 'userId with spaces');
    }
  );

  // Test 4: all 5 content extraction functions
  await test(
    'all 5 functions parse as tabs resource',
    () => {
      const funcs = ['links', 'downloads', 'images', 'stats', 'screenshot'];
      for (const func of funcs) {
        const cmd = `tabs ${func} --userId 'u' --tabId 't'`;
        const parsed = parseCommand(cmd);
        assertEqual(parsed.resource, 'tabs', `resource for ${func}`);
        assertEqual(parsed.func, func, `func for ${func}`);
      }
    }
  );

  // Test 5: empty flags
  await test(
    'parses command with only resource and function',
    () => {
      const cmd = 'tabs links';
      const parsed = parseCommand(cmd);
      assertEqual(parsed.resource, 'tabs', 'resource');
      assertEqual(parsed.func, 'links', 'function');
      assertEqual(Object.keys(parsed.flags).length, 0, 'no flags');
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa Content Extraction MCP Tests ===');

  await testContentExtractionCommands();
  await testParsingEdgeCases();

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Test runner error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
