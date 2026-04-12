import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  bind,
  createDispatcher,
  createRouter,
  createSignal,
  errorMiddleware,
  fetchView,
  fetchViewStream,
  mount,
  mountRemoteView,
} from '../../src/index.js';

describe('runtime integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.stubGlobal('scrollTo', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cleans signal subscriptions on remount', () => {
    const container = document.createElement('div');
    const signal = createSignal('first');
    document.body.append(container);

    mount(container, { template: '<span data-bind="title"></span>', state: {} });
    bind(container, { title: signal });
    mount(container, { template: '<p>next</p>', state: {} });

    signal.set('second');

    expect(container.innerHTML).toBe('<p>next</p>');
  });

  it('rolls back optimistic state after handler failure', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const dispatcher = createDispatcher(container, {
      template: '<button data-action="save">Save</button><span>{{ count }}</span>',
      state: { count: 0 },
    });

    dispatcher.use(errorMiddleware(dispatcher));
    dispatcher.register('save', {
      optimistic: (state) => ({ ...state, count: 1 }),
      handler: () => {
        throw new Error('nope');
      },
    });

    dispatcher.mount();
    await expect(dispatcher.dispatch('save')).rejects.toThrow('nope');
    expect(container.textContent).toContain('0');
    expect(dispatcher.error.get()?.message).toBe('nope');
  });

  it('tracks concurrent actions with loadingCount and activeActions', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const dispatcher = createDispatcher(container, {
      template: '<span>{{ count }}</span>',
      state: { count: 0 },
    });

    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });

    dispatcher.register('one', async () => {
      await wait;
    });
    dispatcher.register('two', async () => {
      await wait;
    });

    const first = dispatcher.dispatch('one');
    const second = dispatcher.dispatch('two');

    expect(dispatcher.loading.get()).toBe(true);
    expect(dispatcher.loadingCount.get()).toBe(2);
    expect(dispatcher.activeActions.get().sort()).toEqual(['one', 'two']);

    release();
    await Promise.all([first, second]);

    expect(dispatcher.loading.get()).toBe(false);
    expect(dispatcher.loadingCount.get()).toBe(0);
    expect(dispatcher.activeActions.get()).toEqual([]);
  });

  it('does not remount after dispatcher destroy when an action later succeeds', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const dispatcher = createDispatcher(container, {
      template: '<button data-action="save">Save</button><span>{{ count }}</span>',
      state: { count: 0 },
    });

    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });

    dispatcher.register('save', async (ctx) => {
      await wait;
      ctx.state = { ...ctx.state, count: 2 };
    });

    dispatcher.mount();
    const run = dispatcher.dispatch('save');
    dispatcher.destroy();
    release();

    await run;
    expect(container.textContent).toContain('0');
    expect(container.textContent).not.toContain('2');
  });

  it('does not rollback optimistic state after dispatcher destroy when an action later fails', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const dispatcher = createDispatcher(container, {
      template: '<button data-action="save">Save</button><span>{{ count }}</span>',
      state: { count: 0 },
    });

    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });

    dispatcher.register('save', {
      optimistic: (state) => ({ ...state, count: 1 }),
      handler: async () => {
        await wait;
        throw new Error('late failure');
      },
    });

    dispatcher.mount();
    const run = dispatcher.dispatch('save');
    dispatcher.destroy();
    release();

    await expect(run).rejects.toThrow('late failure');
    expect(container.textContent).toContain('1');
    expect(container.textContent).not.toContain('0');
  });

  it('avoids duplicate navigation interception and removes listeners on destroy', async () => {
    const outlet = document.createElement('div');
    const link = document.createElement('a');
    link.href = '/next';
    link.dataset.link = 'true';
    link.textContent = 'next';

    document.body.append(link, outlet);
    history.replaceState(null, '', '/');

    const pushSpy = vi.spyOn(history, 'pushState');
    const router = createRouter({
      routes: [
        { path: '/', view: { template: '<p>home</p>', state: {} } },
        { path: '/next', view: { template: '<p>next</p>', state: {} } },
      ],
    });

    await router.start(outlet);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await Promise.resolve();

    expect(pushSpy).toHaveBeenCalledTimes(1);

    router.destroy();
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates router transition getters on each render', async () => {
    const outlet = document.createElement('div');
    document.body.append(outlet);
    history.replaceState(null, '', '/');

    let currentTransition: 'none' | 'slide' = 'none';
    const transition = vi.fn(() => currentTransition);
    const router = createRouter({
      routes: [
        { path: '/', view: { template: '<p>home</p>', state: {} } },
        { path: '/next', view: { template: '<p>next</p>', state: {} } },
      ],
      transition,
    });

    await router.start(outlet);
    expect(transition).toHaveBeenCalledTimes(1);
    expect(outlet.textContent).toContain('home');

    currentTransition = 'slide';
    await router.navigate('/next');

    expect(transition).toHaveBeenCalledTimes(2);
    expect(outlet.textContent).toContain('next');

    router.destroy();
  });

  it('rejects invalid remote views by default', async () => {
    const container = document.createElement('div');
    const onError = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ template: 42 }),
    });

    await expect(fetchView('/view', container, { fetchImpl, onError })).rejects.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit fetchImpl for remote loading helpers', async () => {
    const container = document.createElement('div');

    await expect(fetchView('/view', container)).rejects.toThrow(/requires options\.fetchImpl/);
    await expect(fetchViewStream('/stream', container)).rejects.toThrow(/requires options\.fetchImpl/);
  });

  it('uses query parameters for GET remote actions', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          template: '<button data-action="refresh">Refresh</button>',
          state: { count: 1, filter: 'open' },
          actions: {
            refresh: {
              type: 'fetch',
              url: '/items',
              method: 'GET',
              payload: { page: 2, tags: ['a', 'b'] },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          template: '<p>done</p>',
          state: { done: true },
        }),
      });

    await fetchView('/view', container, { fetchImpl });
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    const [url, options] = fetchImpl.mock.calls[1] as [string, RequestInit];
    const target = new URL(url);

    expect(target.pathname).toBe('/items');
    expect(target.searchParams.get('count')).toBe('1');
    expect(target.searchParams.get('filter')).toBe('open');
    expect(target.searchParams.get('page')).toBe('2');
    expect(target.searchParams.get('tags')).toBe('["a","b"]');
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
  });

  it('uses JSON bodies for non-GET remote actions', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          template: '<button data-action="save">Save</button>',
          state: { count: 1 },
          actions: {
            save: {
              type: 'fetch',
              url: '/items',
              method: 'PATCH',
              payload: { published: true },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          template: '<p>saved</p>',
          state: { saved: true },
        }),
      });

    await fetchView('/view', container, { fetchImpl });
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    const [url, options] = fetchImpl.mock.calls[1] as [string, RequestInit];

    expect(url).toBe('/items');
    expect(options.method).toBe('PATCH');
    expect(options.body).toBe(JSON.stringify({ count: 1, published: true }));
  });

  it('applies patch responses on remote action updates', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          template: '<button data-action="save">Save</button><span>{{ count }}</span>',
          state: { count: 1 },
          actions: {
            save: {
              type: 'fetch',
              url: '/items',
              method: 'POST',
            },
          },
          meta: {
            version: '1',
            title: 'Counter',
            route: '/counter',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          kind: 'patch',
          state: { count: 2 },
          meta: {
            title: 'Counter updated',
          },
        }),
      });

    await fetchView('/view', container, { fetchImpl });
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await vi.waitFor(() => expect(container.textContent).toContain('2'));

    expect(container.querySelector('button')?.textContent).toBe('Save');
  });

  it('mounts streaming remote payloads from ndjson responses', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const onChunk = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(JSON.stringify({
          template: '<p>{{ title }}</p>',
          state: { title: 'Loading' },
          meta: {
            version: '1',
            title: 'Loading',
            route: '/stream',
          },
        }) + '\n'));
        controller.enqueue(encoder.encode(JSON.stringify({
          kind: 'patch',
          state: { title: 'Ready' },
          meta: {
            title: 'Ready',
          },
        }) + '\n'));
        controller.close();
      },
    });

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      body,
    });

    const stream = await fetchViewStream('/stream', container, { fetchImpl, onChunk });
    await stream.done;

    expect(fetchImpl).toHaveBeenCalledWith('/stream', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Accept: 'application/x-ndjson, application/json',
      }),
    }));
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Ready');
  });

  it('reports remote action failures through onError once', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    const onError = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          template: '<button data-action="save">Save</button>',
          state: { count: 1 },
          actions: {
            save: {
              type: 'fetch',
              url: '/items',
              method: 'POST',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

    await fetchView('/view', container, { fetchImpl, onError });
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      { url: '/items', method: 'POST' },
    );
    expect(container.textContent).toContain('Save');
  });

  it('does not remount after destroy during refresh', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    let resolveRefresh!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const refreshResponse = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolveRefresh = resolve;
    });

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          template: '<p>initial</p>',
          state: { ready: true },
        }),
      })
      .mockImplementationOnce(() => refreshResponse);

    const remote = await fetchView('/view', container, { fetchImpl });
    const refresh = remote.refresh();

    remote.destroy();
    resolveRefresh({
      ok: true,
      json: async () => ({
        template: '<p>updated</p>',
        state: { ready: false },
      }),
    });

    await refresh;
    expect(container.innerHTML).toBe('');
  });

  it('does not remount after destroy during remote action fetches', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    let resolveAction!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const actionResponse = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolveAction = resolve;
    });

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          template: '<button data-action="save">Save</button>',
          state: { count: 1 },
          actions: {
            save: {
              type: 'fetch',
              url: '/items',
              method: 'POST',
            },
          },
        }),
      })
      .mockImplementationOnce(() => actionResponse);

    const remote = await fetchView('/view', container, { fetchImpl });
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    remote.destroy();
    resolveAction({
      ok: true,
      json: async () => ({
        template: '<p>updated</p>',
        state: { saved: true },
      }),
    });

    await vi.waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('notifies router lifecycle hooks for successful and failed navigations', async () => {
    const outlet = document.createElement('div');
    document.body.append(outlet);
    history.replaceState(null, '', '/');

    const onNavigateStart = vi.fn();
    const onNavigateEnd = vi.fn();
    const onNavigateError = vi.fn();

    const router = createRouter({
      routes: [
        { path: '/', view: { template: '<p>home</p>', state: {} } },
        { path: '/next', view: { template: '<p>next</p>', state: {} } },
        {
          path: '/broken',
          view: async () => {
            throw new Error('boom');
          },
        },
      ],
      onNavigateStart,
      onNavigateEnd,
      onNavigateError,
    });

    await router.start(outlet);
    await router.navigate('/next');
    await expect(router.navigate('/broken')).rejects.toThrow('boom');

    expect(onNavigateStart).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/',
      source: 'start',
    }));
    expect(onNavigateStart).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/next',
      source: 'navigate',
    }));
    expect(onNavigateStart).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/broken',
      source: 'navigate',
    }));
    expect(onNavigateEnd).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/',
      source: 'start',
    }));
    expect(onNavigateEnd).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/next',
      source: 'navigate',
    }));
    expect(onNavigateError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        pathname: '/broken',
        source: 'navigate',
      }),
    );

    router.destroy();
  });

  it('honors replace navigation in static remote views', () => {
    const container = document.createElement('div');
    document.body.append(container);
    history.replaceState(null, '', '/');

    const pushSpy = vi.spyOn(history, 'pushState');
    const replaceSpy = vi.spyOn(history, 'replaceState');

    mountRemoteView({
      template: '<button data-action="go">Go</button>',
      state: {},
      actions: {
        go: { type: 'navigate', url: '/next', replace: true },
      },
    }, container);

    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

    expect(replaceSpy).toHaveBeenCalledWith(null, '', '/next');
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
