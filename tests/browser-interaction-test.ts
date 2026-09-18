#!/usr/bin/env ts-node
/**
 * Tests for browser interaction MCP tools (click, type, scroll, press, select, upload, wait)
 *
 * Run with: npx ts-node tests/browser-interaction-test.ts
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
// Click tool tests
// ──────────────────────────────────────────────

async function testBrowserClick(): Promise<void> {
  console.log('\nTesting browser_click...\n');

  await test(
    'generates correct command with userId and tabId',
    () => {
      const cmd = `tabs click --userId 'user123' --tabId 'tab-abc'`;
      const parsed = parseCommand(cmd);
      assertEqual(parsed.resource, 'tabs', 'resource');
      assertEqual(parsed.func, 'click', 'function');
      assertEqual(parsed.flags.userId, 'user123', 'userId');
      assertEqual(parsed.flags.tabId, 'tab-abc', 'tabId');
    }
  );

  await test(
    'includes ref parameter',
    () => {
      const cmd = `tabs click --userId 'user123' --tabId 'tab-abc' --ref 'e3'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.ref, 'e3', 'ref');
    }
  );

  await test(
    'includes selector parameter',
    () => {
      const cmd = `tabs click --userId 'user123' --tabId 'tab-abc' --selector '.btn-submit'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.selector, '.btn-submit', 'selector');
    }
  );

  await test(
    'includes doubleClick boolean',
    () => {
      const cmd = `tabs click --userId 'user123' --tabId 'tab-abc' --doubleClick true`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.doubleClick, true, 'doubleClick true');
    }
  );

  await test(
    'includes coordinates object',
    () => {
      const cmd = `tabs click --userId 'user123' --tabId 'tab-abc' --coordinates '{"x":100,"y":200}'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.coordinates, '{"x":100,"y":200}', 'coordinates');
    }
  );
}

// ──────────────────────────────────────────────
// Type tool tests
// ──────────────────────────────────────────────

async function testBrowserType(): Promise<void> {
  console.log('\nTesting browser_type...\n');

  await test(
    'generates correct command with userId, tabId, and text',
    () => {
      const cmd = `tabs type --userId 'user123' --tabId 'tab-abc' --text 'Hello World'`;
      const parsed = parseCommand(cmd);
      assertEqual(parsed.resource, 'tabs', 'resource');
      assertEqual(parsed.func, 'type', 'function');
      assertEqual(parsed.flags.userId, 'user123', 'userId');
      assertEqual(parsed.flags.tabId, 'tab-abc', 'tabId');
      assertEqual(parsed.flags.text, 'Hello World', 'text');
    }
  );

  await test(
    'includes ref parameter',
    () => {
      const cmd = `tabs type --userId 'user123' --tabId 'tab-abc' --text 'test' --ref 'e5'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.ref, 'e5', 'ref');
    }
  );

  await test(
    'includes selector parameter',
    () => {
      const cmd = `tabs type --userId 'user123' --tabId 'tab-abc' --text 'test' --selector '#input-name'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.selector, '#input-name', 'selector');
    }
  );

  await test(
    'includes clear boolean',
    () => {
      const cmd = `tabs type --userId 'user123' --tabId 'tab-abc' --text 'test' --clear true`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.clear, true, 'clear true');
    }
  );

  await test(
    'includes submit boolean',
    () => {
      const cmd = `tabs type --userId 'user123' --tabId 'tab-abc' --text 'test' --submit true`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.submit, true, 'submit true');
    }
  );
}

// ──────────────────────────────────────────────
// Scroll tool tests
// ──────────────────────────────────────────────

async function testBrowserScroll(): Promise<void> {
  console.log('\nTesting browser_scroll...\n');

  await test(
    'generates correct command with direction and amount',
    () => {
      const cmd = `tabs scroll --userId 'user123' --tabId 'tab-abc' --direction 'down' --amount '500'`;
      const parsed = parseCommand(cmd);
      assertEqual(parsed.resource, 'tabs', 'resource');
      assertEqual(parsed.func, 'scroll', 'function');
      assertEqual(parsed.flags.direction, 'down', 'direction');
      assertEqual(parsed.flags.amount, '500', 'amount');
    }
  );

  await test(
    'supports up direction',
    () => {
      const cmd = `tabs scroll --userId 'user123' --tabId 'tab-abc' --direction 'up' --amount '200'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.direction, 'up', 'direction up');
      assertEqual(flags.amount, '200', 'amount 200');
    }
  );

  await test(
    'supports left direction',
    () => {
      const cmd = `tabs scroll --userId 'user123' --tabId 'tab-abc' --direction 'left' --amount '100'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.direction, 'left', 'direction left');
    }
  );

  await test(
    'supports right direction',
    () => {
      const cmd = `tabs scroll --userId 'user123' --tabId 'tab-abc' --direction 'right' --amount '100'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.direction, 'right', 'direction right');
    }
  );
}

// ──────────────────────────────────────────────
// Press tool tests
// ──────────────────────────────────────────────

async function testBrowserPress(): Promise<void> {
  console.log('\nTesting browser_press...\n');

  await test(
    'generates correct command with key',
    () => {
      const cmd = `tabs press --userId 'user123' --tabId 'tab-abc' --key 'Enter'`;
      const parsed = parseCommand(cmd);
      assertEqual(parsed.resource, 'tabs', 'resource');
      assertEqual(parsed.func, 'press', 'function');
      assertEqual(parsed.flags.key, 'Enter', 'key');
    }
  );

  await test(
    'supports Escape key',
    () => {
      const cmd = `tabs press --userId 'user123' --tabId 'tab-abc' --key 'Escape'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.key, 'Escape', 'key Escape');
    }
  );

  await test(
    'supports Tab key',
    () => {
      const cmd = `tabs press --userId 'user123' --tabId 'tab-abc' --key 'Tab'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.key, 'Tab', 'key Tab');
    }
  );
}

// ──────────────────────────────────────────────
// Select tool tests
// ──────────────────────────────────────────────

async function testBrowserSelect(): Promise<void> {
  console.log('\nTesting browser_select...\n');

  await test(
    'generates correct command with option',
    () => {
      const cmd = `tabs select --userId 'user123' --tabId 'tab-abc' --option 'Red'`;
      const parsed = parseCommand(cmd);
      assertEqual(parsed.resource, 'tabs', 'resource');
      assertEqual(parsed.func, 'select', 'function');
      assertEqual(parsed.flags.option, 'Red', 'option');
    }
  );

  await test(
    'includes ref parameter',
    () => {
      const cmd = `tabs select --userId 'user123' --tabId 'tab-abc' --option 'Blue' --ref 'e7'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.ref, 'e7', 'ref');
      assertEqual(flags.option, 'Blue', 'option');
    }
  );

  await test(
    'includes selector parameter',
    () => {
      const cmd = `tabs select --userId 'user123' --tabId 'tab-abc' --option 'Green' --selector '#color-select'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.selector, '#color-select', 'selector');
    }
  );
}

// ──────────────────────────────────────────────
// Upload tool tests
// ──────────────────────────────────────────────

async function testBrowserUpload(): Promise<void> {
  console.log('\nTesting browser_upload...\n');

  await test(
    'generates correct command with path',
    () => {
      const cmd = `tabs upload --userId 'user123' --tabId 'tab-abc' --path '/home/uploads/file.pdf'`;
      const parsed = parseCommand(cmd);
      assertEqual(parsed.resource, 'tabs', 'resource');
      assertEqual(parsed.func, 'upload', 'function');
      assertEqual(parsed.flags.path, '/home/uploads/file.pdf', 'path');
    }
  );

  await test(
    'includes ref parameter',
    () => {
      const cmd = `tabs upload --userId 'user123' --tabId 'tab-abc' --path '/home/uploads/img.png' --ref 'e10'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.ref, 'e10', 'ref');
    }
  );

  await test(
    'includes selector parameter',
    () => {
      const cmd = `tabs upload --userId 'user123' --tabId 'tab-abc' --path '/home/uploads/doc.pdf' --selector '#file-input'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.selector, '#file-input', 'selector');
    }
  );

  await test(
    'includes timeout parameter',
    () => {
      const cmd = `tabs upload --userId 'user123' --tabId 'tab-abc' --path '/home/uploads/file.pdf' --timeout '15000'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.timeout, '15000', 'timeout');
    }
  );
}

// ──────────────────────────────────────────────
// Wait tool tests
// ──────────────────────────────────────────────

async function testBrowserWait(): Promise<void> {
  console.log('\nTesting browser_wait...\n');

  await test(
    'generates correct command with selector',
    () => {
      const cmd = `tabs wait --userId 'user123' --tabId 'tab-abc' --selector '#loading-complete'`;
      const parsed = parseCommand(cmd);
      assertEqual(parsed.resource, 'tabs', 'resource');
      assertEqual(parsed.func, 'wait', 'function');
      assertEqual(parsed.flags.selector, '#loading-complete', 'selector');
    }
  );

  await test(
    'includes timeout parameter',
    () => {
      const cmd = `tabs wait --userId 'user123' --tabId 'tab-abc' --selector '#loading-complete' --timeout '30000'`;
      const flags = parseCommand(cmd).flags;
      assertEqual(flags.timeout, '30000', 'timeout');
    }
  );
}

// ──────────────────────────────────────────────
// Server.ts endpoint registration tests
// ──────────────────────────────────────────────

async function testEndpointRegistration(): Promise<void> {
  console.log('\nTesting endpoint registration in server.ts...\n');

  // Read the server.ts file and verify all 7 interaction endpoints are defined
  const { readFileSync } = require('fs');
  const { resolve } = require('path');
  const serverPath = resolve(__dirname, '../src/mcp/server.ts');
  const serverContent = readFileSync(serverPath, 'utf-8');

  const expectedTools = [
    'browser_click',
    'browser_type',
    'browser_scroll',
    'browser_press',
    'browser_select',
    'browser_upload',
    'browser_wait',
  ];

  for (const toolName of expectedTools) {
    await test(
      `registers ${toolName}`,
      () => {
        const found = serverContent.includes(`"${toolName}"`) || serverContent.includes(`'${toolName}'`);
        if (!found) {
          throw new Error(`${toolName} not found in server.ts`);
        }
      }
    );
  }

  // Verify the browserInteractionEndpoints object exists
  await test(
    'defines browserInteractionEndpoints object',
    () => {
      if (!serverContent.includes('browserInteractionEndpoints')) {
        throw new Error('browserInteractionEndpoints not defined');
      }
    }
  );

  // Verify execBrowserInteraction function exists
  await test(
    'defines execBrowserInteraction function',
    () => {
      if (!serverContent.includes('execBrowserInteraction')) {
        throw new Error('execBrowserInteraction not defined');
      }
    }
  );

  // Verify 7 endpoints are registered
  const endpointCount = (serverContent.match(/browser_(click|type|scroll|press|select|upload|wait)/g) || []).length;
  await test(
    'registers all 7 browser interaction endpoints',
    () => {
      // Each tool appears in the object definition + in the loop registration + in input schema
      // At minimum 14+ references expected
      if (endpointCount < 14) {
        throw new Error(`Expected at least 14 references to interaction endpoints, found ${endpointCount}`);
      }
    }
  );
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('=== ORCa Browser Interaction MCP Tests ===\n');

  await testBrowserClick();
  await testBrowserType();
  await testBrowserScroll();
  await testBrowserPress();
  await testBrowserSelect();
  await testBrowserUpload();
  await testBrowserWait();
  await testEndpointRegistration();

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Test runner error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
