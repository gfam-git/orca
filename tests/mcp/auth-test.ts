#!/usr/bin/env ts-node
/**
 * Tests for authentication environment variable parsing and header injection.
 *
 * Run with: npx ts-node tests/mcp/auth-test.ts
 */

import {
  parseAuthConfig,
  injectAuthHeaders,
  injectApiKeyQuery,
} from '../../src/orc/auth';
import { AuthConfig, SecurityScheme } from '../../src/orc/types';

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

function assertNotDefined(actual: unknown, msg?: string): void {
  if (actual !== undefined) {
    throw new Error(
      msg
        ? `${msg}\n    Expected: undefined\n    Actual:   ${JSON.stringify(actual)}`
        : `Expected: undefined\n    Actual:   ${JSON.stringify(actual)}`
    );
  }
}

// ──────────────────────────────────────────────
// parseAuthConfig tests — ORCA_AUTH_METHOD=bearer
// ──────────────────────────────────────────────

async function testBearerAuth(): Promise<void> {
  console.log('\nTesting ORCA_AUTH_METHOD=bearer...\n');

  // Test 1: Basic bearer token from env
  await test(
    'parses bearer auth from ORCA_AUTH_METHOD=bearer',
    () => {
      process.env.ORCA_AUTH_METHOD = 'bearer';
      process.env.ORCA_AUTH_BEARER_TOKEN = 'my-secret-token';
      const config = parseAuthConfig();
      assertEqual(config.method, 'bearer', 'method');
      assertEqual(config.bearerToken, 'my-secret-token', 'token');
      assertNotDefined(config.basicUsername, 'no basic username');
      assertNotDefined(config.basicPassword, 'no basic password');
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_BEARER_TOKEN = '';
    }
  );

  // Test 2: Missing bearer token throws
  await test(
    'throws when ORCA_AUTH_METHOD=bearer but ORCA_AUTH_BEARER_TOKEN is missing',
    () => {
      process.env.ORCA_AUTH_METHOD = 'bearer';
      process.env.ORCA_AUTH_BEARER_TOKEN = '';
      let threw = false;
      try {
        parseAuthConfig();
      } catch (err) {
        threw = true;
        if (!(err instanceof Error) || !err.message.includes('ORCA_AUTH_BEARER_TOKEN')) {
          throw new Error(`Expected message about ORCA_AUTH_BEARER_TOKEN, got: ${err}`);
        }
      }
      if (!threw) {
        throw new Error('Expected parseAuthConfig to throw');
      }
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_BEARER_TOKEN = '';
    }
  );

  // Test 3: Empty bearer token throws
  await test(
    'throws when ORCA_AUTH_BEARER_TOKEN is empty',
    () => {
      process.env.ORCA_AUTH_METHOD = 'bearer';
      process.env.ORCA_AUTH_BEARER_TOKEN = '   ';
      let threw = false;
      try {
        parseAuthConfig();
      } catch (err) {
        threw = true;
      }
      if (!threw) {
        throw new Error('Expected parseAuthConfig to throw');
      }
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_BEARER_TOKEN = '';
    }
  );
}

// ──────────────────────────────────────────────
// parseAuthConfig tests — ORCA_AUTH_METHOD=basic
// ──────────────────────────────────────────────

