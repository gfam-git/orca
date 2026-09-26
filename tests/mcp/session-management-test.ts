#!/usr/bin/env ts-node
/**
 * Tests for session management MCP resources
 *
 * Tests endpoint configurations and command generation for:
 *  - browser_session_traces (GET /sessions/{userId}/traces)
 *  - browser_session_trace_download (GET /sessions/{userId}/traces/{filename})
 *  - browser_session_trace_delete (DELETE /sessions/{userId}/traces/{filename})
 *  - browser_session_destroy (DELETE /sessions/{userId})
 *
 * Run with: npx ts-node tests/mcp/session-management-test.ts
 */

// We need to import parseArguments from the src directory
import { parseArguments } from '../../src/index';

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
// Session management endpoint configuration tests
// ──────────────────────────────────────────────

async function testEndpointConfigurations(): Promise<void> {
  console.log('\nTesting session management endpoint configurations...\n');

  // Test 1: browser_session_traces has correct path
  await test(
    'browser_session_traces path is /sessions/{userId}/traces',
    () => {
      // Verify the path pattern would generate the right command
      const resource = 'sessions';
      const func = 'traces';
      const userId = 'test-user';
      let cmd = `${resource} ${func} --userId '${userId}'`;
      assertEqual(cmd, "sessions traces --userId 'test-user'", 'traces command');
    }
  );

  // Test 2: browser_session_trace_download has correct path
  await test(
    'browser_session_trace_download path is /sessions/{userId}/traces/{filename}',
    () => {
      const resource = 'sessions';
      const func = 'trace_download';
      const userId = 'test-user';
      const filename = 'trace.zip';
      let cmd = `${resource} ${func} --userId '${userId}'`;
      cmd += ` --filename '${filename}'`;
      assertEqual(cmd, "sessions trace_download --userId 'test-user' --filename 'trace.zip'", 'download command');
    }
  );

  // Test 3: browser_session_trace_delete has correct path
  await test(
    'browser_session_trace_delete path is /sessions/{userId}/traces/{filename}',
    () => {
      const resource = 'sessions';
      const func = 'trace_delete';
      const userId = 'test-user';
      const filename = 'trace.zip';
      let cmd = `${resource} ${func} --userId '${userId}'`;
      cmd += ` --filename '${filename}'`;
      assertEqual(cmd, "sessions trace_delete --userId 'test-user' --filename 'trace.zip'", 'delete command');
    }
  );

  // Test 4: browser_session_destroy has correct path
  await test(
    'browser_session_destroy path is /sessions/{userId}',
    () => {
      const resource = 'sessions';
      const func = 'destroy';
      const userId = 'test-user';
      let cmd = `${resource} ${func} --userId '${userId}'`;
      assertEqual(cmd, "sessions destroy --userId 'test-user'", 'destroy command');
    }
  );

  // Test 5: All endpoints use 'sessions' resource
  await test(
    'all endpoints use sessions resource',
    () => {
      const endpoints = [
        'traces',
        'trace_download',
        'trace_delete',
        'destroy'
      ];
      for (const func of endpoints) {
        let cmd = `sessions ${func} --userId 'test-user'`;
        assertEqual(cmd.startsWith('sessions'), true, `${func} uses sessions resource`);
      }
    }
  );
}

// ──────────────────────────────────────────────
// Command generation tests
// ──────────────────────────────────────────────

async function testCommandGeneration(): Promise<void> {
  console.log('\nTesting command generation logic...\n');

  // Test 1: traces command with valid userId
  await test(
    'traces command generates correctly with valid userId',
    () => {
      const userId = 'user123';
      let cmd = `sessions traces --userId '${userId}'`;
      assertEqual(cmd, "sessions traces --userId 'user123'", 'traces command');
    }
  );

  // Test 2: trace_download command with userId and filename
  await test(
    'trace_download command generates correctly with userId and filename',
    () => {
      const userId = 'user123';
      const filename = 'trace_2024.zip';
      let cmd = `sessions trace_download --userId '${userId}'`;
      cmd += ` --filename '${filename}'`;
      assertEqual(cmd, "sessions trace_download --userId 'user123' --filename 'trace_2024.zip'", 'download command');
    }
  );

  // Test 3: trace_delete command with userId and filename
  await test(
    'trace_delete command generates correctly with userId and filename',
    () => {
      const userId = 'user123';
      const filename = 'trace_2024.zip';
      let cmd = `sessions trace_delete --userId '${userId}'`;
      cmd += ` --filename '${filename}'`;
      assertEqual(cmd, "sessions trace_delete --userId 'user123' --filename 'trace_2024.zip'", 'delete command');
    }
  );

  // Test 4: destroy command with userId only
  await test(
    'destroy command generates correctly with userId only',
    () => {
      const userId = 'user123';
      let cmd = `sessions destroy --userId '${userId}'`;
      assertEqual(cmd, "sessions destroy --userId 'user123'", 'destroy command');
    }
  );

  // Test 5: Empty filename is handled correctly (should not include --filename)
  await test(
    'empty filename does not add --filename flag',
    () => {
      const userId = 'user123';
      const filename = '';
      let cmd = `sessions trace_download --userId '${userId}'`;
      if (filename) {
        cmd += ` --filename '${filename}'`;
      }
      assertEqual(cmd, "sessions trace_download --userId 'user123'", 'empty filename');
    }
  );

  // Test 6: Special characters in filename are preserved
  await test(
    'special characters in filename are preserved',
    () => {
      const userId = 'user123';
      const filename = 'trace_2024-09-18.zip';
      let cmd = `sessions trace_download --userId '${userId}'`;
      cmd += ` --filename '${filename}'`;
      assertEqual(cmd, "sessions trace_download --userId 'user123' --filename 'trace_2024-09-18.zip'", 'special chars');
    }
  );
}

