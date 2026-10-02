const {parseCommand} = require('../../dist/orc/client');

// Test cases
const tests = [
  { input: 'tabs extract --schema {"type":"object"}', expected: '{"type":"object"}' },
  { input: 'tabs extract --schema {"nested":{"deep":{"value":42}}}', expected: '{"nested":{"deep":{"value":42}}}' },
  { input: 'tabs extract --schema ["a","b","c"]', expected: '["a","b","c"]' },
  { input: 'tabs extract --schema {}', expected: '{}' },
  { input: 'tabs extract --schema not-json', expected: 'not-json' },
  { input: 'tabs extract --userId geebo --schema {"type":"object"}', expected: '{"type":"object"}' },
  { input: 'tabs extract --schema {type:object}', expected: '{type:object}' },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const result = parseCommand(t.input);
  const actual = result.flags.schema;
  if (actual === t.expected) {
    console.log('✓', t.input.substring(0, 50) + '...');
    pass++;
  } else {
    console.log('✗', t.input.substring(0, 50) + '...');
    console.log('  expected:', t.expected);
    console.log('  actual:  ', actual);
    fail++;
  }
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