async function testBasicAuth(): Promise<void> {
  console.log('\nTesting ORCA_AUTH_METHOD=basic...\n');

  // Test 1: Basic auth from env
  await test(
    'parses basic auth from ORCA_AUTH_METHOD=basic',
    () => {
      process.env.ORCA_AUTH_METHOD = 'basic';
      process.env.ORCA_AUTH_BASIC_USERNAME = 'testuser';
      process.env.ORCA_AUTH_BASIC_PASSWORD = 'testpass';
      const config = parseAuthConfig();
      assertEqual(config.method, 'basic', 'method');
      assertEqual(config.basicUsername, 'testuser', 'username');
      assertEqual(config.basicPassword, 'testpass', 'password');
      assertNotDefined(config.bearerToken, 'no bearer token');
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_BASIC_USERNAME = '';
      process.env.ORCA_AUTH_BASIC_PASSWORD = '';
    }
  );

  // Test 2: Missing basic username throws
  await test(
    'throws when ORCA_AUTH_METHOD=basic but ORCA_AUTH_BASIC_USERNAME is missing',
    () => {
      process.env.ORCA_AUTH_METHOD = 'basic';
      process.env.ORCA_AUTH_BASIC_USERNAME = '';
      process.env.ORCA_AUTH_BASIC_PASSWORD = 'testpass';
      let threw = false;
      try {
        parseAuthConfig();
      } catch (err) {
        threw = true;
        if (!(err instanceof Error) || !err.message.includes('ORCA_AUTH_BASIC_USERNAME')) {
          throw new Error(`Expected message about ORCA_AUTH_BASIC_USERNAME, got: ${err}`);
        }
      }
      if (!threw) {
        throw new Error('Expected parseAuthConfig to throw');
      }
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_BASIC_USERNAME = '';
      process.env.ORCA_AUTH_BASIC_PASSWORD = '';
    }
  );

  // Test 3: Missing basic password throws
  await test(
    'throws when ORCA_AUTH_METHOD=basic but ORCA_AUTH_BASIC_PASSWORD is missing',
    () => {
      process.env.ORCA_AUTH_METHOD = 'basic';
      process.env.ORCA_AUTH_BASIC_USERNAME = 'testuser';
      process.env.ORCA_AUTH_BASIC_PASSWORD = '';
      let threw = false;
      try {
        parseAuthConfig();
      } catch (err) {
        threw = true;
        if (!(err instanceof Error) || !err.message.includes('ORCA_AUTH_BASIC_PASSWORD')) {
          throw new Error(`Expected message about ORCA_AUTH_BASIC_PASSWORD, got: ${err}`);
        }
      }
      if (!threw) {
        throw new Error('Expected parseAuthConfig to throw');
      }
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_BASIC_USERNAME = '';
      process.env.ORCA_AUTH_BASIC_PASSWORD = '';
    }
  );
}

// ──────────────────────────────────────────────
// parseAuthConfig tests — ORCA_AUTH_METHOD=apikey
// ──────────────────────────────────────────────

