/**
 * Tests for JSON parameter parsing fix (GitHub issue #28)
 *
 * Verifies that parameters with OpenAPI type "object" or "array" are
 * parsed from JSON strings before being sent in requests.
 *
 * Run with: node tests/mcp/json-param-parse-test.js
 */

const { parseCommand, resolveOperation } = require('../../dist/orc/client');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failed++;
    console.error('  ✗ ' + name);
    console.error('    ' + err.message);
  }
}

function assertEqual(actual, expected, msg) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    const err = new Error(
      msg
        ? msg + '\n    Expected: ' + expectedStr + '\n    Actual:   ' + actualStr
        : 'Expected: ' + expectedStr + '\n    Actual:   ' + actualStr
    );
    throw err;
  }
}

// ──────────────────────────────────────────────
// resolveOperation — JSON parsing in body
// ──────────────────────────────────────────────

function testResolveOperationBody() {
  console.log('\nTesting resolveOperation JSON parsing in body...\n');

  const commandMap = {
    tabs: {
      name: 'tabs',
      functions: {
        extract: {
          name: 'extract',
          params: [
            { name: 'userId', type: 'string', required: true, boolean: false, location: 'body' },
            { name: 'schema', type: 'object', required: false, boolean: false, location: 'body', json: true },
          ],
        },
      },
    },
  };

  const spec = { paths: { '/tabs/extract': { post: {} } } };

  // Test 1: JSON string in body param should be parsed to object
  test(
    'parses JSON string as object in body params',
    () => {
      // Simulates: bash would strip outer quotes, so parser receives unquoted JSON
      const parsed = parseCommand('tabs extract --userId geebo --schema {"type":"object","properties":{"heading":{"type":"string"}}}');
      const op = resolveOperation(parsed, commandMap, spec);
      const schemaVal = op.body.schema;
      assertEqual(
        schemaVal,
        { type: 'object', properties: { heading: { type: 'string' } } },
        'schema should be parsed JSON object, not string'
      );
    }
  );

  // Test 2: Invalid JSON string in body should fall back to string
  test(
    'falls back to string for invalid JSON in body params',
    () => {
      const parsed = parseCommand('tabs extract --userId geebo --schema not-valid-json');
      const op = resolveOperation(parsed, commandMap, spec);
      const schemaVal = op.body.schema;
      assertEqual(schemaVal, 'not-valid-json', 'invalid JSON should remain as string');
    }
  );

  // Test 3: Non-JSON params still work as before (string)
  test(
    'non-JSON params still use normal coercion',
    () => {
      const parsed = parseCommand('tabs extract --userId geebo --schema {"type":"object"}');
      const op = resolveOperation(parsed, commandMap, spec);
      const userIdVal = op.body.userId;
      assertEqual(userIdVal, 'geebo', 'userId should remain string');
    }
  );
}

// ──────────────────────────────────────────────
// resolveOperation — JSON parsing in query
// ──────────────────────────────────────────────

function testResolveOperationQuery() {
  console.log('\nTesting resolveOperation JSON parsing in query...\n');

  const commandMap = {
    tabs: {
      name: 'tabs',
      functions: {
        extract: {
          name: 'extract',
          params: [
            { name: 'userId', type: 'string', required: true, boolean: false, location: 'query' },
            { name: 'schema', type: 'object', required: false, boolean: false, location: 'query', json: true },
          ],
        },
      },
    },
  };

  const spec = { paths: { '/tabs/extract': { get: {} } } };

  // Test 1: JSON string in query param should be parsed to object
  test(
    'parses JSON string as object in query params',
    () => {
      const parsed = parseCommand('tabs extract --userId geebo --schema {"type":"object"}');
      const op = resolveOperation(parsed, commandMap, spec);
      const schemaVal = op.query.schema;
      assertEqual(
        schemaVal,
        { type: 'object' },
        'schema should be parsed JSON object in query'
      );
    }
  );

  // Test 2: Invalid JSON string in query should fall back to string
  test(
    'falls back to string for invalid JSON in query params',
    () => {
      const parsed = parseCommand('tabs extract --userId geebo --schema not-json');
      const op = resolveOperation(parsed, commandMap, spec);
      const schemaVal = op.query.schema;
      assertEqual(schemaVal, 'not-json', 'invalid JSON should remain as string in query');
    }
  );
}

