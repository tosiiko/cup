import { mount } from './mount.js';
import { recordInspectionError, recordProtocolMount } from './inspect.js';
import type { ProtocolView } from './protocol.js';
import {
  DEFAULT_RUNTIME_CAPABILITIES,
  negotiateCapabilities,
  type CapabilitySupport,
  type NegotiationResult,
} from './negotiation.js';
import { emitRuntimeTrace, type TraceListener } from './tracing.js';
import type { ClientView } from './types.js';
import { validateProtocolView } from './validate.js';

/**
 * Mount a protocol view that was already fetched or inlined as JSON.
 * Useful for server-rendered bootstraps and custom transport shells.
 */
export function mountRemoteView(
  remoteView: ProtocolView,
  container: Element,
  options: {
    validate?: boolean;
    capabilities?: CapabilitySupport;
    onTrace?: TraceListener;
    onNegotiated?: (result: NegotiationResult) => void;
  } = {},
): void {
  let view: ProtocolView;
  const capabilities = options.capabilities ?? DEFAULT_RUNTIME_CAPABILITIES;
  try {
    view = options.validate === false
      ? remoteView
      : validateProtocolView(remoteView, {
        capabilities,
        container,
        onTrace: options.onTrace,
        context: { source: 'static' },
      });
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    recordInspectionError(container, normalized);
    throw normalized;
  }

  const localView: ClientView = {
    template: view.template,
    state: view.state,
    actions: buildStaticActions(view, container, options.onTrace),
  };

  mount(container, localView, { traceActions: false });
  recordProtocolMount(container, view);
  options.onNegotiated?.(negotiateCapabilities(view, capabilities));
}

function buildStaticActions(
  remoteView: ProtocolView,
  container: Element,
  onTrace?: TraceListener,
): ClientView['actions'] {
  if (!remoteView.actions) return undefined;

  const handlers: NonNullable<ClientView['actions']> = {};
  for (const [name, descriptor] of Object.entries(remoteView.actions)) {
    if (descriptor.type === 'emit') {
      handlers[name] = () => {
        const startedAt = now();
        emitRuntimeTrace({
          kind: 'action',
          at: new Date().toISOString(),
          source: 'remote',
          phase: 'start',
          name,
          actionType: 'emit',
        }, {
          container,
          listener: onTrace,
        });
        container.dispatchEvent(
          new CustomEvent(descriptor.event, {
            bubbles: true,
            detail: descriptor.detail ?? {},
          }),
        );
        emitRuntimeTrace({
          kind: 'action',
          at: new Date().toISOString(),
          source: 'remote',
          phase: 'success',
          name,
          actionType: 'emit',
          durationMs: now() - startedAt,
        }, {
          container,
          listener: onTrace,
        });
      };
      continue;
    }

    if (descriptor.type === 'navigate') {
      handlers[name] = () => {
        const startedAt = now();
        emitRuntimeTrace({
          kind: 'action',
          at: new Date().toISOString(),
          source: 'remote',
          phase: 'start',
          name,
          actionType: 'navigate',
          url: descriptor.url,
        }, {
          container,
          listener: onTrace,
        });
        if (descriptor.replace) {
          history.replaceState(null, '', descriptor.url);
        } else {
          history.pushState(null, '', descriptor.url);
        }
        window.dispatchEvent(new PopStateEvent('popstate'));
        emitRuntimeTrace({
          kind: 'action',
          at: new Date().toISOString(),
          source: 'remote',
          phase: 'success',
          name,
          actionType: 'navigate',
          url: descriptor.url,
          durationMs: now() - startedAt,
        }, {
          container,
          listener: onTrace,
        });
      };
    }
  }

  return handlers;
}

export type { ProtocolView as RemoteUIView };

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
