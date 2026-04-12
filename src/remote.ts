/**
 * CUP Remote Module — Phase 4
 *
 * Bridges the TypeScript runtime with multi-language backends.
 *
 * fetchView(url, container)
 *   → GETs a UIView JSON from any backend, mounts it, wires server actions.
 *
 * Server actions (type: "fetch") POST the current state snapshot to the
 * endpoint and remount the returned UIView — no page reload required.
 *
 * Client actions (type: "emit", "navigate") are handled entirely in the browser.
 */

import { mount } from './mount.js';
import { unbind } from './bind.js';
import type {
  ActionDescriptor,
  HTTPMethod,
  JSONValue,
  ProtocolView,
} from './protocol.js';
import type { ClientView } from './types.js';
import { validateProtocolView } from './validate.js';

// ── Remote fetch + mount ──────────────────────────────────────────────────────

export interface RemoteMount {
  /** Refetch the view from the original URL and remount. */
  refresh(): Promise<void>;
  /** Unmount and clean up all subscriptions. */
  destroy(): void;
}

export interface FetchViewOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  validate?: boolean;
  fetchImpl?: typeof fetch;
  onError?: (error: Error, context: { url: string; method: HTTPMethod }) => void;
}

/**
 * Fetch a UIView from a backend URL, mount it into container,
 * and wire all action descriptors.
 *
 * @param url       Backend endpoint that returns UIView JSON
 * @param container DOM element to mount into
 * @param headers   Extra request headers (e.g. Authorization)
 */
export async function fetchView(
  url: string,
  container: Element,
  options: FetchViewOptions = {},
): Promise<RemoteMount> {
  let currentState: Record<string, JSONValue> = {};
  let destroyed = false;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function load(fetchUrl: string, method: HTTPMethod = 'GET', body?: Record<string, JSONValue>): Promise<ProtocolView> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 5000;
    const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
    const opts: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (body !== undefined) {
      if (method === 'GET') {
        fetchUrl = appendQuery(fetchUrl, body);
      } else {
        opts.body = JSON.stringify(body);
      }
    }

    try {
      const res = await fetchImpl(fetchUrl, opts);
      if (!res.ok) {
        throw new Error(`[CUP] fetchView: ${method} ${fetchUrl} -> ${res.status} ${res.statusText}`);
      }

      const payload = await res.json();
      return options.validate === false ? payload as ProtocolView : validateProtocolView(payload);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      options.onError?.(normalized, { url: fetchUrl, method });
      throw normalized;
    } finally {
      clearTimeout(timer);
    }
  }

  function mountRemote(remoteView: ProtocolView): void {
    currentState = remoteView.state;

    // Unbind previous subscriptions before remounting
    unbind(container);

    const localView: ClientView = {
      template: remoteView.template,
      state: remoteView.state,
      actions: buildActionHandlers(remoteView, container),
    };

    mount(container, localView);

    // Log source language in dev mode
    if (remoteView.meta?.lang) {
      console.debug(`[CUP] mounted view from ${remoteView.meta.generator ?? remoteView.meta.lang}`);
    }
  }

  function buildActionHandlers(
    remoteView: ProtocolView,
    el: Element,
  ): ClientView['actions'] {
    if (!remoteView.actions) return undefined;

    const handlers: NonNullable<ClientView['actions']> = {};

    for (const [name, descriptor] of Object.entries(remoteView.actions)) {
      switch (descriptor.type) {
        case 'fetch':
          handlers[name] = async (_state, event) => {
            try {
              const updated = await load(
                descriptor.url,
                descriptor.method ?? 'POST',
                { ...currentState, ...(descriptor.payload ?? {}) },
              );
              mountRemote(updated);
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              options.onError?.(error, { url: descriptor.url, method: descriptor.method ?? 'POST' });
              if (!(event instanceof Event)) {
                console.error(`[CUP] action "${name}" failed:`, error);
              }
            }
          };
          break;

        case 'emit':
          handlers[name] = () => {
            el.dispatchEvent(
              new CustomEvent(descriptor.event, {
                bubbles: true,
                detail: descriptor.detail ?? {},
              }),
            );
          };
          break;

        case 'navigate':
          handlers[name] = () => {
            if (descriptor.replace) {
              history.replaceState(null, '', descriptor.url);
            } else {
              history.pushState(null, '', descriptor.url);
            }
            window.dispatchEvent(new PopStateEvent('popstate'));
          };
          break;
      }
    }

    return handlers;
  }

  // Initial load
  const initialView = await load(url);
  if (destroyed) {
    throw new Error('[CUP] remote mount destroyed before initial load completed');
  }
  mountRemote(initialView);

  return {
    async refresh() {
      if (destroyed) return;
      const updated = await load(url);
      mountRemote(updated);
    },
    destroy() {
      destroyed = true;
      unbind(container);
      container.innerHTML = '';
    },
  };
}

// ── Utility: parse a static RemoteUIView object (for testing / SSR) ───────────

/**
 * Mount a RemoteUIView that was already fetched or inlined as JSON.
 * Useful for server-side rendering or unit tests.
 */
export function mountRemoteView(remoteView: ProtocolView, container: Element, options: { validate?: boolean } = {}): void {
  const view = options.validate === false ? remoteView : validateProtocolView(remoteView);
  const localView: ClientView = {
    template: view.template,
    state: view.state,
    actions: buildStaticActions(view, container),
  };
  mount(container, localView);
}

function buildStaticActions(remoteView: ProtocolView, container: Element): ClientView['actions'] {
  if (!remoteView.actions) return undefined;
  const handlers: NonNullable<ClientView['actions']> = {};
  for (const [name, descriptor] of Object.entries(remoteView.actions)) {
    if (descriptor.type === 'emit') {
      handlers[name] = () => {
        container.dispatchEvent(
          new CustomEvent(descriptor.event, { bubbles: true, detail: descriptor.detail ?? {} }),
        );
      };
    } else if (descriptor.type === 'navigate') {
      handlers[name] = () => {
        history.pushState(null, '', descriptor.url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      };
    }
    // fetch actions are no-ops in static mode
  }
  return handlers;
}

function appendQuery(url: string, values: Record<string, JSONValue>): string {
  const target = new URL(url, window.location.origin);
  for (const [key, value] of Object.entries(values)) {
    target.searchParams.set(key, serializeQueryValue(value));
  }
  return target.toString();
}

function serializeQueryValue(value: JSONValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export type { ActionDescriptor, ProtocolView as RemoteUIView };