async function testApiKeyAuth(): Promise<void> {
  console.log('\nTesting ORCA_AUTH_METHOD=apikey...\n');

  // Test 1: Basic apikey header injection
  await test(
    'parses apikey auth from ORCA_AUTH_METHOD=apikey with default header',
    () => {
      process.env.ORCA_AUTH_METHOD = 'apikey';
      process.env.ORCA_AUTH_APIKEY_NAME = 'X-API-Key';
      process.env.ORCA_AUTH_APIKEY_VALUE = 'my-api-key-123';
      process.env.ORCA_AUTH_APIKEY_IN = '';
      const config = parseAuthConfig();
      assertEqual(config.method, 'apikey', 'method');
      assertEqual(config.apikeyName, 'X-API-Key', 'apikey name');
      assertEqual(config.apikeyValue, 'my-api-key-123', 'apikey value');
      assertEqual(config.apikeyIn, 'header', 'apikey in defaults to header');
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_APIKEY_NAME = '';
      process.env.ORCA_AUTH_APIKEY_VALUE = '';
      process.env.ORCA_AUTH_APIKEY_IN = '';
    }
  );

  // Test 2: Apikey in query
  await test(
    'parses apikey auth with ORCA_AUTH_APIKEY_IN=query',
    () => {
      process.env.ORCA_AUTH_METHOD = 'apikey';
      process.env.ORCA_AUTH_APIKEY_NAME = 'api_key';
      process.env.ORCA_AUTH_APIKEY_VALUE = 'my-api-key-123';
      process.env.ORCA_AUTH_APIKEY_IN = 'query';
      const config = parseAuthConfig();
      assertEqual(config.apikeyIn, 'query', 'apikey in query');
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_APIKEY_NAME = '';
      process.env.ORCA_AUTH_APIKEY_VALUE = '';
      process.env.ORCA_AUTH_APIKEY_IN = '';
    }
  );

  // Test 3: Apikey in cookie
  await test(
    'parses apikey auth with ORCA_AUTH_APIKEY_IN=cookie',
    () => {
      process.env.ORCA_AUTH_METHOD = 'apikey';
      process.env.ORCA_AUTH_APIKEY_NAME = 'session_token';
      process.env.ORCA_AUTH_APIKEY_VALUE = 'abc123';
      process.env.ORCA_AUTH_APIKEY_IN = 'cookie';
      const config = parseAuthConfig();
      assertEqual(config.apikeyIn, 'cookie', 'apikey in cookie');
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_APIKEY_NAME = '';
      process.env.ORCA_AUTH_APIKEY_VALUE = '';
      process.env.ORCA_AUTH_APIKEY_IN = '';
    }
  );

  // Test 4: Missing apikey name throws
  await test(
    'throws when ORCA_AUTH_METHOD=apikey but ORCA_AUTH_APIKEY_NAME is missing',
    () => {
      process.env.ORCA_AUTH_METHOD = 'apikey';
      process.env.ORCA_AUTH_APIKEY_NAME = '';
      process.env.ORCA_AUTH_APIKEY_VALUE = 'my-api-key-123';
      let threw = false;
      try {
        parseAuthConfig();
      } catch (err) {
        threw = true;
        if (!(err instanceof Error) || !err.message.includes('ORCA_AUTH_APIKEY_NAME')) {
          throw new Error(`Expected message about ORCA_AUTH_APIKEY_NAME, got: ${err}`);
        }
      }
      if (!threw) {
        throw new Error('Expected parseAuthConfig to throw');
      }
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_APIKEY_NAME = '';
      process.env.ORCA_AUTH_APIKEY_VALUE = '';
      process.env.ORCA_AUTH_APIKEY_IN = '';
    }
  );

  // Test 5: Missing apikey value throws
  await test(
    'throws when ORCA_AUTH_METHOD=apikey but ORCA_AUTH_APIKEY_VALUE is missing',
    () => {
      process.env.ORCA_AUTH_METHOD = 'apikey';
      process.env.ORCA_AUTH_APIKEY_NAME = 'X-API-Key';
      process.env.ORCA_AUTH_APIKEY_VALUE = '';
      let threw = false;
      try {
        parseAuthConfig();
      } catch (err) {
        threw = true;
        if (!(err instanceof Error) || !err.message.includes('ORCA_AUTH_APIKEY_VALUE')) {
          throw new Error(`Expected message about ORCA_AUTH_APIKEY_VALUE, got: ${err}`);
        }
      }
      if (!threw) {
        throw new Error('Expected parseAuthConfig to throw');
      }
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_APIKEY_NAME = '';
      process.env.ORCA_AUTH_APIKEY_VALUE = '';
      process.env.ORCA_AUTH_APIKEY_IN = '';
    }
  );
}

// ──────────────────────────────────────────────
// parseAuthConfig tests — ORCA_AUTH_METHOD=none
// ──────────────────────────────────────────────

async function testNoneAuth(): Promise<void> {
  console.log('\nTesting ORCA_AUTH_METHOD=none...\n');

  // Test 1: No auth required
  await test(
    'parses no auth from ORCA_AUTH_METHOD=none',
    () => {
      process.env.ORCA_AUTH_METHOD = 'none';
      const config = parseAuthConfig();
      assertEqual(config.method, 'none', 'method');
      assertNotDefined(config.bearerToken, 'no bearer token');
      assertNotDefined(config.basicUsername, 'no basic username');
      assertNotDefined(config.basicPassword, 'no basic password');
      assertNotDefined(config.apikeyName, 'no apikey name');
      assertNotDefined(config.apikeyValue, 'no apikey value');
      process.env.ORCA_AUTH_METHOD = '';
    }
  );
}

