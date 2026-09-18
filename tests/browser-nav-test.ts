import { buildCommandMap } from '../src/orc/client';
import type { OpenApiSpec } from '../src/orc/types';

const spec: OpenApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Test' },
  paths: {
    '/tabs/{tabId}/back': {
      post: {
        tags: ['Navigation'],
        operationId: 'goBack',
        summary: 'Go back',
        parameters: [{ name: 'tabId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                required: ['userId'],
                properties: { userId: { type: 'string' as const } }
              }
            }
          }
        }
      }
    },
    '/tabs/{tabId}/forward': {
      post: {
        tags: ['Navigation'],
        operationId: 'goForward',
        summary: 'Go forward',
        parameters: [{ name: 'tabId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                required: ['userId'],
                properties: { userId: { type: 'string' as const } }
              }
            }
          }
        }
      }
    },
    '/tabs/{tabId}/refresh': {
      post: {
        tags: ['Navigation'],
        operationId: 'refreshPage',
        summary: 'Refresh page',
        parameters: [{ name: 'tabId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                required: ['userId'],
                properties: { userId: { type: 'string' as const } }
              }
            }
          }
        }
      }
    },
    '/tabs/{tabId}/viewport': {
      post: {
        tags: ['Interaction'],
        operationId: 'setViewport',
        summary: 'Set the page viewport size',
        parameters: [{ name: 'tabId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object' as const,
                required: ['userId', 'width', 'height'],
                properties: {
                  userId: { type: 'string' as const },
                  width: { type: 'integer' as const },
                  height: { type: 'integer' as const }
                }
              }
            }
          }
        }
      }
    }
  }
};

const map = buildCommandMap(spec);
let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log('  PASS: ' + msg);
    passed++;
  } else {
    console.log('  FAIL: ' + msg);
    failed++;
  }
}

function hasParam(params: Array<{ name: string }>, paramName: string): boolean {
  return params.some(p => p.name === paramName);
}

function includesIgnoreCase(str: string, substr: string): boolean {
  return str.toLowerCase().includes(substr.toLowerCase());
}

const tabs = map['tabs'] as any;

console.log('Testing tabs.back...');
assert(tabs !== undefined, 'tabs resource exists');
assert(tabs && tabs.functions.back !== undefined, 'tabs has back function');
if (tabs && tabs.functions.back) {
  assert(includesIgnoreCase(tabs.functions.back.description, 'go back'), 'back description mentions go back');
  assert(hasParam(tabs.functions.back.params, 'userId'), 'back has userId param');
  assert(hasParam(tabs.functions.back.params, 'tabId'), 'back has tabId param');
}

console.log('Testing tabs.forward...');
assert(tabs && tabs.functions.forward !== undefined, 'tabs has forward function');
if (tabs && tabs.functions.forward) {
  assert(includesIgnoreCase(tabs.functions.forward.description, 'go forward'), 'forward description mentions go forward');
  assert(hasParam(tabs.functions.forward.params, 'userId'), 'forward has userId param');
  assert(hasParam(tabs.functions.forward.params, 'tabId'), 'forward has tabId param');
}

console.log('Testing tabs.refresh...');
assert(tabs && tabs.functions.refresh !== undefined, 'tabs has refresh function');
if (tabs && tabs.functions.refresh) {
  assert(includesIgnoreCase(tabs.functions.refresh.description, 'refresh'), 'refresh description mentions refresh');
  assert(hasParam(tabs.functions.refresh.params, 'userId'), 'refresh has userId param');
  assert(hasParam(tabs.functions.refresh.params, 'tabId'), 'refresh has tabId param');
}

console.log('Testing tabs.viewport...');
assert(tabs && tabs.functions.viewport !== undefined, 'tabs has viewport function');
if (tabs && tabs.functions.viewport) {
  assert(includesIgnoreCase(tabs.functions.viewport.description, 'viewport'), 'viewport description mentions viewport');
  assert(hasParam(tabs.functions.viewport.params, 'userId'), 'viewport has userId param');
  assert(hasParam(tabs.functions.viewport.params, 'tabId'), 'viewport has tabId param');
  assert(hasParam(tabs.functions.viewport.params, 'width'), 'viewport has width param');
  assert(hasParam(tabs.functions.viewport.params, 'height'), 'viewport has height param');
}

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
