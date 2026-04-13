import { mount } from '../../src/mount.js';
import { unbind } from '../../src/bind.js';
import {
  clearInspection,
  recordInspectionError,
  recordProtocolMount,
} from '../../src/inspect.js';
import {
  createCapabilityHeaders,
  DEFAULT_RUNTIME_CAPABILITIES,
  negotiateCapabilities,
  type CapabilitySupport,
  type NegotiationResult,
} from '../../src/negotiation.js';
import { applyProtocolPatch, isProtocolPatch } from '../../src/patch.js';
import type {
  HTTPMethod,
  JSONValue,
  ProtocolPatch,
  ProtocolView,
} from '../../src/protocol.js';
import {
  emitRuntimeTrace,
  type TraceListener,
  type ValidationTraceContext,
} from '../../src/tracing.js';
import type { ClientView } from '../../src/types.js';
import { validateProtocolPatch, validateProtocolView } from '../../src/validate.js';

export interface RemoteMount {
  refresh(): Promise<void>;
  destroy(): void;
}

export interface RemoteStream {
  close(): void;
  destroy(): void;
  done: Promise<void>;
}

export interface FetchViewOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  validate?: boolean;
  fetchImpl?: typeof fetch;
  onError?: (error: Error, context: { url: string; method: HTTPMethod }) => void;
  capabilities?: CapabilitySupport;
  onNegotiated?: (result: NegotiationResult) => void;
  onTrace?: TraceListener;
}

export interface FetchViewStreamOptions extends FetchViewOptions {
  onChunk?: (view: ProtocolView) => void;
}

type RemotePayload = ProtocolView | ProtocolPatch;

