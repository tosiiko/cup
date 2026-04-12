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
import {
  clearInspection,
  recordInspectionError,
  recordProtocolMount,
} from './inspect.js';
import { applyProtocolPatch, isProtocolPatch } from './patch.js';
import type {
  ActionDescriptor,
  HTTPMethod,
  JSONValue,
  ProtocolPatch,
  ProtocolView,
} from './protocol.js';
import type { ClientView } from './types.js';
import { validateProtocolPatch, validateProtocolView } from './validate.js';

// ── Remote fetch + mount ──────────────────────────────────────────────────────

export interface RemoteMount {
  /** Refetch the view from the original URL and remount. */
  refresh(): Promise<void>;
  /** Unmount and clean up all subscriptions. */
  destroy(): void;
}

export interface RemoteStream {
  /** Abort the stream without clearing the mounted view. */
  close(): void;
  /** Abort the stream and unmount the current view. */
  destroy(): void;
  /** Resolves when the stream finishes or rejects on stream error. */
  done: Promise<void>;
}

export interface FetchViewOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  validate?: boolean;
  fetchImpl?: typeof fetch;
  onError?: (error: Error, context: { url: string; method: HTTPMethod }) => void;
}

export interface FetchViewStreamOptions extends FetchViewOptions {
  onChunk?: (view: ProtocolView) => void;
}

type RemotePayload = ProtocolView | ProtocolPatch;

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
  let currentView: ProtocolView | null = null;
  let destroyed = false;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function load(fetchUrl: string, method: HTTPMethod = 'GET', body?: Record<string, JSONValue>): Promise<RemotePayload> {
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
      return normalizePayload(payload, options.validate);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (!destroyed) {
        recordInspectionError(container, normalized, { url: fetchUrl, method });
      }
      options.onError?.(normalized, { url: fetchUrl, method });
      throw normalized;
    } finally {
      clearTimeout(timer);
    }
  }

  function mountRemote(remoteView: ProtocolView): void {
    currentState = remoteView.state;
    currentView = remoteView;

    // Unbind previous subscriptions before remounting
    unbind(container);

    const localView: ClientView = {
      template: remoteView.template,
      state: remoteView.state,
      actions: buildActionHandlers(remoteView, container),
    };

    mount(container, localView);
    recordProtocolMount(container, remoteView);

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
              const updated = resolvePayload(await load(
                descriptor.url,
                descriptor.method ?? 'POST',
                { ...currentState, ...(descriptor.payload ?? {}) },
              ));
              if (destroyed) return;
              mountRemote(updated);
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
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
  const initialView = resolvePayload(await load(url));
  if (destroyed) {
    throw new Error('[CUP] remote mount destroyed before initial load completed');
  }
  mountRemote(initialView);

  return {
    async refresh() {
      if (destroyed) return;
      const updated = resolvePayload(await load(url));
      if (destroyed) return;
      mountRemote(updated);
    },
    destroy() {
      destroyed = true;
      unbind(container);
      container.innerHTML = '';
      clearInspection(container);
    },
  };

  function resolvePayload(payload: RemotePayload): ProtocolView {
    if (isProtocolPatch(payload)) {
      if (!currentView) {
        throw new Error('[CUP] received a patch before any remote view was mounted');
      }
      return applyProtocolPatch(currentView, payload);
    }
    return payload;
  }
}

