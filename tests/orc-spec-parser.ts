#!/usr/bin/env ts-node
/**
 * Tests for OpenAPI spec parser and command map builder
 *
 * Run with: npx ts-node tests/orc-spec-parser.ts
 */

import {
  buildCommandMap,
  parseCommand,
  resolveOperation,
  help,
  helpResource,
  helpFunction,
  OrcSpecError,
} from '../src/orc/client';
import type { OpenApiSpec, ParsedCommand } from '../src/orc/types';

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

function assertDeepEqual(actual: unknown, expected: unknown, msg?: string): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  if (actualStr !== expectedStr) {
    throw new Error(
      msg
        ? `${msg}\n    Expected:\n${expectedStr}\n    Actual:\n${actualStr}`
        : `Expected:\n${expectedStr}\n    Actual:\n${actualStr}`
    );
  }
}

// ──────────────────────────────────────────────
// Sample OpenAPI specs for testing
// ──────────────────────────────────────────────

/** A minimal OpenAPI spec with a few common resources */
const sampleSpec: OpenApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Sample API',
    description: 'A sample API for testing',
  },
  paths: {
    // /users/{id} — GET
    '/users/{id}': {
      get: {
        tags: ['users'],
        operationId: 'getUser',
        summary: 'Get a user by ID',
        description: 'Returns a single user',
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'User ID', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Successful response' } },
      },
      // PUT /users/{id}
      put: {
        tags: ['users'],
        operationId: 'updateUser',
        summary: 'Update a user',
        description: 'Updates an existing user',
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'User ID', schema: { type: 'string' } },
          { name: 'name', in: 'query', description: 'User name', schema: { type: 'string' } },
          { name: 'debug', in: 'query', description: 'Enable debug mode', schema: { type: 'boolean' } },
        ],
        responses: { '200': { description: 'Successful response' } },
      },
    },
    // /users — GET (list all users)
    '/users': {
      get: {
        tags: ['users'],
        operationId: 'listUsers',
        summary: 'List all users',
        parameters: [
          { name: 'limit', in: 'query', description: 'Max results', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', description: 'Result offset', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Successful response' } },
      },
      // POST /users
      post: {
        tags: ['users'],
        operationId: 'createUser',
        summary: 'Create a new user',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'User name' },
                  email: { type: 'string', description: 'User email' },
                  active: { type: 'boolean', description: 'Is the user active' },
                },
                required: ['name', 'email'],
              },
            },
          },
        },
        responses: { '201': { description: 'User created' } },
      },
    },
    // /tabs/{id} — GET
    '/tabs/{id}': {
      get: {
        tags: ['tabs'],
        operationId: 'getTab',
        summary: 'Get a tab by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'Tab ID', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Successful response' } },
      },
    },
  },
};

/** A spec with path-based resource resolution (no tags) */
const pathBasedSpec: OpenApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Path-based API' },
  paths: {
    '/items/{id}': {
      get: {
        operationId: 'getItem',
        summary: 'Get an item',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        operationId: 'deleteItem',
        summary: 'Delete an item',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '204': { description: 'Deleted' } },
      },
    },
  },
};