export async function fetchView(
  url: string,
  container: Element,
  options: FetchViewOptions = {},
): Promise<RemoteMount> {
  let currentState: Record<string, JSONValue> = {};
  let currentView: ProtocolView | null = null;
  let destroyed = false;
  const fetchImpl = requireFetchImpl(options.fetchImpl, 'fetchView');
  const capabilities = options.capabilities ?? DEFAULT_RUNTIME_CAPABILITIES;

  async function load(
    fetchUrl: string,
    method: HTTPMethod = 'GET',
    body?: Record<string, JSONValue>,
  ): Promise<RemotePayload> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 5000;
    const headers = {
      'Content-Type': 'application/json',
      ...createCapabilityHeaders(capabilities),
      ...(options.headers ?? {}),
    };
    const request: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (body !== undefined) {
      if (method === 'GET') {
        fetchUrl = appendQuery(fetchUrl, body);
      } else {
        request.body = JSON.stringify(body);
      }
    }

    try {
      const response = await fetchImpl(fetchUrl, request);
      if (!response.ok) {
        throw new Error(`[CUP] fetchView: ${method} ${fetchUrl} -> ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      return normalizePayload(payload, options.validate, {
        capabilities,
        container,
        onTrace: options.onTrace,
        context: { url: fetchUrl, method, source: 'remote' },
      });
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
    unbind(container);

    const localView: ClientView = {
      template: remoteView.template,
      state: remoteView.state,
      actions: buildActionHandlers(remoteView, container),
    };

    mount(container, localView, { traceActions: false });
    recordProtocolMount(container, remoteView);
    options.onNegotiated?.(negotiateCapabilities(remoteView, capabilities));
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
            const startedAt = now();
            emitActionTrace(el, options.onTrace, {
              phase: 'start',
              name,
              actionType: 'fetch',
              method: descriptor.method ?? 'POST',
              url: descriptor.url,
            });
            try {
              const updated = resolvePayload(await load(
                descriptor.url,
                descriptor.method ?? 'POST',
                { ...currentState, ...(descriptor.payload ?? {}) },
              ));
              if (destroyed) return;
              mountRemote(updated);
              emitActionTrace(el, options.onTrace, {
                phase: 'success',
                name,
                actionType: 'fetch',
                method: descriptor.method ?? 'POST',
                url: descriptor.url,
                durationMs: now() - startedAt,
              });
            } catch (error) {
              const normalized = error instanceof Error ? error : new Error(String(error));
              emitActionTrace(el, options.onTrace, {
                phase: 'error',
                name,
                actionType: 'fetch',
                method: descriptor.method ?? 'POST',
                url: descriptor.url,
                durationMs: now() - startedAt,
                error: normalized.message,
              });
              if (!(event instanceof Event)) {
                console.error(`[CUP] action "${name}" failed:`, normalized);
              }
            }
          };
          break;
        case 'emit':
          handlers[name] = () => {
            const startedAt = now();
            emitActionTrace(el, options.onTrace, {
              phase: 'start',
              name,
              actionType: 'emit',
            });
            el.dispatchEvent(
              new CustomEvent(descriptor.event, {
                bubbles: true,
                detail: descriptor.detail ?? {},
              }),
            );
            emitActionTrace(el, options.onTrace, {
              phase: 'success',
              name,
              actionType: 'emit',
              durationMs: now() - startedAt,
            });
          };
          break;
        case 'navigate':
          handlers[name] = () => {
            const startedAt = now();
            emitActionTrace(el, options.onTrace, {
              phase: 'start',
              name,
              actionType: 'navigate',
              url: descriptor.url,
            });
            if (descriptor.replace) {
              history.replaceState(null, '', descriptor.url);
            } else {
              history.pushState(null, '', descriptor.url);
            }
            window.dispatchEvent(new PopStateEvent('popstate'));
            emitActionTrace(el, options.onTrace, {
              phase: 'success',
              name,
              actionType: 'navigate',
              url: descriptor.url,
              durationMs: now() - startedAt,
            });
          };
          break;
      }
    }

    return handlers;
  }

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
      return validateProtocolView(applyProtocolPatch(currentView, payload), {
        capabilities,
        container,
        onTrace: options.onTrace,
        context: { source: 'patch' },
      });
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
  const fetchImpl = requireFetchImpl(options.fetchImpl, 'fetchViewStream');
  const capabilities = options.capabilities ?? DEFAULT_RUNTIME_CAPABILITIES;
  const controller = new AbortController();
  const headers = {
    Accept: 'application/x-ndjson, application/json',
    ...createCapabilityHeaders(capabilities),
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

    mount(container, localView, { traceActions: false });
    recordProtocolMount(container, remoteView);
    options.onNegotiated?.(negotiateCapabilities(remoteView, capabilities));
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
            const startedAt = now();
            emitActionTrace(el, options.onTrace, {
              phase: 'start',
              name,
              actionType: 'fetch',
              method: descriptor.method ?? 'POST',
              url: descriptor.url,
            });
            try {
              const updated = await loadActionResponse(
                descriptor.url,
                descriptor.method ?? 'POST',
                { ...currentState, ...(descriptor.payload ?? {}) },
              );
              if (destroyed) return;
              mountRemote(updated);
              emitActionTrace(el, options.onTrace, {
                phase: 'success',
                name,
                actionType: 'fetch',
                method: descriptor.method ?? 'POST',
                url: descriptor.url,
                durationMs: now() - startedAt,
              });
            } catch (error) {
              const normalized = error instanceof Error ? error : new Error(String(error));
              emitActionTrace(el, options.onTrace, {
                phase: 'error',
                name,
                actionType: 'fetch',
                method: descriptor.method ?? 'POST',
                url: descriptor.url,
                durationMs: now() - startedAt,
                error: normalized.message,
              });
              if (!(event instanceof Event)) {
                console.error(`[CUP] action "${name}" failed:`, normalized);
              }
            }
          };
          break;
        case 'emit':
          handlers[name] = () => {
            const startedAt = now();
            emitActionTrace(el, options.onTrace, {
              phase: 'start',
              name,
              actionType: 'emit',
            });
            el.dispatchEvent(
              new CustomEvent(descriptor.event, {
                bubbles: true,
                detail: descriptor.detail ?? {},
              }),
            );
            emitActionTrace(el, options.onTrace, {
              phase: 'success',
              name,
              actionType: 'emit',
              durationMs: now() - startedAt,
            });
          };
          break;
        case 'navigate':
          handlers[name] = () => {
            const startedAt = now();
            emitActionTrace(el, options.onTrace, {
              phase: 'start',
              name,
              actionType: 'navigate',
              url: descriptor.url,
            });
            if (descriptor.replace) {
              history.replaceState(null, '', descriptor.url);
            } else {
              history.pushState(null, '', descriptor.url);
            }
            window.dispatchEvent(new PopStateEvent('popstate'));
            emitActionTrace(el, options.onTrace, {
              phase: 'success',
              name,
              actionType: 'navigate',
              url: descriptor.url,
              durationMs: now() - startedAt,
            });
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
    const actionHeaders = {
      'Content-Type': 'application/json',
      ...createCapabilityHeaders(capabilities),
      ...(options.headers ?? {}),
    };
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
      const response = await fetchImpl(fetchUrl, request);
      if (!response.ok) {
        throw new Error(`[CUP] fetchViewStream: ${method} ${fetchUrl} -> ${response.status} ${response.statusText}`);
      }
      const payload = await response.json();
      return resolvePayload(normalizePayload(payload, options.validate, {
        capabilities,
        container,
        onTrace: options.onTrace,
        context: { url: fetchUrl, method, source: 'remote' },
      }));
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
      return validateProtocolView(applyProtocolPatch(currentView, payload), {
        capabilities,
        container,
        onTrace: options.onTrace,
        context: { source: 'patch' },
      });
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
    const payload = normalizePayload(JSON.parse(line), options.validate, {
      capabilities,
      container,
      onTrace: options.onTrace,
      context: { url, method: 'GET', source: 'stream' },
    });
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

function requireFetchImpl(
  fetchImpl: FetchViewOptions['fetchImpl'],
  caller: 'fetchView' | 'fetchViewStream',
): NonNullable<FetchViewOptions['fetchImpl']> {
  if (fetchImpl) {
    return fetchImpl;
  }

  throw new Error(
    `[CUP] ${caller} requires options.fetchImpl. Inject the transport from your app instead of relying on an implicit global network client.`,
  );
}

function normalizePayload(
  payload: unknown,
  shouldValidate = true,
  options?: {
    capabilities: CapabilitySupport;
    container: Element;
    onTrace?: TraceListener;
    context: ValidationTraceContext;
  },
): RemotePayload {
  if (!shouldValidate || !options) {
    return isProtocolPatch(payload) ? payload as ProtocolPatch : payload as ProtocolView;
  }

  return isProtocolPatch(payload)
    ? validateProtocolPatch(payload, {
      capabilities: options.capabilities,
      container: options.container,
      onTrace: options.onTrace,
      context: options.context,
    })
    : validateProtocolView(payload, {
      capabilities: options.capabilities,
      container: options.container,
      onTrace: options.onTrace,
      context: options.context,
    });
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

function emitActionTrace(
  container: Element,
  listener: TraceListener | undefined,
  trace: Omit<Parameters<typeof emitRuntimeTrace>[0], 'kind' | 'at' | 'source'> & {
    phase: 'start' | 'success' | 'error';
    name: string;
    actionType: 'fetch' | 'emit' | 'navigate';
  },
): void {
  emitRuntimeTrace({
    kind: 'action',
    at: new Date().toISOString(),
    source: 'remote',
    ...trace,
  }, {
    container,
    listener,
  });
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
