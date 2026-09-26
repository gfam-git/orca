#!/usr/bin/env ts-node
/**
 * Tests for JSON parameter parsing fix (GitHub issue #28)
 *
 * Verifies that parameters with OpenAPI type "object" or "array" are
 * parsed from JSON strings before being sent in requests.
 *
 * Run with: npx ts-node tests/mcp/json-param-parse-test.ts
 */

import { buildParamDefs, parseCommand, resolveOperation } from '../dist/orc/client';
import { ParamDef } from '../dist/orc/types';

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
// buildParamDefs — JSON-type detection
// ──────────────────────────────────────────────

async function testBuildParamDefs(): Promise<void> {
  console.log('\nTesting buildParamDefs JSON-type detection...\n');

  // Test 1: object-type param should be marked json:true
  await test(
    'marks object-type params with json:true',
    () => {
      const operation = {
        parameters: [{
          name: 'schema',
          in: 'query' as const,
          schema: { type: 'object' },
        }],
      };
      const params = buildParamDefs(operation as any, '/tabs/extract');
      const schemaParam = params.find((p: ParamDef) => p.name === 'schema');
      assertEqual(schemaParam?.json, true, 'object param should be json:true');
    }
  );

  // Test 2: array-type param should be marked json:true
  await test(
    'marks array-type params with json:true',
    () => {
      const operation = {
        parameters: [{
          name: 'filters',
          in: 'query' as const,
          schema: { type: 'array' },
        }],
      };
      const params = buildParamDefs(operation as any, '/tabs/list');
      const filtersParam = params.find((p: ParamDef) => p.name === 'filters');
      assertEqual(filtersParam?.json, true, 'array param should be json:true');
    }
  );

  // Test 3: string-type param should NOT be marked json:true
  await test(
    'does not mark string-type params with json',
    () => {
      const operation = {
        parameters: [{
          name: 'userId',
          in: 'query' as const,
          schema: { type: 'string' },
        }],
      };
      const params = buildParamDefs(operation as any, '/tabs/get');
      const userIdParam = params.find((p: ParamDef) => p.name === 'userId');
      assertEqual(userIdParam?.json, undefined, 'string param should not have json:true');
    }
  );

  // Test 4: boolean-type param should NOT be marked json:true
  await test(
    'does not mark boolean-type params with json',
    () => {
      const operation = {
        parameters: [{
          name: 'debug',
          in: 'query' as const,
          schema: { type: 'boolean' },
        }],
      };
      const params = buildParamDefs(operation as any, '/tabs/get');
      const debugParam = params.find((p: ParamDef) => p.name === 'debug');
      assertEqual(debugParam?.json, undefined, 'boolean param should not have json:true');
    }
  );

  // Test 5: requestBody object properties with type:object should be json:true
  await test(
    'marks requestBody object properties with json:true',
    () => {
      const operation = {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  headers: { type: 'object' },
                  body: { type: 'string' },
                },
              },
            },
          },
        },
      };
      const params = buildParamDefs(operation as any, '/execute');
      const headersParam = params.find((p: ParamDef) => p.name === 'headers');
      const bodyParam = params.find((p: ParamDef) => p.name === 'body');
      assertEqual(headersParam?.json, true, 'object body property should be json:true');
      assertEqual(bodyParam?.json, undefined, 'string body property should not be json:true');
    }
  );
}

// ──────────────────────────────────────────────
// resolveOperation — JSON parsing in body
// ──────────────────────────────────────────────

async function testResolveOperationBody(): Promise<void> {
  console.log('\nTesting resolveOperation JSON parsing in body...\n');

  // Create a minimal command map with a JSON-type param
  const commandMap = {
    tabs: {
      name: 'tabs',
      functions: {
        extract: {
          name: 'extract',
          params: [
            { name: 'userId', type: 'string', required: true, boolean: false, location: 'body' as const },
            { name: 'schema', type: 'object', required: false, boolean: false, location: 'body' as const, json: true },
          ],
        },
      },
    },
  };

  const spec = { paths: { '/tabs/{tabId}': {} } };

  // Test 1: JSON string in body param should be parsed to object
  await test(
    'parses JSON string as object in body params',
    () => {
      const parsed = parseCommand('tabs extract --userId geebo --schema {"type":"object","properties":{"heading":{"type":"string"}}}');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const schemaVal = op.body?.schema;
      assertEqual(
        schemaVal,
        { type: 'object', properties: { heading: { type: 'string' } } },
        'schema should be parsed JSON object, not string'
      );
    }
  );

  // Test 2: Invalid JSON string in body should fall back to string
  await test(
    'falls back to string for invalid JSON in body params',
    () => {
      const parsed = parseCommand('tabs extract --userId geebo --schema not-valid-json');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const schemaVal = op.body?.schema;
      assertEqual(schemaVal, 'not-valid-json', 'invalid JSON should remain as string');
    }
  );

  // Test 3: Non-JSON params still work as before (number coercion)
  await test(
    'non-JSON params still use normal coercion',
    () => {
      const parsed = parseCommand('tabs extract --userId 123 --schema {"type":"object"}');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const userIdVal = op.body?.userId;
      assertEqual(userIdVal, '123', 'userId should remain string (string param)');
    }
  );
}

