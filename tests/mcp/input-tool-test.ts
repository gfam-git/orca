#!/usr/bin/env ts-node
/**
 * Tests for parseArguments and formatArguments
 *
 * Run with: npx ts-node tests/mcp/input-tool-test.ts
 */

import { parseArguments, formatArguments } from '../index';

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
// parseArguments tests
// ──────────────────────────────────────────────

async function testParseArguments(): Promise<void> {
  console.log('\nTesting parseArguments...\n');

  // Test 1: Simple whitespace split
  await test(
    'splits on whitespace',
    () => {
      const result = parseArguments('hello world foo');
      assertEqual(result, ['hello', 'world', 'foo'], 'simple whitespace split');
    }
  );

  // Test 2: Single quotes preserve content
  await test(
    'single quotes preserve quoted content',
    () => {
      const result = parseArguments("hello 'world foo'");
      assertEqual(result, ['hello', 'world foo'], 'single-quoted arg');
    }
  );

  // Test 3: Double quotes preserve content
  await test(
    'double quotes preserve quoted content',
    () => {
      const result = parseArguments('hello "world foo"');
      assertEqual(result, ['hello', 'world foo'], 'double-quoted arg');
    }
  );

  // Test 4: Quotes preserve whitespace inside
  await test(
    'preserves whitespace inside quotes',
    () => {
      const result = parseArguments('cmd "arg  with  spaces"');
      assertEqual(result, ['cmd', 'arg  with  spaces'], 'whitespace inside quotes');
    }
  );

  // Test 5: Empty input
  await test(
    'returns empty array for empty string',
    () => {
      const result = parseArguments('');
      assertEqual(result, [], 'empty input');
    }
  );

  // Test 6: Only whitespace
  await test(
    'returns empty array for whitespace-only input',
    () => {
      const result = parseArguments('   ');
      assertEqual(result, [], 'whitespace-only input');
    }
  );

  // Test 7: Tab-separated arguments
  await test(
    'splits on tabs',
    () => {
      const result = parseArguments('hello\tworld');
      assertEqual(result, ['hello', 'world'], 'tab-separated');
    }
  );

  // Test 8: Mixed whitespace
  await test(
    'handles mixed whitespace (spaces and tabs)',
    () => {
      const result = parseArguments('a \t b  c');
      assertEqual(result, ['a', 'b', 'c'], 'mixed whitespace');
    }
  );

  // Test 9: Single argument with no spaces
  await test(
    'single argument returns array of one',
    () => {
      const result = parseArguments('hello');
      assertEqual(result, ['hello'], 'single arg');
    }
  );

  // Test 10: Only quoted content
  await test(
    'single quoted argument returns array of one',
    () => {
      const result = parseArguments("'hello world'");
      assertEqual(result, ['hello world'], 'single quoted arg');
    }
  );

  // Test 11: Trailing whitespace
  await test(
    'handles trailing whitespace',
    () => {
      const result = parseArguments('hello world  ');
      assertEqual(result, ['hello', 'world'], 'trailing whitespace');
    }
  );

  // Test 12: Leading whitespace
  await test(
    'handles leading whitespace',
    () => {
      const result = parseArguments('  hello world');
      assertEqual(result, ['hello', 'world'], 'leading whitespace');
    }
  );

  // Test 13: Multiple spaces between args
  await test(
    'handles multiple spaces between args',
    () => {
      const result = parseArguments('hello    world');
      assertEqual(result, ['hello', 'world'], 'multiple spaces between');
    }
  );

  // Test 14: Quoted arg at start
  await test(
    'handles quoted argument at start',
    () => {
      const result = parseArguments('"hello world" foo');
      assertEqual(result, ['hello world', 'foo'], 'quoted at start');
    }
  );

  // Test 15: Quoted arg at end
  await test(
    'handles quoted argument at end',
    () => {
      const result = parseArguments('foo "hello world"');
      assertEqual(result, ['foo', 'hello world'], 'quoted at end');
    }
  );

  // Test 16: Only quoted content
  await test(
    'handles single quoted argument',
    () => {
      const result = parseArguments("'hello world'");
      assertEqual(result, ['hello world'], 'only quoted content');
    }
  );
}

// ──────────────────────────────────────────────
// formatArguments tests
// ──────────────────────────────────────────────

async function testFormatArguments(): Promise<void> {
  console.log('\nTesting formatArguments...\n');

  // Test 1: Empty array
  await test(
    'returns message for empty array',
    () => {
      const result = formatArguments([]);
      assertEqual(result, 'No arguments provided.', 'empty array');
    }
  );

  // Test 2: Single argument
  await test(
    'formats single argument',
    () => {
      const result = formatArguments(['hello']);
      assertEqual(result, "Arguments (1):\n  [ 0] 'hello'", 'single arg');
    }
  );

  // Test 3: Multiple arguments
  await test(
    'formats multiple arguments with indices',
    () => {
      const result = formatArguments(['a', 'b', 'c']);
      assertEqual(result, "Arguments (3):\n  [ 0] 'a'\n  [ 1] 'b'\n  [ 2] 'c'", 'multiple args');
    }
  );

  // Test 4: Arguments with spaces
  await test(
    'formats quoted args with spaces',
    () => {
      const result = formatArguments(['hello world', 'foo bar']);
      assertEqual(result, "Arguments (2):\n  [ 0] 'hello world'\n  [ 1] 'foo bar'", 'args with spaces');
    }
  );

  // Test 5: Argument with special characters
  await test(
    'formats args with special characters',
    () => {
      const result = formatArguments(['hello "world"', "it's fine"]);
      const expected = "Arguments (2):\n  [ 0] 'hello \"world\"'\n  [ 1] 'it's fine'";
      assertEqual(result, expected, 'special chars');
    }
  );

  // Test 6: Long argument list
  await test(
    'formats long argument list correctly',
    () => {
      const result = formatArguments(['a', 'b', 'c', 'd', 'e']);
      assertEqual(result, "Arguments (5):\n  [ 0] 'a'\n  [ 1] 'b'\n  [ 2] 'c'\n  [ 3] 'd'\n  [ 4] 'e'", 'long list');
    }
  );
}

// ──────────────────────────────────────────────
// Integration: parse → format
// ──────────────────────────────────────────────

async function testIntegration(): Promise<void> {
  console.log('\nTesting parseArguments → formatArguments integration...\n');

  // Test 1: round-trip
  await test(
    'parse then format simple args',
    () => {
      const parsed = parseArguments('hello world');
      const formatted = formatArguments(parsed);
      assertEqual(formatted, "Arguments (2):\n  [ 0] 'hello'\n  [ 1] 'world'", 'round-trip simple');
    }
  );

  // Test 2: round-trip with quotes
  await test(
    'parse then format quoted args',
    () => {
      const parsed = parseArguments("hello 'world foo' bar");
      const formatted = formatArguments(parsed);
      assertEqual(formatted, "Arguments (3):\n  [ 0] 'hello'\n  [ 1] 'world foo'\n  [ 2] 'bar'", 'round-trip quoted');
    }
  );

  // Test 3: round-trip empty
  await test(
    'parse then format empty input',
    () => {
      const parsed = parseArguments('');
      const formatted = formatArguments(parsed);
      assertEqual(formatted, 'No arguments provided.', 'round-trip empty');
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa parseArguments / formatArguments Tests ===');

  await testParseArguments();
  await testFormatArguments();
  await testIntegration();

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Test runner error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
