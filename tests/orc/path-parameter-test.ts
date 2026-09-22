#!/usr/bin/env ts-node
/**
 * Tests for path parameter resolution in resolveResourceAndFunction()
 *
 * The fix replaces greedy regex /{.*}\// with non-greedy /\{[^/]*\}/g
 * in resolveResourceAndFunction() at line 284 of src/orc/client.ts,
 * so each path param placeholder is stripped independently without
 * swallowing intermediate segments.
 *
 * Run with: npx ts-node tests/orc/path-parameter-test.ts
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

function assertThrows(fn: () => void, expectedMsg?: string): void {
  let caught: string = '';
  try {
    fn();
  } catch (err) {
    caught = err instanceof Error ? err.message : String(err);
  }
  if (!caught) {
    throw new Error(`Expected function to throw, but it did not`);
  }
  if (expectedMsg && !caught.includes(expectedMsg)) {
    throw new Error(`Expected message "${expectedMsg}" not found in "${caught}"`);
  }
}

// ──────────────────────────────────────────────
// Minimal OpenAPI spec builder
// ──────────────────────────────────────────────

function makeSpec(paths: Record<string, Record<string, { operationId?: string; summary?: string; description?: string; parameters?: any[]; requestBody?: any }>>): any {
  return {
    openapi: '3.0.0',
    info: { title: 'Test API', description: 'Test spec' },
    servers: [{ url: 'http://localhost:8080' }],
    paths: paths,
  };
}

// ──────────────────────────────────────────────
// Test 1: Simple single-segment path (no path params)
// ──────────────────────────────────────────────

async function test1(): Promise<void> {
  console.log('\nTest 1: Simple single-segment path (no path params)\n');
  const spec = makeSpec({
    '/users': {
      get: { operationId: 'listUsers', summary: 'List users' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  assertEqual(cmdMap.users.name, 'users', 'resource name');
  assertEqual(cmdMap.users.functions.get.name, 'get', 'function name');
}

// ──────────────────────────────────────────────
// Test 2: Two-segment path with path param in second segment
// ──────────────────────────────────────────────

async function test2(): Promise<void> {
  console.log('\nTest 2: Two-segment path with path param in second segment\n');
  const spec = makeSpec({
    '/users/{id}': {
      get: { operationId: 'getUser', summary: 'Get user' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // The regex strip {id} -> empty string, so segments after filter: ["users"]
  // segments.length === 1, so resource = "users", func = "get"
  assertEqual(cmdMap.users.name, 'users', 'resource name');
  assertEqual(cmdMap.users.functions.get.name, 'get', 'function name');
}

// ──────────────────────────────────────────────
// Test 3: Two-segment path with path param in first segment
// ──────────────────────────────────────────────

async function test3(): Promise<void> {
  console.log('\nTest 3: Two-segment path with path param in first segment\n');
  const spec = makeSpec({
    '/{resource}/posts': {
      get: { operationId: 'getPosts', summary: 'Get posts' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // Strip {resource} -> empty, segments: ["posts"]
  // segments.length === 1, so resource = "posts", func = "get"
  assertEqual(cmdMap.posts.name, 'posts', 'resource name');
  assertEqual(cmdMap.posts.functions.get.name, 'get', 'function name');
}

// ──────────────────────────────────────────────
// Test 4: Three-segment path with path params (the key fix scenario)
// ──────────────────────────────────────────────

async function test4(): Promise<void> {
  console.log('\nTest 4: Three-segment path with path params\n');
  const spec = makeSpec({
    '/users/{userId}/posts/{postId}': {
      get: { operationId: 'getPost', summary: 'Get post' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // Old greedy regex /{.*}\// would match "{userId}/posts/{postId}" as one
  // and strip it, leaving only "users" as a segment.
  // New non-greedy /\{[^/]*\}/g strips each placeholder independently:
  // "/users/{userId}/posts/{postId}" -> "/users//posts//" -> segments: ["users", "posts"]
  // segments.length >= 2, so resource = "users", second = "posts"
  // second segment is not method, not resource, not starts with "{" -> func = "posts"
  assertEqual(cmdMap.users.name, 'users', 'resource name');
  assertEqual(cmdMap.users.functions.posts.name, 'posts', 'function name');
}

// ──────────────────────────────────────────────
// Test 5: Four-segment path with multiple path params
// ──────────────────────────────────────────────

async function test5(): Promise<void> {
  console.log('\nTest 5: Four-segment path with multiple path params\n');
  const spec = makeSpec({
    '/users/{userId}/posts/{postId}/comments/{commentId}': {
      get: { operationId: 'getComment', summary: 'Get comment' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // After stripping: "users", "posts", "comments"
  // segments[0] = "users", segments[1] = "posts"
  assertEqual(cmdMap.users.name, 'users', 'resource name');
  assertEqual(cmdMap.users.functions.posts.name, 'posts', 'function name');
}

// ──────────────────────────────────────────────
// Test 6: Path param with special characters in name
// ──────────────────────────────────────────────

async function test6(): Promise<void> {
  console.log('\nTest 6: Path param with special characters in name\n');
  const spec = makeSpec({
    '/users/{user_id}/posts/{post-id}': {
      get: { operationId: 'getPosts', summary: 'Get posts' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // {user_id} and {post-id} should be stripped correctly
  assertEqual(cmdMap.users.name, 'users', 'resource name');
  assertEqual(cmdMap.users.functions.posts.name, 'posts', 'function name');
}

// ──────────────────────────────────────────────
// Test 7: Path with consecutive path params
// ──────────────────────────────────────────────

async function test7(): Promise<void> {
  console.log('\nTest 7: Path with consecutive path params\n');
  const spec = makeSpec({
    '/{org}/{repo}': {
      get: { operationId: 'getRepo', summary: 'Get repo' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // Both segments are path params, so after stripping: []
  // segments.length === 0, so default: resource = "default", func = "get"
  assertEqual(cmdMap.default.name, 'default', 'resource name');
  assertEqual(cmdMap.default.functions.get.name, 'get', 'function name');
}

// ──────────────────────────────────────────────
// Test 8: Path param in middle with static segments
// ──────────────────────────────────────────────

async function test8(): Promise<void> {
  console.log('\nTest 8: Path param in middle with static segments\n');
  const spec = makeSpec({
    '/api/v1/users/{id}': {
      get: { operationId: 'getUser', summary: 'Get user' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // After stripping: "api", "v1", "users"
  // segments[0] = "api", segments[1] = "v1"
  assertEqual(cmdMap.api.name, 'api', 'resource name');
  assertEqual(cmdMap.api.functions.v1.name, 'v1', 'function name');
}

// ──────────────────────────────────────────────
// Test 9: BuildParamDefs - extract path param names from template
// ──────────────────────────────────────────────

async function test9(): Promise<void> {
  console.log('\nTest 9: buildParamDefs extracts path param names\n');
  const spec = makeSpec({
    '/users/{userId}/posts/{postId}': {
      get: {
        operationId: 'getPost',
        summary: 'Get post',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'postId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'verbose', in: 'query', schema: { type: 'boolean' } },
        ],
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  const postParams = cmdMap.users.functions.posts.params;
  assertEqual(postParams.length, 3, 'param count');
  const paramNames = postParams.map((p: any) => p.name).sort();
  assertEqual(paramNames, ['postId', 'userId', 'verbose'], 'param names');
}

// ──────────────────────────────────────────────
// Test 10: resolveOperation - path param replacement
// ──────────────────────────────────────────────

async function test10(): Promise<void> {
  console.log('\nTest 10: resolveOperation replaces path params with flag values\n');
  const spec = makeSpec({
    '/users/{userId}/posts/{postId}': {
      get: {
        operationId: 'getPost',
        summary: 'Get post',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'postId', in: 'path', required: true, schema: { type: 'string' } },
        ],
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('users posts --userId 42 --postId 99');
  const resolved = resolveOperation(parsed, cmdMap, spec);
  assertEqual(resolved.path, '/users/42/posts/99', 'resolved path');
}

// ──────────────────────────────────────────────
// Test 11: Empty path param value handling
// ──────────────────────────────────────────────

async function test11(): Promise<void> {
  console.log('\nTest 11: Empty path param value in resolve\n');
  const spec = makeSpec({
    '/users/{id}': {
      get: {
        operationId: 'getUser',
        summary: 'Get user',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('users get --id ');
  const resolved = resolveOperation(parsed, cmdMap, spec);
  // Empty string value should still be used (not skipped)
  assertEqual(resolved.path, '/users/', 'empty path param value');
}

// ──────────────────────────────────────────────
// Test 12: Path param with special characters in value
// ──────────────────────────────────────────────

async function test12(): Promise<void> {
  console.log('\nTest 12: Path param with special characters in value\n');
  const spec = makeSpec({
    '/users/{id}': {
      get: {
        operationId: 'getUser',
        summary: 'Get user',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('users get --id "user@example.com"');
  const resolved = resolveOperation(parsed, cmdMap, spec);
  assertEqual(resolved.path, '/users/user@example.com', 'special chars in path param');
}

// ──────────────────────────────────────────────
// Test 13: Missing required path param throws error
// ──────────────────────────────────────────────

async function test13(): Promise<void> {
  console.log('\nTest 13: Missing required path param throws error\n');
  const spec = makeSpec({
    '/users/{id}': {
      get: {
        operationId: 'getUser',
        summary: 'Get user',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('users get');
  assertThrows(() => resolveOperation(parsed, cmdMap, spec), 'Missing required path parameter');
}

// ──────────────────────────────────────────────
// Test 14: Deep nesting with 5 path params
// ──────────────────────────────────────────────

async function test14(): Promise<void> {
  console.log('\nTest 14: Deep nesting with 5 path params\n');
  const spec = makeSpec({
    '/org/{orgId}/projects/{projectId}/repos/{repoId}/files/{fileId}/content': {
      get: {
        operationId: 'getFileContent',
        summary: 'Get file content',
        parameters: [
          { name: 'orgId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'repoId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'fileId', in: 'path', required: true, schema: { type: 'string' } },
        ],
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // After stripping: "org", "projects", "repos", "files", "content"
  // segments[0] = "org", segments[1] = "projects"
  assertEqual(cmdMap.org.name, 'org', 'resource name');
  assertEqual(cmdMap.org.functions.projects.name, 'projects', 'function name');
}

// ──────────────────────────────────────────────
// Test 15: HTTP method as second segment
// ──────────────────────────────────────────────

async function test15(): Promise<void> {
  console.log('\nTest 15: HTTP method as second segment uses method as function\n');
  const spec = makeSpec({
    '/users/delete': {
      delete: { operationId: 'deleteUser', summary: 'Delete user' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // segments: ["users", "delete"], secondSegment = "delete", method = "delete"
  // secondSegment === methodLower -> func = "delete"
  assertEqual(cmdMap.users.name, 'users', 'resource name');
  assertEqual(cmdMap.users.functions.delete.name, 'delete', 'function name');
}

// ──────────────────────────────────────────────
// Test 16: Path param name matches second segment
// ──────────────────────────────────────────────

async function test16(): Promise<void> {
  console.log('\nTest 16: Path param name matches second segment\n');
  const spec = makeSpec({
    '/users/{users}': {
      get: { operationId: 'getUsers', summary: 'Get users' },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // After stripping {users}: segments: ["users"]
  // segments.length === 1, so resource = "users", func = "get"
  assertEqual(cmdMap.users.name, 'users', 'resource name');
  assertEqual(cmdMap.users.functions.get.name, 'get', 'function name');
}

// ──────────────────────────────────────────────
// Test 17: Case sensitivity of path params
// ──────────────────────────────────────────────

async function test17(): Promise<void> {
  console.log('\nTest 17: Case sensitivity of path param names\n');
  const spec = makeSpec({
    '/Users/{UserID}/Posts/{PostID}': {
      get: {
        operationId: 'getPosts',
        summary: 'Get posts',
        parameters: [
          { name: 'UserID', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'PostID', in: 'path', required: true, schema: { type: 'string' } },
        ],
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  // After stripping: "Users", "Posts" -> lowercased: "users", "posts"
  assertEqual(cmdMap.users.name, 'users', 'resource name');
  assertEqual(cmdMap.users.functions.posts.name, 'posts', 'function name');
}

// ──────────────────────────────────────────────
// Test 18: resolveOperation with query params
// ──────────────────────────────────────────────

async function test18(): Promise<void> {
  console.log('\nTest 18: resolveOperation includes query params\n');
  const spec = makeSpec({
    '/users/{id}': {
      get: {
        operationId: 'getUser',
        summary: 'Get user',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'expand', in: 'query', schema: { type: 'string' } },
        ],
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('users get --id 42 --expand name,email');
  const resolved = resolveOperation(parsed, cmdMap, spec);
  assertEqual(resolved.path, '/users/42', 'resolved path');
  assertEqual(resolved.query, { expand: 'name,email' }, 'query params');
}

// ──────────────────────────────────────────────
// Test 19: resolveOperation with body params
// ──────────────────────────────────────────────

async function test19(): Promise<void> {
  console.log('\nTest 19: resolveOperation includes body params\n');
  const spec = makeSpec({
    '/users/{id}': {
      post: {
        operationId: 'updateUser',
        summary: 'Update user',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                properties: { name: { type: 'string' }, age: { type: 'number' } },
                required: ['name'],
              },
            },
          },
        },
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('users post --id 42 --name "John" --age 30');
  const resolved = resolveOperation(parsed, cmdMap, spec);
  assertEqual(resolved.path, '/users/42', 'resolved path');
  assertEqual(resolved.body, { name: 'John', age: 30 }, 'body params');
}

// ──────────────────────────────────────────────
// Test 20: Boolean parameter handling
// ──────────────────────────────────────────────

async function test20(): Promise<void> {
  console.log('\nTest 20: Boolean parameter false omits the flag\n');
  const spec = makeSpec({
    '/users/{id}': {
      get: {
        operationId: 'getUser',
        summary: 'Get user',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'includeDeleted', in: 'query', schema: { type: 'boolean' } },
        ],
      },
    },
  });
  const cmdMap = buildCommandMap(spec);
  const parsed = parseCommand('users get --id 42 --includeDeleted false');
  const resolved = resolveOperation(parsed, cmdMap, spec);
  // Boolean false means omit the flag
  assertEqual(resolved.query, {}, 'boolean false omits flag');
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa Path Parameter Resolution Tests ===');
  console.log('Testing fix: greedy /{.*}\// -> non-greedy /\\{[^/]*\}/g\n');

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
    { name: 'Test 16', fn: test16 },
    { name: 'Test 17', fn: test17 },
    { name: 'Test 18', fn: test18 },
    { name: 'Test 19', fn: test19 },
    { name: 'Test 20', fn: test20 },
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
