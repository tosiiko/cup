import { beforeEach, describe, expect, it } from 'vitest';

import {
  createDispatcher,
  createTraceObserver,
  inspectTraces,
  mountRemoteView,
} from '../../src/index.js';

describe('runtime tracing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    history.replaceState(null, '', '/');
  });

  it('records validation and render traces for remote mounts', () => {
    const container = document.createElement('div');
    const observer = createTraceObserver(container);

    mountRemoteView({
      template: '<button data-action="next">Next</button>',
      state: { step: 2 },
      actions: {
        next: { type: 'navigate', url: '/next', replace: true },
      },
      meta: {
        version: '1',
        title: 'Wizard',
        route: '/wizard',
        extensions: {
          'cup.provenance': { version: '1' },
        },
      },
    }, container);

    const traces = observer.snapshot();
    expect(traces.some((trace) => trace.kind === 'validation' && trace.status === 'passed')).toBe(true);
    expect(traces.some((trace) => trace.kind === 'render' && trace.source === 'remote')).toBe(true);
  });

  it('records failed validation traces for invalid remote payloads', () => {
    const container = document.createElement('div');

    expect(() => mountRemoteView({ template: 42 } as never, container)).toThrow();

    const traces = inspectTraces(container);
    expect(traces.some((trace) => trace.kind === 'validation' && trace.status === 'failed')).toBe(true);
  });

  it('records dispatcher action lifecycle traces', async () => {
    const container = document.createElement('div');
    const dispatcher = createDispatcher(container, {
      template: '<button data-action="save">Save</button>',
      state: { count: 0 },
    });

    dispatcher.register('save', async (ctx) => {
      ctx.state.count = (ctx.state.count as number) + 1;
    });

    dispatcher.mount();
    await dispatcher.dispatch('save');

    const actionTraces = inspectTraces(container).filter((trace) => trace.kind === 'action');
    expect(actionTraces).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'dispatcher', phase: 'start', name: 'save' }),
      expect.objectContaining({ source: 'dispatcher', phase: 'success', name: 'save' }),
    ]));
  });
});
