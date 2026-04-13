import type { ActionDescriptor, HTTPMethod } from './protocol.js';

export interface RenderTrace {
  kind: 'render';
  at: string;
  source: 'client' | 'remote';
  templateLength: number;
  stateKeys: string[];
  actionNames: string[];
  title?: string;
  route?: string;
  extensions: string[];
}

export interface ActionTrace {
  kind: 'action';
  at: string;
  source: 'mount' | 'dispatcher' | 'remote';
  phase: 'start' | 'success' | 'error' | 'rollback';
  name: string;
  actionType: ActionDescriptor['type'] | 'client';
  durationMs?: number;
  method?: HTTPMethod;
  url?: string;
  error?: string;
}

export interface ValidationTraceContext {
  method?: HTTPMethod;
  url?: string;
  source?: 'static' | 'remote' | 'stream' | 'patch';
}

export interface ValidationTrace {
  kind: 'validation';
  at: string;
  target: 'view' | 'patch';
  status: 'passed' | 'failed';
  durationMs: number;
  issues: string[];
  protocolVersion?: string;
  requiredExtensions: string[];
  negotiatedExtensions: Record<string, string>;
  missingRequiredExtensions: string[];
  context?: ValidationTraceContext;
}

export type RuntimeTrace = RenderTrace | ActionTrace | ValidationTrace;
export type TraceListener = (trace: RuntimeTrace) => void;

type TraceSnapshotListener = (snapshot: RuntimeTrace[]) => void;

export interface TraceObserver {
  snapshot(): RuntimeTrace[];
  subscribe(fn: TraceSnapshotListener): () => void;
}

const MAX_TRACE_RECORDS = 200;
const records = new WeakMap<Element, RuntimeTrace[]>();
const listeners = new WeakMap<Element, Set<TraceSnapshotListener>>();

export function createTraceObserver(container: Element): TraceObserver {
  return {
    snapshot() {
      return inspectTraces(container);
    },
    subscribe(fn) {
      const target = listeners.get(container) ?? new Set<TraceSnapshotListener>();
      target.add(fn);
      listeners.set(container, target);
      fn(inspectTraces(container));
      return () => {
        target.delete(fn);
        if (target.size === 0) {
          listeners.delete(container);
        }
      };
    },
  };
}

export function inspectTraces(container: Element): RuntimeTrace[] {
  const traceList = records.get(container) ?? [];
  return traceList.map((trace) => cloneTrace(trace));
}

export function emitRuntimeTrace(
  trace: RuntimeTrace,
  options: { container?: Element; listener?: TraceListener } = {},
): void {
  options.listener?.(trace);

  if (!options.container) {
    return;
  }

  const current = records.get(options.container) ?? [];
  const next = [...current, cloneTrace(trace)].slice(-MAX_TRACE_RECORDS);
  records.set(options.container, next);
  notify(options.container);
}

export function clearTraces(container: Element): void {
  records.delete(container);
  notify(container, []);
}

function notify(container: Element, snapshot = inspectTraces(container)): void {
  const target = listeners.get(container);
  if (!target) return;
  for (const listener of target) {
    listener(snapshot);
  }
}

function cloneTrace(trace: RuntimeTrace): RuntimeTrace {
  return cloneValue(trace);
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry)) as T;
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = cloneValue(entry);
    }
    return out as T;
  }

  return value;
}