// ──────────────────────────────────────────────
// parseAuthConfig tests — unsupported method
// ──────────────────────────────────────────────

async function testUnsupportedMethod(): Promise<void> {
  console.log('\nTesting unsupported ORCA_AUTH_METHOD...\n');

  // Test 1: Unsupported method throws
  await test(
    'throws when ORCA_AUTH_METHOD is unsupported',
    () => {
      process.env.ORCA_AUTH_METHOD = 'oauth2';
      let threw = false;
      try {
        parseAuthConfig();
      } catch (err) {
        threw = true;
        if (!(err instanceof Error) || !err.message.includes('Unsupported auth method')) {
          throw new Error(`Expected message about unsupported method, got: ${err}`);
        }
      }
      if (!threw) {
        throw new Error('Expected parseAuthConfig to throw');
      }
      process.env.ORCA_AUTH_METHOD = '';
    }
  );
}

// ──────────────────────────────────────────────
// parseAuthConfig tests — spec securitySchemes inference
// ──────────────────────────────────────────────

async function testSpecInference(): Promise<void> {
  console.log('\nTesting auth inference from OpenAPI securitySchemes...\n');

  // Test 1: Bearer from spec
  await test(
    'infers bearer auth from spec securitySchemes',
    () => {
      const schemes: Record<string, SecurityScheme> = {
        'BearerAuth': { type: 'http', scheme: 'bearer' },
      };
      const config = parseAuthConfig(schemes);
      assertEqual(config.method, 'bearer', 'inferred bearer');
    }
  );

  // Test 2: Basic from spec
  await test(
    'infers basic auth from spec securitySchemes',
    () => {
      const schemes: Record<string, SecurityScheme> = {
        'BasicAuth': { type: 'http', scheme: 'basic' },
      };
      const config = parseAuthConfig(schemes);
      assertEqual(config.method, 'basic', 'inferred basic');
    }
  );

  // Test 3: ApiKey from spec
  await test(
    'infers apikey auth from spec securitySchemes',
    () => {
      const schemes: Record<string, SecurityScheme> = {
        'ApiKeyAuth': { type: 'apiKey', name: 'X-API-Key', in: 'header' },
      };
      const config = parseAuthConfig(schemes);
      assertEqual(config.method, 'apikey', 'inferred apikey');
    }
  );

  // Test 4: No schemes → none
  await test(
    'defaults to none when no securitySchemes in spec',
    () => {
      const config = parseAuthConfig(undefined);
      assertEqual(config.method, 'none', 'no schemes defaults to none');
    }
  );

  // Test 5: Empty schemes → none
  await test(
    'defaults to none when securitySchemes is empty object',
    () => {
      const config = parseAuthConfig({});
      assertEqual(config.method, 'none', 'empty schemes defaults to none');
    }
  );

  // Test 6: Env override takes precedence over spec
  await test(
    'ORCA_AUTH_METHOD env overrides spec securitySchemes',
    () => {
      const schemes: Record<string, SecurityScheme> = {
        'BearerAuth': { type: 'http', scheme: 'bearer' },
      };
      process.env.ORCA_AUTH_METHOD = 'basic';
      process.env.ORCA_AUTH_BASIC_USERNAME = 'user';
      process.env.ORCA_AUTH_BASIC_PASSWORD = 'pass';
      const config = parseAuthConfig(schemes);
      assertEqual(config.method, 'basic', 'env overrides spec');
      process.env.ORCA_AUTH_METHOD = '';
      process.env.ORCA_AUTH_BASIC_USERNAME = '';
      process.env.ORCA_AUTH_BASIC_PASSWORD = '';
    }
  );
}

