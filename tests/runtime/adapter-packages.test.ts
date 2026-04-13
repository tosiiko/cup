import { describe, expect, it } from 'vitest';

import {
  ADAPTER_GENERATOR as NODE_ADAPTER_GENERATOR,
  ADAPTER_LANG as NODE_ADAPTER_LANG,
  defineNodeView,
  nodeEmit,
  nodeFetch,
  nodeNavigate,
  toNodeResponse,
} from '../../adapters/node/index.mjs';
import {
  ADAPTER_GENERATOR as TS_ADAPTER_GENERATOR,
  ADAPTER_LANG as TS_ADAPTER_LANG,
  defineTypeScriptView,
  toTypeScriptResponse,
  tsEmit,
  tsFetch,
  tsNavigate,
} from '../../adapters/typescript/index';

describe('adapter packages', () => {
  it('defines node-cup views with adapter metadata and response helpers', () => {
    const view = defineNodeView({
      template: '<button data-action="reload">Reload</button>',
      state: {},
      actions: {
        reload: nodeFetch('/api/reload', { method: 'GET', payload: { scope: 'all' } }),
        notify: nodeEmit('reload:start', { source: 'test' }),
        next: nodeNavigate('/next', { replace: true }),
      },
      meta: {
        title: 'Node Fixture',
        route: '/fixture/node',
      },
    }, { policy: true });

    expect(view.meta).toEqual({
      version: '1',
      lang: NODE_ADAPTER_LANG,
      generator: NODE_ADAPTER_GENERATOR,
      title: 'Node Fixture',
      route: '/fixture/node',
    });
    expect(view.actions).toEqual({
      reload: { type: 'fetch', url: '/api/reload', method: 'GET', payload: { scope: 'all' } },
      notify: { type: 'emit', event: 'reload:start', detail: { source: 'test' } },
      next: { type: 'navigate', url: '/next', replace: true },
    });

    const response = toNodeResponse(view, {
      status: 202,
      headers: { 'X-CUP-Adapter': 'node' },
    });

    expect(response.status).toBe(202);
    expect(response.headers).toEqual({
      'Content-Type': 'application/json; charset=utf-8',
      'X-CUP-Adapter': 'node',
    });
    expect(JSON.parse(response.body)).toEqual(view);
  });

  it('defines ts-cup views with adapter metadata and response helpers', () => {
    const view = defineTypeScriptView({
      template: '<button data-action="reload">Reload</button>',
      state: {},
      actions: {
        reload: tsFetch('/api/reload', { method: 'PATCH', payload: { scope: 'team' } }),
        notify: tsEmit('reload:start', { source: 'test' }),
        next: tsNavigate('/next', { replace: true }),
      },
      meta: {
        title: 'TypeScript Fixture',
        route: '/fixture/ts',
      },
    }, { policy: true });

    expect(view.meta).toEqual({
      version: '1',
      lang: TS_ADAPTER_LANG,
      generator: TS_ADAPTER_GENERATOR,
      title: 'TypeScript Fixture',
      route: '/fixture/ts',
    });
    expect(view.actions).toEqual({
      reload: { type: 'fetch', url: '/api/reload', method: 'PATCH', payload: { scope: 'team' } },
      notify: { type: 'emit', event: 'reload:start', detail: { source: 'test' } },
      next: { type: 'navigate', url: '/next', replace: true },
    });

    const response = toTypeScriptResponse(view, {
      status: 207,
      headers: { 'X-CUP-Adapter': 'ts' },
    });

    expect(response.status).toBe(207);
    expect(response.headers).toEqual({
      'Content-Type': 'application/json; charset=utf-8',
      'X-CUP-Adapter': 'ts',
    });
    expect(JSON.parse(response.body)).toEqual(view);
  });
});
