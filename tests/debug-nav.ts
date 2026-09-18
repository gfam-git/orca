import { buildCommandMap } from '../src/orc/client';
import type { OpenApiSpec } from '../src/orc/types';

const spec: OpenApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Test' },
  paths: {
    '/tabs/{tabId}/back': {
      post: { tags: ['Navigation'], operationId: 'goBack', summary: 'Go back in history' }
    },
    '/tabs/{tabId}/forward': {
      post: { tags: ['Navigation'], operationId: 'goForward', summary: 'Go forward in history' }
    },
    '/tabs/{tabId}/refresh': {
      post: { tags: ['Navigation'], operationId: 'refreshPage', summary: 'Refresh page' }
    },
    '/tabs/{tabId}/viewport': {
      post: { tags: ['Interaction'], operationId: 'setViewport', summary: 'Set viewport size' }
    }
  }
};

const map = buildCommandMap(spec);
console.log('Command map keys:', Object.keys(map));
for (const key of Object.keys(map)) {
  const def = map[key] as any;
  console.log('Key:', key);
  console.log('  Resource:', def.name);
  console.log('  Functions:', Object.keys(def.functions));
}