export async function fetchViewStream(
  url: string,
  container: Element,
  options: FetchViewStreamOptions = {},
): Promise<RemoteStream> {
  let currentState: Record<string, JSONValue> = {};
  let currentView: ProtocolView | null = null;
  let destroyed = false;
  let closed = false;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const headers = {
    Accept: 'application/x-ndjson, application/json',
    ...(options.headers ?? {}),
  };

  function mountRemote(remoteView: ProtocolView): void {
    currentState = remoteView.state;
    currentView = remoteView;
    unbind(container);

    const localView: ClientView = {
      template: remoteView.template,
      state: remoteView.state,
      actions: buildActionHandlers(remoteView, container),
    };

    mount(container, localView);
    recordProtocolMount(container, remoteView);
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
              const updated = await loadActionResponse(
                descriptor.url,
                descriptor.method ?? 'POST',
                { ...currentState, ...(descriptor.payload ?? {}) },
              );
              if (destroyed) return;
              mountRemote(updated);
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
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

  async function loadActionResponse(
    fetchUrl: string,
    method: HTTPMethod = 'GET',
    body?: Record<string, JSONValue>,
  ): Promise<ProtocolView> {
    const actionController = new AbortController();
    const timeoutMs = options.timeoutMs ?? 5000;
    const actionHeaders = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
    const request: RequestInit = {
      method,
      headers: actionHeaders,
      signal: actionController.signal,
    };
    const timer = setTimeout(() => actionController.abort(), timeoutMs);

    if (body !== undefined) {
      if (method === 'GET') {
        fetchUrl = appendQuery(fetchUrl, body);
      } else {
        request.body = JSON.stringify(body);
      }
    }

    try {
      const res = await fetchImpl(fetchUrl, request);
      if (!res.ok) {
        throw new Error(`[CUP] fetchViewStream: ${method} ${fetchUrl} -> ${res.status} ${res.statusText}`);
      }
      const payload = await res.json();
      return resolvePayload(normalizePayload(payload, options.validate));
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (!destroyed) {
        recordInspectionError(container, normalized, { url: fetchUrl, method });
      }
      options.onError?.(normalized, { url: fetchUrl, method });
      throw normalized;
    } finally {
      clearTimeout(timer);
    }
  }

  function resolvePayload(payload: RemotePayload): ProtocolView {
    if (isProtocolPatch(payload)) {
      if (!currentView) {
        throw new Error('[CUP] received a patch before any remote view was mounted');
      }
      return applyProtocolPatch(currentView, payload);
    }
    return payload;
  }

  const response = await fetchImpl(url, {
    method: 'GET',
    headers,
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`[CUP] fetchViewStream: GET ${url} -> ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('[CUP] fetchViewStream: response body is not readable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const done = (async () => {
    let buffer = '';
    try {
      while (!destroyed && !closed) {
        const { done: finished, value } = await reader.read();
        if (finished) {
          buffer += decoder.decode();
          flushBuffer(buffer);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          flushBuffer(line);
        }
      }
    } catch (error) {
      if (destroyed || closed) return;
      const normalized = error instanceof Error ? error : new Error(String(error));
      recordInspectionError(container, normalized, { url, method: 'GET' });
      options.onError?.(normalized, { url, method: 'GET' });
      throw normalized;
    }
  })();

  function flushBuffer(rawLine: string): void {
    const line = rawLine.trim();
    if (!line || destroyed || closed) return;
    const payload = normalizePayload(JSON.parse(line), options.validate);
    const nextView = resolvePayload(payload);
    mountRemote(nextView);
    options.onChunk?.(nextView);
  }

  return {
    close() {
      closed = true;
      controller.abort();
    },
    destroy() {
      destroyed = true;
      closed = true;
      controller.abort();
      unbind(container);
      container.innerHTML = '';
      clearInspection(container);
    },
    done,
  };
}

// ── Utility: parse a static RemoteUIView object (for testing / SSR) ───────────

/**
 * Mount a RemoteUIView that was already fetched or inlined as JSON.
 * Useful for server-side rendering or unit tests.
 */
export function mountRemoteView(remoteView: ProtocolView, container: Element, options: { validate?: boolean } = {}): void {
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

function normalizePayload(payload: unknown, shouldValidate = true): RemotePayload {
  if (!shouldValidate) {
    return isProtocolPatch(payload) ? payload as ProtocolPatch : payload as ProtocolView;
  }
  return isProtocolPatch(payload) ? validateProtocolPatch(payload) : validateProtocolView(payload);
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
        if (descriptor.replace) {
          history.replaceState(null, '', descriptor.url);
        } else {
          history.pushState(null, '', descriptor.url);
        }
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

export type { ActionDescriptor, ProtocolPatch, ProtocolView as RemoteUIView };