// ──────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────

function testEdgeCases() {
  console.log('\nTesting edge cases...\n');

  const commandMap = {
    tabs: {
      name: 'tabs',
      functions: {
        extract: {
          name: 'extract',
          params: [
            { name: 'schema', type: 'object', required: false, boolean: false, location: 'body', json: true },
            { name: 'count', type: 'number', required: false, boolean: false, location: 'body' },
            { name: 'debug', type: 'boolean', required: false, boolean: true, location: 'body' },
          ],
        },
      },
    },
  };

  const spec = { paths: { '/tabs/extract': { post: {} } } };

  // Test 1: JSON array parsing
  test(
    'parses JSON array in body params',
    () => {
      const parsed = parseCommand('tabs extract --schema ["a","b","c"]');
      const op = resolveOperation(parsed, commandMap, spec);
      const schemaVal = op.body.schema;
      assertEqual(schemaVal, ['a', 'b', 'c'], 'schema should be parsed JSON array');
    }
  );

  // Test 2: Nested JSON object
  test(
    'parses nested JSON object in body params',
    () => {
      const parsed = parseCommand('tabs extract --schema {"nested":{"deep":{"value":42},"list":[1,2]}}');
      const op = resolveOperation(parsed, commandMap, spec);
      const schemaVal = op.body.schema;
      assertEqual(
        schemaVal,
        { nested: { deep: { value: 42 }, list: [1, 2] } },
        'nested JSON should parse correctly'
      );
    }
  );

  // Test 3: Empty JSON object
  test(
    'parses empty JSON object {}',
    () => {
      const parsed = parseCommand('tabs extract --schema {}');
      const op = resolveOperation(parsed, commandMap, spec);
      const schemaVal = op.body.schema;
      assertEqual(schemaVal, {}, 'empty object should parse');
    }
  );

  // Test 4: JSON number value
  test(
    'parses JSON number value',
    () => {
      const parsed = parseCommand('tabs extract --schema 42');
      const op = resolveOperation(parsed, commandMap, spec);
      const schemaVal = op.body.schema;
      assertEqual(schemaVal, 42, 'JSON number should parse to number');
    }
  );

  // Test 5: JSON boolean value
  test(
    'parses JSON boolean value',
    () => {
      const parsed = parseCommand('tabs extract --schema true');
      const op = resolveOperation(parsed, commandMap, spec);
      const schemaVal = op.body.schema;
      assertEqual(schemaVal, true, 'JSON boolean should parse to boolean');
    }
  );

  // Test 6: Non-JSON params still coerce normally (number)
  test(
    'non-JSON number params still coerce from string',
    () => {
      const parsed = parseCommand('tabs extract --count 42');
      const op = resolveOperation(parsed, commandMap, spec);
      const countVal = op.body.count;
      assertEqual(countVal, 42, 'number param should coerce to number');
    }
  );

  // Test 7: Non-JSON params still coerce normally (boolean)
  test(
    'non-JSON boolean params still coerce from string',
    () => {
      const parsed = parseCommand('tabs extract --debug true');
      const op = resolveOperation(parsed, commandMap, spec);
      const debugVal = op.body.debug;
      assertEqual(debugVal, true, 'boolean param should coerce to boolean');
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

console.log('=== ORCa JSON Parameter Parsing Tests (GitHub #28) ===');

testResolveOperationBody();
testResolveOperationQuery();
testEdgeCases();

console.log('\n' + passed + ' passed, ' + failed + ' failed');

if (failed > 0) {
  process.exit(1);
}
