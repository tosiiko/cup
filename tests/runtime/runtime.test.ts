import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  bind,
  createDispatcher,
  createRouter,
  createSignal,
  errorMiddleware,
  fetchView,
  mount,
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
});