// ──────────────────────────────────────────────
// injectAuthHeaders tests
// ──────────────────────────────────────────────

async function testInjectAuthHeaders(): Promise<void> {
  console.log('\nTesting injectAuthHeaders...\n');

  // Test 1: No-op for none
  await test(
    'injectAuthHeaders does nothing for method=none',
    () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const config: AuthConfig = { method: 'none' };
      injectAuthHeaders(headers, config);
      assertEqual(headers['Authorization'], undefined, 'no auth header for none');
    }
  );

  // Test 2: Bearer injection
  await test(
    'injects Authorization header for bearer auth',
    () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const config: AuthConfig = { method: 'bearer', bearerToken: 'my-token' };
      injectAuthHeaders(headers, config);
      assertEqual(headers['Authorization'], 'Bearer my-token', 'bearer auth header');
    }
  );

  // Test 3: Basic injection
  await test(
    'injects Authorization header for basic auth',
    () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const config: AuthConfig = { method: 'basic', basicUsername: 'user', basicPassword: 'pass' };
      injectAuthHeaders(headers, config);
      const expectedCreds = Buffer.from('user:pass').toString('base64');
      assertEqual(headers['Authorization'], `Basic ${expectedCreds}`, 'basic auth header');
    }
  );

  // Test 4: ApiKey header injection
  await test(
    'injects custom header for apikey auth (header mode)',
    () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const config: AuthConfig = { method: 'apikey', apikeyName: 'X-API-Key', apikeyValue: 'abc123', apikeyIn: 'header' };
      injectAuthHeaders(headers, config);
      assertEqual(headers['X-API-Key'], 'abc123', 'apikey header');
    }
  );

  // Test 5: ApiKey cookie injection
  await test(
    'injects Cookie header for apikey auth (cookie mode)',
    () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const config: AuthConfig = { method: 'apikey', apikeyName: 'session_token', apikeyValue: 'xyz789', apikeyIn: 'cookie' };
      injectAuthHeaders(headers, config);
      assertEqual(headers['Cookie'], 'session_token=xyz789', 'apikey cookie');
    }
  );
}

// ──────────────────────────────────────────────
// injectApiKeyQuery tests
// ──────────────────────────────────────────────

async function testInjectApiKeyQuery(): Promise<void> {
  console.log('\nTesting injectApiKeyQuery...\n');

  // Test 1: No-op for none
  await test(
    'injectApiKeyQuery does nothing for method=none',
    () => {
      const query: Record<string, string | number | boolean> = {};
      const config: AuthConfig = { method: 'none' };
      injectApiKeyQuery(query, config);
      assertEqual(Object.keys(query).length, 0, 'no query params for none');
    }
  );

  // Test 2: ApiKey query injection
  await test(
    'injects apikey as query param for apikey auth (query mode)',
    () => {
      const query: Record<string, string | number | boolean> = { id: '123' };
      const config: AuthConfig = { method: 'apikey', apikeyName: 'api_key', apikeyValue: 'abc123', apikeyIn: 'query' };
      injectApiKeyQuery(query, config);
      assertEqual(query['api_key'], 'abc123', 'apikey query param');
    }
  );

  // Test 3: ApiKey header mode does not modify query
  await test(
    'injectApiKeyQuery does nothing for apikey auth (header mode)',
    () => {
      const query: Record<string, string | number | boolean> = { id: '123' };
      const config: AuthConfig = { method: 'apikey', apikeyName: 'X-API-Key', apikeyValue: 'abc123', apikeyIn: 'header' };
      injectApiKeyQuery(query, config);
      assertEqual(Object.keys(query).length, 1, 'no query params for header mode');
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa Authentication Tests ===');

  await testBearerAuth();
  await testBasicAuth();
  await testApiKeyAuth();
  await testNoneAuth();
  await testUnsupportedMethod();
  await testSpecInference();
  await testInjectAuthHeaders();
  await testInjectApiKeyQuery();

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Test runner error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
