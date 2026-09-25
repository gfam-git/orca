# ORCa Testing Documentation

This document covers the testing strategy, structure, and patterns for the ORCa project. All tests validate the core functionality: argument parsing, argument formatting, command routing, authentication, and help text generation.

---

## Table of Contents

- [Test Structure](#test-structure)
- [How to Run Tests](#how-to-run-tests)
- [What to Test](#what-to-test)
- [Test Patterns](#test-patterns)
- [Testing Best Practices](#testing-best-practices)

---

## Test Structure

All tests live under the `tests/` directory, organized by module. The current test suite is a lightweight, self-executing TypeScript file that uses no external test framework — just `ts-node` and raw Node.js.

### Directory Layout

```
tests/
  mcp/
    input-tool-test.ts  — Tests for parseArguments and formatArguments
```

### Existing Test File: `tests/mcp/input-tool-test.ts`

The current test file is a standalone `ts-node` script that validates the two MCP tool functions exported from `src/mcp/tools/`:

- **`parseArguments`** — Quote-aware CLI argument parser (`src/mcp/tools/input-parser.ts`)
- **`formatArguments`** — Pretty-printer for parsed arguments (`src/mcp/tools/format-args.ts`)

The test file is organized into three sections:

1. **`testParseArguments()`** — 16 test cases covering simple splits, quoted strings, empty input, whitespace handling, and edge cases.
2. **`testFormatArguments()`** — 6 test cases covering empty arrays, single/multiple arguments, special characters, and long lists.
3. **`testIntegration()`** — 3 round-trip tests verifying `parseArguments` output produces correct `formatArguments` output.

Each section uses a shared runner (`test(name, fn)`) that tracks pass/fail counts and exits with code 1 if any test fails.

### Test Runner Pattern

The test file uses a minimal custom runner — no npm test framework dependency:

```typescript
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
```

This pattern is intentionally simple: it avoids framework overhead, keeps test output clean, and exits with a non-zero code on failure (useful for CI).

---

## How to Run Tests

### Prerequisites

The project must be installed with `npm install` before running tests. The test runner depends on `ts-node` (a dev dependency).

### Run Command

```bash
npx ts-node tests/mcp/input-tool-test.ts
```

This executes the test file directly via `ts-node`, without needing a build step.

### npm Scripts

The `package.json` currently has a placeholder test script:

```json
"scripts": {
  "build": "tsc",
  "start": "ts-node src/index.ts",
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

To use `npm test`, update the script to:

```json
"scripts": {
  "test": "ts-node tests/mcp/input-tool-test.ts"
}
```

Then run with:

```bash
npm test
```

### Adding New Tests

1. Create a new `.ts` file under `tests/mcp/` (e.g., `tests/mcp/auth-test.ts`).
2. Run it with `npx ts-node tests/mcp/auth-test.ts`.
3. To include it in `npm test`, either:
   - Add it to the test script: `ts-node tests/mcp/input-tool-test.ts tests/mcp/auth-test.ts`
   - Or use a test runner that auto-discovers `tests/**/*.ts` files.

---

## What to Test

Every feature or change in ORCa should have corresponding tests covering the following areas:

### 1. Input Parsing (`parseArguments`)

Tests for the quote-aware argument parser. Cover:

- Simple whitespace splitting
- Single-quote and double-quote preservation
- Escaped quotes (`\"` and `\'`)
- Empty and whitespace-only input
- Tab, newline, and carriage return handling
- Mixed whitespace (spaces + tabs)
- Trailing and leading whitespace
- Multiple consecutive spaces
- Quoted arguments at the start, middle, and end
- Single argument (no spaces)

### 2. Argument Formatting (`formatArguments`)

Tests for the pretty-printer. Cover:

- Empty array (returns `"No arguments provided."`)
- Single argument
- Multiple arguments with indexed output
- Arguments containing spaces
- Arguments with special characters (quotes, apostrophes)
- Long argument lists

### 3. Integration (Round-trip)

Tests verifying `parseArguments` output is correctly consumed by `formatArguments`:

- Simple args: `parse("hello world") → format(["hello", "world"])`
- Quoted args: `parse("hello 'world foo' bar") → format(["hello", "world foo", "bar"])`
- Empty input: `parse("") → format([])`

### 4. OpenAPI Spec Routing

Tests for command routing and operation resolution:

- Resource and function name resolution from command strings
- Flag parsing (`--flag value`, `--flag`, `--flag true/false`)
- Path parameter substitution
- Query parameter building
- Request body construction
- Type coercion (numbers, booleans, JSON)

### 5. Help Text Generation

Tests for `--help` output:

- Service-level help (all resources listed)
- Resource-level help (all functions on a resource)
- Function-level help (all parameters for a function)
- Help text for resources/functions that do not exist (error handling)

### 6. Authentication Handling

Tests for auth configuration and header injection:

- All auth methods: `none`, `bearer`, `basic`, `apikey`
- Environment variable parsing priority (env var override vs. spec inference)
- Header injection for each auth method
- API key injection in query parameters
- Missing required environment variables (error handling)
- Unsupported auth method (error handling)

---

## Test Patterns

### Basic Test Pattern

Use the shared runner pattern for simple, fast tests:

```typescript
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
```

### Assertion Pattern

Use a simple equality assertion for value comparisons:

```typescript
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
```

### Named Test Groups

Organize tests into named async functions, one per module or feature:

```typescript
async function testParseArguments(): Promise<void> {
  console.log('\nTesting parseArguments...\n');

  await test('splits on whitespace', () => {
    const result = parseArguments('hello world foo');
    assertEqual(result, ['hello', 'world', 'foo'], 'simple whitespace split');
  });

  // ... more tests
}
```

### Async Test Runner

Wrap all named test groups in a top-level runner:

```typescript
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
```

---

## Testing Best Practices

### Coverage Expectations

- **Every exported function** should have at least one test case.
- **Every branch** in a conditional (if/else, switch) should be exercised by at least one test.
- **Edge cases** should be tested alongside happy paths.
- **Integration tests** should cover the main data flow: input → parse → format → output.

### Edge Cases to Consider

- **Empty input** — empty strings, empty arrays, empty objects
- **Whitespace variations** — spaces, tabs, newlines, carriage returns, mixed
- **Quoting** — single quotes, double quotes, nested quotes, unmatched quotes, escaped quotes
- **Special characters** — quotes within arguments, apostrophes, backslashes
- **Boundary values** — single argument, no arguments, very long argument lists
- **Error conditions** — invalid URLs, missing env vars, unknown resources/functions, unsupported auth methods
- **Type coercion** — string-to-number, string-to-boolean, JSON parsing

### Naming Conventions

- Test file names: `<module>-test.ts` (e.g., `input-tool-test.ts`, `auth-test.ts`)
- Test function names: `test<Module>()` (e.g., `testParseArguments()`, `testAuthConfig()`)
- Test case descriptions: concise, descriptive strings (e.g., `'splits on whitespace'`, `'handles trailing whitespace'`)

### Error Testing

Test that errors are thrown with the correct message and type:

```typescript
await test('throws on empty spec endpoint', () => {
  try {
    // ... trigger the error
    throw new Error('Expected error but none was thrown');
  } catch (err) {
    // Verify error type and message
  }
});
```

### Performance Considerations

- Tests should be fast and deterministic (no network calls, no file I/O).
- For integration tests that require network access, consider using a mock server or a local test fixture.
- Avoid loading large OpenAPI specs in unit tests; use minimal mock specs instead.

---

## Future Improvements

When the test suite grows, consider:

1. **Adopting a test framework** (e.g., `jest`, `mocha`, `vitest`) for better reporting, mocking, and test discovery.
2. **Adding a test runner script** in `package.json` that runs all `tests/**/*.ts` files.
3. **Adding CI integration** to run tests on every push/PR.
4. **Adding code coverage tracking** to ensure new tests cover new code.
5. **Adding integration tests** with a mock OpenAPI server (e.g., `nock` or `msw`).
