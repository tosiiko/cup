import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createInspector,
  fetchView,
  inspectView,
  mount,
  mountRemoteView,
} from '../../src/index.js';

describe('runtime inspection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    history.replaceState(null, '', '/');
  });

  it('captures client mounts', () => {
    const container = document.createElement('div');
    document.body.append(container);

    mount(container, {
      template: '<button data-action="save">{{ title }}</button>',
      state: { title: 'Hello' },
      actions: { save: () => {} },
    });

    expect(inspectView(container)).toMatchObject({
      source: 'client',
      template: '<button data-action="save">{{ title }}</button>',
      state: { title: 'Hello' },
      clientActionNames: ['save'],
      remoteActions: null,
      meta: null,
      lastError: null,
    });
  });

  it('captures remote mounts and notifies subscribers', () => {
    const container = document.createElement('div');
    const inspector = createInspector(container);
    const listener = vi.fn();
    const unsubscribe = inspector.subscribe(listener);

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
      },
    }, container);

    expect(listener).toHaveBeenNthCalledWith(1, null);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(inspector.snapshot()).toMatchObject({
      source: 'remote',
      template: '<button data-action="next">Next</button>',
      state: { step: 2 },
      clientActionNames: ['next'],
      remoteActions: {
        next: { type: 'navigate', url: '/next', replace: true },
      },
      meta: {
        version: '1',
        title: 'Wizard',
        route: '/wizard',
      },
      lastError: null,
    });

    unsubscribe();
  });

  it('records validation failures for static remote mounts', () => {
    const container = document.createElement('div');

    expect(() => mountRemoteView({ template: 42 } as never, container)).toThrow();
    expect(inspectView(container)).toMatchObject({
      source: null,
      template: null,
      state: null,
      lastError: {
        message: expect.stringContaining('Invalid CUP protocol view'),
      },
    });
  });

  it('records remote fetch failures and clears on destroy', async () => {
    const container = document.createElement('div');

    const invalidFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ template: 42 }),
    });

    await expect(fetchView('/broken', container, { fetchImpl: invalidFetch })).rejects.toThrow();
    expect(inspectView(container)).toMatchObject({
      source: null,
      template: null,
      state: null,
      lastError: {
        message: expect.stringContaining('Invalid CUP protocol view'),
        context: { url: '/broken', method: 'GET' },
      },
    });

    const validFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        template: '<p>{{ title }}</p>',
        state: { title: 'Ready' },
        meta: { version: '1', title: 'Ready', route: '/ready' },
      }),
    });

    const remote = await fetchView('/ready', container, { fetchImpl: validFetch });
    expect(inspectView(container)?.lastError).toBeNull();
    expect(inspectView(container)?.source).toBe('remote');

    remote.destroy();
    expect(inspectView(container)).toBeNull();
  });
});
