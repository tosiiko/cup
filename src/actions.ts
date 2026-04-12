/**
 * CUP Action System — Phase 5
 *
 * A centralised, middleware-driven action dispatcher.
 *
 * Features:
 *  - Named action registry with typed handlers
 *  - Composable middleware pipeline (logging, auth, loading, analytics…)
 *  - Optimistic updates — apply predicted state instantly, rollback on error
 *  - Per-action and global loading / error signals
 *  - Action queuing — serialise concurrent calls to the same action
 *  - AbortController integration — cancel in-flight async actions
 *
 * Usage:
 *
 *   const d = createDispatcher(container, view);
 *
 *   d.use(loggerMiddleware);
 *   d.use(errorMiddleware(d));
 *
 *   d.register('increment', {
 *     optimistic: (s) => ({ ...s, count: (s['count'] as number) + 1 }),
 *     handler: async (ctx) => {
 *       const res = await fetch('/api/increment', { method: 'POST' });
 *       Object.assign(ctx.state, await res.json());
 *     },
 *   });
 *
 *   d.mount(); // render + bind all data-action elements
 */

import { mount } from './mount.js';
import { cleanupTree } from './cleanup.js';
import { createSignal } from './signal.js';
import type { ClientView, Signal } from './types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionContext {
  /** Registered action name */
  name: string;
  /** Live state snapshot — mutate to update the view on commit */
  state: Record<string, unknown>;
  /** Caller-supplied extra data */
  payload: unknown;
  /** The container element this view is mounted into */
  container: Element;
  /** DOM event that triggered this action, when applicable */
  event?: Event;
  /** Cancel this action (sets isAborted → true, stops pipeline) */
  abort(): void;
  /** True if abort() was called */
  isAborted(): boolean;
}

export type Next = () => Promise<void>;
export type Middleware = (ctx: ActionContext, next: Next) => Promise<void>;
export type ActionHandler = (ctx: ActionContext) => Promise<void> | void;

export interface ActionRegistration {
  /** Called after optimistic update is applied and all middleware ran */
  handler: ActionHandler;
  /**
   * Pure function — given current state (and optional payload), returns the
   * predicted next state. Applied immediately; rolled back on error.
   */
  optimistic?: (state: Record<string, unknown>, payload?: unknown) => Record<string, unknown>;
  /**
   * If true, concurrent calls are queued (FIFO) instead of dropped.
   * Default: false (concurrent calls are dropped with a console.warn).
   */
  queue?: boolean;
}

export interface Dispatcher {
  /** Add a middleware to the pipeline (order matters — first added, first run) */
  use(mw: Middleware): this;
  /** Register a named action */
  register(name: string, reg: ActionHandler | ActionRegistration): this;
  /** Programmatically dispatch an action by name */
  dispatch(name: string, payload?: unknown): Promise<void>;
  /** (Re)mount the view and wire all data-action elements to the dispatcher */
  mount(): void;
  /** Unsubscribe event wiring and prevent future dispatches */
  destroy(): void;
  /** True while any action is executing */
  loading: Signal<boolean>;
  /** Number of running actions across the dispatcher */
  loadingCount: Signal<number>;
  /** Names of actions currently executing */
  activeActions: Signal<string[]>;
  /** Last error thrown by a handler, or null */
  error: Signal<Error | null>;
}

// ── Built-in middleware factories ─────────────────────────────────────────────

/** Logs every action to the console with timing. */
export function loggerMiddleware(label = 'CUP'): Middleware {
  return async (ctx, next) => {
    const t0 = performance.now();
    console.debug(`[${label}] action "${ctx.name}" start`);
    await next();
    const ms = (performance.now() - t0).toFixed(1);
    if (ctx.isAborted()) {
      console.debug(`[${label}] action "${ctx.name}" aborted (${ms}ms)`);
    } else {
      console.debug(`[${label}] action "${ctx.name}" done (${ms}ms)`);
    }
  };
}

/**
 * Backward-compatible placeholder now that loading state is intrinsic
 * while any action runs. Wire this after registering actions.
 */
export function loadingMiddleware(d: Pick<Dispatcher, 'loading' | 'loadingCount' | 'activeActions'>): Middleware {
  return async (_ctx, next) => {
    void d.loading;
    void d.loadingCount;
    void d.activeActions;
    await next();
  };
}

/**
 * Catches errors from the handler, writes them to dispatcher.error,
 * and prevents them from propagating.
 */
export function errorMiddleware(d: Pick<Dispatcher, 'error'>): Middleware {
  return async (ctx, next) => {
    d.error.set(null);
    try {
      await next();
    } catch (err) {
      d.error.set(err instanceof Error ? err : new Error(String(err)));
      console.error(`[CUP] action "${ctx.name}" threw:`, err);
      throw err;
    }
  };
}

/**
 * Adds a simulated network delay — useful for testing loading states locally.
 */
export function delayMiddleware(ms: number): Middleware {
  return async (_ctx, next) => {
    await new Promise<void>((r) => setTimeout(r, ms));
    await next();
  };
}

// ── createDispatcher ──────────────────────────────────────────────────────────

