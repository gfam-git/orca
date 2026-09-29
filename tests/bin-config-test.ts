#!/usr/bin/env ts-node
/**
 * Tests for npx executable resolution (bin field configuration)
 *
 * Verifies that package.json has the correct bin field and the bin script
 * is properly configured for npx usage.
 *
 * Run with: npx ts-node tests/bin-config-test.ts
 */

const path = require('path');
const fs = require('fs');

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
// Package.json bin field tests
// ──────────────────────────────────────────────

async function testBinField(): Promise<void> {
  console.log('\nTesting package.json bin field...\n');

  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  // Test 1: bin field exists
  await test('package.json has a "bin" field', () => {
    assertEqual(!!pkg.bin, true, 'bin field must exist');
  });

  // Test 2: bin field has an "orca" entry
  await test('bin field contains "orca" command', () => {
    assertEqual(typeof pkg.bin, 'object', 'bin must be an object');
    assertEqual(typeof pkg.bin.orca, 'string', 'bin.orca must be a string');
  });

  // Test 3: bin path points to the bin script
  await test('bin/orca script path is correct', () => {
    assertEqual(pkg.bin.orca, 'bin/orca', 'bin must point to bin/orca');
  });

  // Test 4: main field still points to dist/index.js
  await test('main field points to dist/index.js', () => {
    assertEqual(pkg.main, 'dist/index.js', 'main must point to dist/index.js');
  });
}

// ──────────────────────────────────────────────
// Bin script tests
// ──────────────────────────────────────────────

async function testBinScript(): Promise<void> {
  console.log('\nTesting bin/orca script...\n');

  const binPath = path.join(__dirname, '../bin/orca');

  // Test 1: bin script file exists
  await test('bin/orca file exists', () => {
    assertEqual(fs.existsSync(binPath), true, 'bin/orca must exist');
  });

  // Test 2: bin script has shebang
  await test('bin/orca has a Node.js shebang', () => {
    const content = fs.readFileSync(binPath, 'utf-8');
    assertEqual(content.startsWith('#!/usr/bin/env node'), true, 'must start with #!/usr/bin/env node');
  });

  // Test 3: bin script requires the dist entry
  await test('bin/orca requires dist/index.js', () => {
    const content = fs.readFileSync(binPath, 'utf-8');
    assertEqual(content.includes("require('../dist/index.js')"), true, 'must require ../dist/index.js');
  });

  // Test 4: bin script is executable
  await test('bin/orca has executable permissions', () => {
    const stats = fs.statSync(binPath);
    assertEqual(stats.mode & 0o001, 0o001, 'bin/orca must be executable');
  });
}

// ──────────────────────────────────────────────
// Build output tests
// ──────────────────────────────────────────────

async function testBuildOutput(): Promise<void> {
  console.log('\nTesting build output...\n');

  const distPath = path.join(__dirname, '../dist/index.js');

  // Test 1: dist/index.js exists after build
  await test('dist/index.js exists after build', () => {
    assertEqual(fs.existsSync(distPath), true, 'dist/index.js must exist');
  });

  // Test 2: dist/index.js is valid JS
  await test('dist/index.js is valid JavaScript', () => {
    const content = fs.readFileSync(distPath, 'utf-8');
    assertEqual(content.length > 0, true, 'dist/index.js must not be empty');
  });
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  npx executable resolution tests');
  console.log('═══════════════════════════════════════════');

  await testBinField();
  await testBinScript();
  await testBuildOutput();

  console.log('\n═══════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
