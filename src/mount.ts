import { render } from './parser.js';
import { ACTION_CLEANUP, cleanupTree, trackCleanup } from './cleanup.js';
import { recordClientMount } from './inspect.js';
import { emitRuntimeTrace } from './tracing.js';
import type { ClientActionHandler, ClientView } from './types.js';

export interface MountOptions {
  traceActions?: boolean;
}

/**
 * Mount a ClientView into a container element.
 * Renders the template with state, sets innerHTML, then binds actions.
 */
export function mount(container: Element, view: ClientView, options: MountOptions = {}): void {
  cleanupTree(container);
  const html = render(view.template, view.state);
  container.innerHTML = html;
  recordClientMount(container, view);

  if (view.actions) {
    bindActions(container, view.actions, view.state, options.traceActions !== false);
  }
}

/**
 * Re-render the view with updated state (full remount).
 * Returns a bound updater function for use with signals.
 */
export function createMountUpdater(container: Element, view: ClientView, options: MountOptions = {}): (state: Record<string, unknown>) => void {
  mount(container, view, options);
  return (newState) => {
    mount(container, { ...view, state: newState }, options);
  };
}

function bindActions(
  container: Element,
  actions: Record<string, ClientActionHandler>,
  state: Record<string, unknown>,
  traceActions: boolean,
): void {
  const eventNames = new Set<string>();

  container.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
    eventNames.add(el.dataset['event'] ?? 'click');
  });

  for (const eventName of eventNames) {
    const listener = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
      if (!target || !container.contains(target)) return;

      const actionName = target.dataset['action'];
      if (!actionName) return;

      const actionEvent = target.dataset['event'] ?? 'click';
      if (actionEvent !== eventName) return;

      const handler = actions[actionName];
      if (!handler) {
        console.warn(`[CUP] No action defined for "${actionName}"`);
        return;
      }

      const startedAt = now();
      if (traceActions) {
        emitRuntimeTrace({
          kind: 'action',
          at: new Date().toISOString(),
          source: 'mount',
          phase: 'start',
          name: actionName,
          actionType: 'client',
        }, { container });
      }

      void Promise.resolve(handler(state, event))
        .then(() => {
          if (!traceActions) return;
          emitRuntimeTrace({
            kind: 'action',
            at: new Date().toISOString(),
            source: 'mount',
            phase: 'success',
            name: actionName,
            actionType: 'client',
            durationMs: now() - startedAt,
          }, { container });
        })
        .catch((error) => {
          if (traceActions) {
            emitRuntimeTrace({
              kind: 'action',
              at: new Date().toISOString(),
              source: 'mount',
              phase: 'error',
              name: actionName,
              actionType: 'client',
              durationMs: now() - startedAt,
              error: error instanceof Error ? error.message : String(error),
            }, { container });
          }
          console.error(`[CUP] action "${actionName}" failed`, error);
        });
    };

    container.addEventListener(eventName, listener);
    trackCleanup(container, ACTION_CLEANUP, () => {
      container.removeEventListener(eventName, listener);
    });
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