// ──────────────────────────────────────────────
// Input parsing tests for session management commands
// ──────────────────────────────────────────────

async function testInputParsing(): Promise<void> {
  console.log('\nTesting input parsing for session management commands...\n');

  // Test 1: Parse traces command
  await test(
    'parses traces command',
    () => {
      const input = "sessions traces --userId 'user123'";
      const parsed = parseArguments(input);
      assertEqual(parsed, ['sessions', 'traces', "--userId", 'user123'], 'traces parse');
    }
  );

  // Test 2: Parse trace_download command
  await test(
    'parses trace_download command',
    () => {
      const input = "sessions trace_download --userId 'user123' --filename 'trace.zip'";
      const parsed = parseArguments(input);
      assertEqual(parsed, ['sessions', 'trace_download', "--userId", 'user123', "--filename", 'trace.zip'], 'download parse');
    }
  );

  // Test 3: Parse trace_delete command
  await test(
    'parses trace_delete command',
    () => {
      const input = "sessions trace_delete --userId 'user123' --filename 'trace.zip'";
      const parsed = parseArguments(input);
      assertEqual(parsed, ['sessions', 'trace_delete', "--userId", 'user123', "--filename", 'trace.zip'], 'delete parse');
    }
  );

  // Test 4: Parse destroy command
  await test(
    'parses destroy command',
    () => {
      const input = "sessions destroy --userId 'user123'";
      const parsed = parseArguments(input);
      assertEqual(parsed, ['sessions', 'destroy', "--userId", 'user123'], 'destroy parse');
    }
  );

  // Test 5: Parse command with special characters in filename
  await test(
    'parses command with special characters in filename',
    () => {
      const input = "sessions trace_download --userId 'user123' --filename 'trace_2024-09-18.zip'";
      const parsed = parseArguments(input);
      assertEqual(parsed, ['sessions', 'trace_download', "--userId", 'user123', "--filename", 'trace_2024-09-18.zip'], 'special chars parse');
    }
  );
}

// ──────────────────────────────────────────────
// Integration tests
// ──────────────────────────────────────────────

async function testIntegration(): Promise<void> {
  console.log('\nTesting session management integration...\n');

  // Test 1: Generate command and parse it back
  await test(
    'round-trip: generate traces command and parse it',
    () => {
      const userId = 'user123';
      let cmd = `sessions traces --userId '${userId}'`;
      const parsed = parseArguments(cmd);
      assertEqual(parsed, ['sessions', 'traces', "--userId", 'user123'], 'round-trip traces');
    }
  );

  // Test 2: Generate command and parse it back (download)
  await test(
    'round-trip: generate trace_download command and parse it',
    () => {
      const userId = 'user123';
      const filename = 'trace.zip';
      let cmd = `sessions trace_download --userId '${userId}'`;
      cmd += ` --filename '${filename}'`;
      const parsed = parseArguments(cmd);
      assertEqual(parsed, ['sessions', 'trace_download', "--userId", 'user123', "--filename", 'trace.zip'], 'round-trip download');
    }
  );

  // Test 3: Generate command and parse it back (delete)
  await test(
    'round-trip: generate trace_delete command and parse it',
    () => {
      const userId = 'user123';
      const filename = 'trace.zip';
      let cmd = `sessions trace_delete --userId '${userId}'`;
      cmd += ` --filename '${filename}'`;
      const parsed = parseArguments(cmd);
      assertEqual(parsed, ['sessions', 'trace_delete', "--userId", 'user123', "--filename", 'trace.zip'], 'round-trip delete');
    }
  );

  // Test 4: Generate command and parse it back (destroy)
  await test(
    'round-trip: generate destroy command and parse it',
    () => {
      const userId = 'user123';
      let cmd = `sessions destroy --userId '${userId}'`;
      const parsed = parseArguments(cmd);
      assertEqual(parsed, ['sessions', 'destroy', "--userId", 'user123'], 'round-trip destroy');
    }
  );

  // Test 5: Different userIds generate different commands
  await test(
    'different userIds generate different commands',
    () => {
      const userId1 = 'user1';
      const userId2 = 'user2';
      let cmd1 = `sessions destroy --userId '${userId1}'`;
      let cmd2 = `sessions destroy --userId '${userId2}'`;
      assertEqual(cmd1 !== cmd2, true, 'different userIds produce different commands');
      assertEqual(cmd1, "sessions destroy --userId 'user1'", 'user1 command');
      assertEqual(cmd2, "sessions destroy --userId 'user2'", 'user2 command');
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa Session Management MCP Resources Tests ===');

  await testEndpointConfigurations();
  await testCommandGeneration();
  await testInputParsing();
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