/** A spec where function name matches resource name */
const sameNameSpec: OpenApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Same Name API' },
  paths: {
    '/items/{id}': {
      get: {
        tags: ['items'],
        operationId: 'getItems',
        summary: 'Get an item',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
  },
};

// ──────────────────────────────────────────────
// buildCommandMap tests
// ──────────────────────────────────────────────

async function testBuildCommandMap(): Promise<void> {
  console.log('\nTesting buildCommandMap...\n');

  // Test 1: Basic resource and function extraction
  await test(
    'extracts resources from tags',
    () => {
      const map = buildCommandMap(sampleSpec);
      assertEqual(Object.keys(map).sort(), ['tabs', 'users'], 'resource names');
    }
  );

  // Test 2: Functions per resource
  await test(
    'extracts functions per resource',
    () => {
      const map = buildCommandMap(sampleSpec);
      const users = map['users'];
      assertEqual(Object.keys(users.functions).sort(), ['create', 'get', 'list', 'update'], 'users functions');
    }
  );

  // Test 3: Function descriptions
  await test(
    'stores function descriptions (summary takes precedence)',
    () => {
      const map = buildCommandMap(sampleSpec);
      const get = map['users'].functions['get'];
      assertEqual(get.description, 'Get a user by ID', 'get function description');
    }
  );

  // Test 4: Parameter extraction
  await test(
    'extracts parameters from operation',
    () => {
      const map = buildCommandMap(sampleSpec);
      const get = map['users'].functions['get'];
      assertEqual(get.params.length, 1, 'get params count');
      assertEqual(get.params[0].name, 'id', 'first param name');
      assertEqual(get.params[0].type, 'string', 'first param type');
      assertEqual(get.params[0].required, true, 'first param required');
      assertEqual(get.params[0].location, 'path', 'first param location');
    }
  );

  // Test 5: Boolean parameter detection
  await test(
    'detects boolean parameters',
    () => {
      const map = buildCommandMap(sampleSpec);
      const update = map['users'].functions['update'];
      const debugParam = update.params.find((p) => p.name === 'debug');
      assertEqual(debugParam?.boolean, true, 'debug is boolean');
      assertEqual(debugParam?.type, 'boolean', 'debug type');
    }
  );

  // Test 3: Body parameters from request body
  await test(
    'extracts body parameters from request body schema',
    () => {
      const map = buildCommandMap(sampleSpec);
      const create = map['users'].functions['create'];
      const names = create.params.map((p) => p.name).sort();
      assertEqual(names, ['active', 'email', 'name'], 'create params');
    }
  );

  // Test 8: Path-based resource resolution (no tags)
  await test(
    'resolves resources from path segments when no tags',
    () => {
      const map = buildCommandMap(pathBasedSpec);
      assertEqual(Object.keys(map), ['items'], 'path-based resource');
      assertEqual(Object.keys(map['items'].functions).sort(), ['delete', 'get'], 'path-based functions');
    }
  );

  // Test 9: Same name resource and function uses method
  await test(
    'uses method type when function matches resource',
    () => {
      const map = buildCommandMap(sameNameSpec);
      const items = map['items'];
      // When operationId is "getItems" and resource is "items", it should use method "get"
      assertEqual(Object.keys(items.functions), ['get'], 'same name uses method');
    }
  );

  // Test 10: Parameter descriptions
  await test(
    'stores parameter descriptions',
    () => {
      const map = buildCommandMap(sampleSpec);
      const get = map['users'].functions['get'];
      assertEqual(get.params[0].description, 'User ID', 'param description');
    }
  );

  // Test 11: Query parameters
  await test(
    'marks query parameters correctly',
    () => {
      const map = buildCommandMap(sampleSpec);
      const list = map['users'].functions['list'];
      const limitParam = list.params.find((p) => p.name === 'limit');
      assertEqual(limitParam?.location, 'query', 'limit is query');
      assertEqual(limitParam?.type, 'integer', 'limit type');
    }
  );
}

// ──────────────────────────────────────────────
// parseCommand tests
// ──────────────────────────────────────────────

async function testParseCommand(): Promise<void> {
  console.log('\nTesting parseCommand...\n');

  // Test 1: Simple resource and function
  await test(
    'parses resource and function',
    () => {
      const parsed = parseCommand('users get');
      assertEqual(parsed.resource, 'users', 'resource');
      assertEqual(parsed.func, 'get', 'function');
    }
  );

  // Test 2: Resource, function, and flag with value
  await test(
    'parses flag with value',
    () => {
      const parsed = parseCommand('users get --id 123');
      assertEqual(parsed.flags['id'], '123', 'flag value');
    }
  );

  // Test 3: Multiple flags
  await test(
    'parses multiple flags',
    () => {
      const parsed = parseCommand('users update --id 1 --name foo --debug true');
      assertEqual(parsed.flags['id'], '1', 'id flag');
      assertEqual(parsed.flags['name'], 'foo', 'name flag');
      assertEqual(parsed.flags['debug'], true, 'debug boolean true');
    }
  );

  // Test 4: Boolean true — should be true
  await test(
    'parses boolean true',
    () => {
      const parsed = parseCommand('users get --debug true');
      assertEqual(parsed.flags['debug'], true, 'debug true');
    }
  );

  // Test 5: Boolean false — should be omitted
  await test(
    'parses boolean false (omitted)',
    () => {
      const parsed = parseCommand('users get --debug false');
      assertEqual(parsed.flags['debug'], undefined, 'debug false omitted');
    }
  );

  // Test 6: Boolean flag without value (implicitly true)
  await test(
    'parses boolean flag without value',
    () => {
      const parsed = parseCommand('users get --debug');
      assertEqual(parsed.flags['debug'], true, 'debug implicit true');
    }
  );

  // Test 7: Quoted flag value
  await test(
    'parses quoted flag value',
    () => {
      const parsed = parseCommand('users create --name "John Doe" --email "john@example.com"');
      assertEqual(parsed.flags['name'], 'John Doe', 'quoted name');
      assertEqual(parsed.flags['email'], 'john@example.com', 'quoted email');
    }
  );

  // Test 8: Single-quoted flag value
  await test(
    'parses single-quoted flag value',
    () => {
      const parsed = parseCommand("users create --name 'Jane'");
      assertEqual(parsed.flags['name'], 'Jane', 'single-quoted name');
    }
  );

  // Test 9: Empty command
  await test(
    'handles empty command',
    () => {
      const parsed = parseCommand('');
      assertEqual(parsed.resource, '', 'empty resource');
      assertEqual(parsed.func, '', 'empty function');
    }
  );

  // Test 10: Only resource (no function)
  await test(
    'handles resource only',
    () => {
      const parsed = parseCommand('users');
      assertEqual(parsed.resource, 'users', 'resource');
      assertEqual(parsed.func, '', 'no function');
    }
  );

  // Test 11: Flags with special characters
  await test(
    'parses flags with special characters',
    () => {
      const parsed = parseCommand('users get --id "abc-123_xyz"');
      assertEqual(parsed.flags['id'], 'abc-123_xyz', 'special chars in flag');
    }
  );

  // Test 12: Multiple boolean flags
  await test(
    'parses multiple boolean flags',
    () => {
      const parsed = parseCommand('users get --debug --verbose --id 1');
      assertEqual(parsed.flags['debug'], true, 'debug true');
      assertEqual(parsed.flags['verbose'], true, 'verbose true');
      assertEqual(parsed.flags['id'], '1', 'id value');
    }
  );
}

// ──────────────────────────────────────────────
// resolveOperation tests
// ──────────────────────────────────────────────

async function testResolveOperation(): Promise<void> {
  console.log('\nTesting resolveOperation...\n');

  // Test 1: Simple GET with path param
  await test(
    'resolves GET with path parameter',
    () => {
      const map = buildCommandMap(sampleSpec);
      const parsed: ParsedCommand = { resource: 'users', func: 'get', flags: { id: '42' } };
      const op = resolveOperation(parsed, map, sampleSpec);
      assertEqual(op.path, '/users/42', 'resolved path');
      assertEqual(op.method, 'GET', 'method');
    }
  );

  // Test 2: GET with query params
  await test(
    'resolves GET with query parameters',
    () => {
      const map = buildCommandMap(sampleSpec);
      const parsed: ParsedCommand = { resource: 'users', func: 'list', flags: { limit: '10', offset: '0' } };
      const op = resolveOperation(parsed, map, sampleSpec);
      assertEqual(op.query.limit, '10', 'query limit');
      assertEqual(op.query.offset, '0', 'query offset');
    }
  );

  // Test 3: POST with body params
  await test(
    'resolves POST with body parameters',
    () => {
      const map = buildCommandMap(sampleSpec);
      const parsed: ParsedCommand = { resource: 'users', func: 'create', flags: { name: 'test', email: 'test@test.com', active: true } };
      const op = resolveOperation(parsed, map, sampleSpec);
      assertEqual(op.body?.name, 'test', 'body name');
      assertEqual(op.body?.email, 'test@test.com', 'body email');
      assertEqual(op.body?.active, true, 'body active');
    }
  );

  // Test 4: Boolean true included in body
  await test(
    'includes boolean true in body',
    () => {
      const map = buildCommandMap(sampleSpec);
      const parsed: ParsedCommand = { resource: 'users', func: 'create', flags: { name: 'test', email: 'test@test.com' } };
      const op = resolveOperation(parsed, map, sampleSpec);
      assertEqual(op.body?.active, undefined, 'boolean false omitted from body');
    }
  );

  // Test 5: Boolean true in query
  await test(
    'includes boolean true in query',
    () => {
      const map = buildCommandMap(sampleSpec);
      const parsed: ParsedCommand = { resource: 'users', func: 'update', flags: { id: '1', name: 'foo', debug: true } };
      const op = resolveOperation(parsed, map, sampleSpec);
      assertEqual(op.query.debug, true, 'debug in query');
    }
  );

  // Test 6: Boolean false omitted from query
  await test(
    'omits boolean false from query',
    () => {
      const map = buildCommandMap(sampleSpec);
      const parsed: ParsedCommand = { resource: 'users', func: 'update', flags: { id: '1', name: 'foo', debug: false } };
      const op = resolveOperation(parsed, map, sampleSpec);
      assertEqual(op.query.debug, undefined, 'debug false omitted');
    }
  );

  // Test 7: Unknown resource throws error
  await test(
    'throws error for unknown resource',
    () => {
      const map = buildCommandMap(sampleSpec);
      const parsed: ParsedCommand = { resource: 'unknown', func: 'get', flags: {} };
      try {
        resolveOperation(parsed, map, sampleSpec);
        throw new Error('Should have thrown');
      } catch (err) {
        assertDeepEqual(err instanceof OrcSpecError ? err.message : '', 'Unknown resource: unknown', 'unknown resource error');
      }
    }
  );

  // Test 8: Unknown function throws error
  await test(
    'throws error for unknown function',
    () => {
      const map = buildCommandMap(sampleSpec);
      const parsed: ParsedCommand = { resource: 'users', func: 'unknown', flags: {} };
      try {
        resolveOperation(parsed, map, sampleSpec);
        throw new Error('Should have thrown');
      } catch (err) {
        assertDeepEqual(err instanceof OrcSpecError ? err.message : '', 'Unknown function unknown on resource users', 'unknown function error');
      }
    }
  );
}

// ──────────────────────────────────────────────
// Help text tests
// ──────────────────────────────────────────────

async function testHelpText(): Promise<void> {
  console.log('\nTesting help text generation...\n');

  // Test 1: Service-level help
  await test(
    'help() shows title and resources',
    () => {
      const map = buildCommandMap(sampleSpec);
      const output = help(map, sampleSpec);
      assertEqual(output.includes('Sample API'), true, 'shows title');
      assertEqual(output.includes('users'), true, 'lists users');
      assertEqual(output.includes('tabs'), true, 'lists tabs');
      assertEqual(output.includes('items'), false, 'items not in sample spec');
    }
  );

  // Test 2: Service-level help includes description
  await test(
    'help() includes service description',
    () => {
      const map = buildCommandMap(sampleSpec);
      const output = help(map, sampleSpec);
      assertEqual(output.includes('A sample API for testing'), true, 'includes description');
    }
  );

  // Test 3: Resource-level help
  await test(
    'helpResource() shows resource and functions',
    () => {
      const map = buildCommandMap(sampleSpec);
      const output = helpResource(map, 'users');
      assertEqual(output.includes('Resource: users'), true, 'shows resource name');
      assertEqual(output.includes('get'), true, 'lists get function');
      assertEqual(output.includes('create'), true, 'lists create function');
    }
  );

  // Test 4: Function-level help
  await test(
    'helpFunction() shows function and parameters',
    () => {
      const map = buildCommandMap(sampleSpec);
      const output = helpFunction(map, 'users', 'get');
      assertEqual(output.includes('Function: users get'), true, 'shows function name');
      assertEqual(output.includes('--id'), true, 'lists id param');
      assertEqual(output.includes('string'), true, 'shows param type');
      assertEqual(output.includes('(required)'), true, 'shows required');
    }
  );

  // Test 5: Function help includes example
  await test(
    'helpFunction() includes example with placeholders',
    () => {
      const map = buildCommandMap(sampleSpec);
      const output = helpFunction(map, 'users', 'get');
      assertEqual(output.includes('<id>'), true, 'example has id placeholder');
    }
  );

  // Test 6: Optional parameters shown with brackets
  await test(
    'helpFunction() shows optional params with brackets',
    () => {
      const map = buildCommandMap(sampleSpec);
      const output = helpFunction(map, 'users', 'list');
      assertEqual(output.includes('[--limit'), true, 'optional limit shown with brackets');
    }
  );

  // Test 7: Boolean params shown with [boolean]
  await test(
    'helpFunction() shows boolean params',
    () => {
      const map = buildCommandMap(sampleSpec);
      const output = helpFunction(map, 'users', 'update');
      assertEqual(output.includes('[boolean]'), true, 'boolean param type shown');
    }
  );

  // Test 8: Unknown resource throws error
  await test(
    'helpResource() throws for unknown resource',
    () => {
      const map = buildCommandMap(sampleSpec);
      try {
        helpResource(map, 'unknown');
        throw new Error('Should have thrown');
      } catch (err) {
        assertDeepEqual(err instanceof OrcSpecError ? err.message : '', 'Unknown resource: unknown', 'unknown resource');
      }
    }
  );

  // Test 9: Unknown function throws error
  await test(
    'helpFunction() throws for unknown function',
    () => {
      const map = buildCommandMap(sampleSpec);
      try {
        helpFunction(map, 'users', 'unknown');
        throw new Error('Should have thrown');
      } catch (err) {
        assertDeepEqual(err instanceof OrcSpecError ? err.message : '', 'Unknown function unknown on resource users', 'unknown function');
      }
    }
  );
}

// ──────────────────────────────────────────────
// OrcSpecError tests
// ──────────────────────────────────────────────

async function testOrcSpecError(): Promise<void> {
  console.log('\nTesting OrcSpecError...\n');

  // Test 1: Error name is correct
  await test(
    'OrcSpecError has correct name',
    () => {
      const err = new OrcSpecError('test error');
      assertEqual(err.name, 'OrcSpecError', 'error name');
    }
  );

  // Test 2: Error message is preserved
  await test(
    'OrcSpecError preserves message',
    () => {
      const err = new OrcSpecError('spec not found');
      assertEqual(err.message, 'spec not found', 'error message');
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa OpenAPI Spec Parser / Command Map Builder Tests ===\n');

  await testBuildCommandMap();
  await testParseCommand();
  await testResolveOperation();
  await testHelpText();
  await testOrcSpecError();

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Test runner error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
