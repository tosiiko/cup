import { render } from './parser.js';
import { ACTION_CLEANUP, cleanupTree, trackCleanup } from './cleanup.js';
import type { ClientActionHandler, ClientView } from './types.js';

/**
 * Mount a ClientView into a container element.
 * Renders the template with state, sets innerHTML, then binds actions.
 */
export function mount(container: Element, view: ClientView): void {
  cleanupTree(container);
  const html = render(view.template, view.state);
  container.innerHTML = html;

  if (view.actions) {
    bindActions(container, view.actions, view.state);
  }
}

/**
 * Re-render the view with updated state (full remount).
 * Returns a bound updater function for use with signals.
 */
export function createMountUpdater(container: Element, view: ClientView): (state: Record<string, unknown>) => void {
  mount(container, view);
  return (newState) => {
    mount(container, { ...view, state: newState });
  };
}

function bindActions(
  container: Element,
  actions: Record<string, ClientActionHandler>,
  state: Record<string, unknown>,
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

      void Promise.resolve(handler(state, event)).catch((error) => {
        console.error(`[CUP] action "${actionName}" failed`, error);
      });
    };

    container.addEventListener(eventName, listener);
    trackCleanup(container, ACTION_CLEANUP, () => {
      container.removeEventListener(eventName, listener);
    });
  }
}