// ──────────────────────────────────────────────
// resolveOperation — JSON parsing in query
// ──────────────────────────────────────────────

async function testResolveOperationQuery(): Promise<void> {
  console.log('\nTesting resolveOperation JSON parsing in query...\n');

  const commandMap = {
    tabs: {
      name: 'tabs',
      functions: {
        extract: {
          name: 'extract',
          params: [
            { name: 'userId', type: 'string', required: true, boolean: false, location: 'query' as const },
            { name: 'schema', type: 'object', required: false, boolean: false, location: 'query' as const, json: true },
          ],
        },
      },
    },
  };

  const spec = { paths: { '/tabs/extract': { get: {} } } };

  // Test 1: JSON string in query param should be parsed to object
  await test(
    'parses JSON string as object in query params',
    () => {
      const parsed = parseCommand('tabs extract --userId geebo --schema {"type":"object"}');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const schemaVal = op.query?.schema;
      assertEqual(
        schemaVal,
        { type: 'object' },
        'schema should be parsed JSON object in query'
      );
    }
  );

  // Test 2: Invalid JSON string in query should fall back to string
  await test(
    'falls back to string for invalid JSON in query params',
    () => {
      const parsed = parseCommand('tabs extract --userId geebo --schema not-json');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const schemaVal = op.query?.schema;
      assertEqual(schemaVal, 'not-json', 'invalid JSON should remain as string in query');
    }
  );
}

// ──────────────────────────────────────────────
// resolveOperation — edge cases
// ──────────────────────────────────────────────

async function testEdgeCases(): Promise<void> {
  console.log('\nTesting edge cases...\n');

  const commandMap = {
    tabs: {
      name: 'tabs',
      functions: {
        extract: {
          name: 'extract',
          params: [
            { name: 'schema', type: 'object', required: false, boolean: false, location: 'body' as const, json: true },
            { name: 'count', type: 'number', required: false, boolean: false, location: 'body' as const },
            { name: 'debug', type: 'boolean', required: false, boolean: true, location: 'body' as const },
          ],
        },
      },
    },
  };

  const spec = { paths: { '/tabs/extract' : {} } };

  // Test 1: JSON array parsing
  await test(
    'parses JSON array in body params',
    () => {
      const parsed = parseCommand('tabs extract --schema ["a","b","c"]');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const schemaVal = op.body?.schema;
      assertEqual(schemaVal, ['a', 'b', 'c'], 'schema should be parsed JSON array');
    }
  );

  // Test 2: Nested JSON object
  await test(
    'parses nested JSON object in body params',
    () => {
      const parsed = parseCommand('tabs extract --schema {"nested":{"deep":{"value":42}},"list":[1,2]}');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const schemaVal = op.body?.schema;
      assertEqual(
        schemaVal,
        { nested: { deep: { value: 42 } }, list: [1, 2] },
        'nested JSON should parse correctly'
      );
    }
  );

  // Test 3: Empty JSON object
  await test(
    'parses empty JSON object {}',
    () => {
      const parsed = parseCommand('tabs extract --schema {}');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const schemaVal = op.body?.schema;
      assertEqual(schemaVal, {}, 'empty object should parse');
    }
  );

  // Test 4: JSON number value
  await test(
    'parses JSON number value',
    () => {
      const parsed = parseCommand('tabs extract --schema 42');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const schemaVal = op.body?.schema;
      assertEqual(schemaVal, 42, 'JSON number should parse to number');
    }
  );

  // Test 5: JSON boolean value
  await test(
    'parses JSON boolean value',
    () => {
      const parsed = parseCommand('tabs extract --schema true');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const schemaVal = op.body?.schema;
      assertEqual(schemaVal, true, 'JSON boolean should parse to boolean');
    }
  );

  // Test 6: Non-JSON params still coerce normally (number)
  await test(
    'non-JSON number params still coerce from string',
    () => {
      const parsed = parseCommand('tabs extract --count 42');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const countVal = op.body?.count;
      assertEqual(countVal, 42, 'number param should coerce to number');
    }
  );

  // Test 7: Non-JSON params still coerce normally (boolean)
  await test(
    'non-JSON boolean params still coerce from string',
    () => {
      const parsed = parseCommand('tabs extract --debug true');
      const op = resolveOperation(parsed, commandMap, spec as any);
      const debugVal = op.body?.debug;
      assertEqual(debugVal, true, 'boolean param should coerce to boolean');
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa JSON Parameter Parsing Tests (GitHub #28) ===');

  await testBuildParamDefs();
  await testResolveOperationBody();
  await testResolveOperationQuery();
  await testEdgeCases();

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Test runner error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