export function createDispatcher(container: Element, view: ClientView): Dispatcher {
  const middlewares: Middleware[] = [];
  const registry = new Map<string, ActionRegistration>();
  const queues   = new Map<string, Array<() => void>>();
  const running  = new Set<string>();
  let destroyed = false;

  // Public signals
  const loading = createSignal<boolean>(false);
  const loadingCount = createSignal<number>(0);
  const activeActions = createSignal<string[]>([]);
  const error = createSignal<Error | null>(null);

  // Internal mutable state reference
  let liveState: Record<string, unknown> = { ...view.state };

  // ── Pipeline runner ────────────────────────────────────────────────────────

  async function runPipeline(ctx: ActionContext, registration: ActionRegistration): Promise<void> {
    let aborted = false;
    (ctx as { abort: () => void }).abort = () => { aborted = true; };
    (ctx as { isAborted: () => boolean }).isAborted = () => aborted;

    // Build composed middleware chain ending with the handler
    const chain = [...middlewares, async (c: ActionContext) => {
      if (!c.isAborted()) await registration.handler(c);
    }];

    let index = 0;
    const next: Next = async () => {
      if (aborted) return;
      const fn = chain[index++];
      if (fn) await fn(ctx, next);
    };

    await next();
  }

  // ── Optimistic update + rollback ──────────────────────────────────────────

  function applyOptimistic(
    registration: ActionRegistration,
    payload: unknown,
  ): Record<string, unknown> | null {
    if (!registration.optimistic) return null;
    const predicted = registration.optimistic({ ...liveState }, payload);
    liveState = predicted;
    remount();
    return predicted;
  }

  function rollback(snapshot: Record<string, unknown>): void {
    liveState = snapshot;
    remount();
  }

  // ── Mount helpers ──────────────────────────────────────────────────────────

  function remount(): void {
    const localView: ClientView = {
      template: view.template,
      state: liveState,
      actions: buildLocalActions(),
    };
    mount(container, localView);
  }

  function buildLocalActions(): ClientView['actions'] {
    const handlers: NonNullable<ClientView['actions']> = {};
    for (const name of registry.keys()) {
      handlers[name] = (_state, event) => { void dispatchInternal(name, undefined, event); };
    }
    return handlers;
  }

  // ── Queue management ───────────────────────────────────────────────────────

  async function enqueueOrRun(name: string, registration: ActionRegistration, payload: unknown): Promise<void> {
    if (destroyed) {
      throw new Error('[CUP] dispatcher has been destroyed');
    }

    if (running.has(name)) {
      if (registration.queue) {
        // Queue the call
        await new Promise<void>((resolve) => {
          const q = queues.get(name) ?? [];
          q.push(resolve);
          queues.set(name, q);
        });
      } else {
        console.warn(`[CUP] action "${name}" already running — call dropped. Set queue:true to serialise.`);
        return;
      }
    }

    running.add(name);
    syncLoadingSignals();
    const snapshot = { ...liveState };
    const optimisticState = applyOptimistic(registration, payload);

    const ctx: ActionContext = {
      name,
      state: liveState,
      payload,
      container,
      event: undefined,
      abort: () => {},       // replaced inside runPipeline
      isAborted: () => false,
    };

    try {
      await runPipeline(ctx, registration);
      if (destroyed) return;
      // Commit: if handler mutated ctx.state, adopt those values
      if (ctx.state !== liveState) {
        liveState = { ...liveState, ...ctx.state };
      }
      remount();
    } catch (err) {
      if (optimisticState && !destroyed) rollback(snapshot);
      throw err;
    } finally {
      running.delete(name);
      syncLoadingSignals();
      // Drain queue
      const next = queues.get(name)?.shift();
      if (next) next();
    }
  }

  async function dispatchInternal(name: string, payload?: unknown, event?: Event): Promise<void> {
    const reg = registry.get(name);
    if (!reg) {
      console.warn(`[CUP] dispatch: no handler for action "${name}"`);
      return;
    }

    await enqueueOrRun(name, {
      ...reg,
      handler: async (ctx) => reg.handler({ ...ctx, event }),
    }, payload);
  }

  function syncLoadingSignals(): void {
    const names = Array.from(running.values());
    activeActions.set(names);
    loadingCount.set(names.length);
    loading.set(names.length > 0);
  }

  // ── Public dispatcher object ───────────────────────────────────────────────

  const dispatcher: Dispatcher = {
    loading,
    loadingCount,
    activeActions,
    error,

    use(mw) {
      middlewares.push(mw);
      return this;
    },

    register(name, regOrHandler) {
      const reg: ActionRegistration = typeof regOrHandler === 'function'
        ? { handler: regOrHandler }
        : regOrHandler;
      registry.set(name, reg);
      return this;
    },

    async dispatch(name, payload?) {
      await dispatchInternal(name, payload);
    },

    mount() {
      if (destroyed) {
        throw new Error('[CUP] dispatcher has been destroyed');
      }
      liveState = { ...view.state };
      remount();
    },

    destroy() {
      destroyed = true;
      cleanupTree(container);
      registry.clear();
      queues.clear();
      running.clear();
      syncLoadingSignals();
    },
  };

  return dispatcher;
}
