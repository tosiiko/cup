import { mount } from './mount.js';
import { recordInspectionError, recordProtocolMount } from './inspect.js';
import type { ProtocolView } from './protocol.js';
import type { ClientView } from './types.js';
import { validateProtocolView } from './validate.js';

/**
 * Mount a protocol view that was already fetched or inlined as JSON.
 * Useful for server-rendered bootstraps and custom transport shells.
 */
export function mountRemoteView(
  remoteView: ProtocolView,
  container: Element,
  options: { validate?: boolean } = {},
): void {
  let view: ProtocolView;
  try {
    view = options.validate === false ? remoteView : validateProtocolView(remoteView);
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    recordInspectionError(container, normalized);
    throw normalized;
  }

  const localView: ClientView = {
    template: view.template,
    state: view.state,
    actions: buildStaticActions(view, container),
  };

  mount(container, localView);
  recordProtocolMount(container, view);
}

function buildStaticActions(remoteView: ProtocolView, container: Element): ClientView['actions'] {
  if (!remoteView.actions) return undefined;

  const handlers: NonNullable<ClientView['actions']> = {};
  for (const [name, descriptor] of Object.entries(remoteView.actions)) {
    if (descriptor.type === 'emit') {
      handlers[name] = () => {
        container.dispatchEvent(
          new CustomEvent(descriptor.event, {
            bubbles: true,
            detail: descriptor.detail ?? {},
          }),
        );
      };
      continue;
    }

    if (descriptor.type === 'navigate') {
      handlers[name] = () => {
        if (descriptor.replace) {
          history.replaceState(null, '', descriptor.url);
        } else {
          history.pushState(null, '', descriptor.url);
        }
        window.dispatchEvent(new PopStateEvent('popstate'));
      };
    }
  }

  return handlers;
}

export type { ProtocolView as RemoteUIView };
