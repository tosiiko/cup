import type {
  ActionDescriptor,
  HTTPMethod,
  ProtocolView,
  ViewMeta,
} from './protocol.js';
import type { ClientView } from './types.js';

type InspectorListener = (snapshot: InspectorSnapshot | null) => void;

interface ClientMountRecord {
  template: string;
  state: Record<string, unknown>;
  actionNames: string[];
}

interface ProtocolMountRecord {
  template: string;
  state: Record<string, unknown>;
  actions: Record<string, ActionDescriptor> | null;
  meta: ViewMeta | null;
}

interface InspectorRecord {
  source: 'client' | 'remote' | null;
  client: ClientMountRecord | null;
  protocol: ProtocolMountRecord | null;
  lastError: InspectorError | null;
  updatedAt: string;
}

export interface InspectorError {
  message: string;
  issues?: string[];
  context?: {
    method?: HTTPMethod;
    url?: string;
  };
  at: string;
}

export interface InspectorSnapshot {
  source: 'client' | 'remote' | null;
  template: string | null;
  state: Record<string, unknown> | null;
  clientActionNames: string[];
  remoteActions: Record<string, ActionDescriptor> | null;
  meta: ViewMeta | null;
  lastError: InspectorError | null;
  updatedAt: string;
}

export interface Inspector {
  snapshot(): InspectorSnapshot | null;
  subscribe(fn: InspectorListener): () => void;
}

const records = new WeakMap<Element, InspectorRecord>();
const listeners = new WeakMap<Element, Set<InspectorListener>>();

export function inspectView(container: Element): InspectorSnapshot | null {
  const record = records.get(container);
  if (!record) return null;

  return {
    source: record.source,
    template: record.protocol?.template ?? record.client?.template ?? null,
    state: cloneInspectable(record.protocol?.state ?? record.client?.state ?? null),
    clientActionNames: [...(record.client?.actionNames ?? [])],
    remoteActions: cloneInspectable(record.protocol?.actions ?? null),
    meta: cloneInspectable(record.protocol?.meta ?? null),
    lastError: cloneInspectable(record.lastError),
    updatedAt: record.updatedAt,
  };
}

export function createInspector(container: Element): Inspector {
  return {
    snapshot() {
      return inspectView(container);
    },
    subscribe(fn) {
      const target = listeners.get(container) ?? new Set<InspectorListener>();
      target.add(fn);
      listeners.set(container, target);
      fn(inspectView(container));
      return () => {
        target.delete(fn);
        if (target.size === 0) {
          listeners.delete(container);
        }
      };
    },
  };
}

export function recordClientMount(container: Element, view: ClientView): void {
  const record = ensureRecord(container);
  record.source = 'client';
  record.client = {
    template: view.template,
    state: cloneInspectable(view.state),
    actionNames: Object.keys(view.actions ?? {}),
  };
  record.protocol = null;
  record.lastError = null;
  record.updatedAt = new Date().toISOString();
  notify(container);
}

export function recordProtocolMount(container: Element, view: ProtocolView): void {
  const record = ensureRecord(container);
  record.source = 'remote';
  record.protocol = {
    template: view.template,
    state: cloneInspectable(view.state),
    actions: cloneInspectable(view.actions ?? null),
    meta: cloneInspectable(view.meta ?? null),
  };
  record.lastError = null;
  record.updatedAt = new Date().toISOString();
  notify(container);
}

export function recordInspectionError(
  container: Element,
  error: Error,
  context: { method?: HTTPMethod; url?: string } = {},
): void {
  const record = ensureRecord(container);
  record.lastError = {
    message: error.message,
    issues: readIssues(error),
    context,
    at: new Date().toISOString(),
  };
  record.updatedAt = record.lastError.at;
  notify(container);
}

export function clearInspection(container: Element): void {
  records.delete(container);
  notify(container, null);
}

function ensureRecord(container: Element): InspectorRecord {
  const existing = records.get(container);
  if (existing) {
    return existing;
  }

  const created: InspectorRecord = {
    source: null,
    client: null,
    protocol: null,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
  records.set(container, created);
  return created;
}

function notify(container: Element, snapshot = inspectView(container)): void {
  const target = listeners.get(container);
  if (!target) return;
  for (const listener of target) {
    listener(snapshot);
  }
}

function readIssues(error: Error): string[] | undefined {
  const candidate = error as Error & { issues?: unknown };
  return Array.isArray(candidate.issues)
    ? candidate.issues.filter((issue): issue is string => typeof issue === 'string')
    : undefined;
}

function cloneInspectable<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((entry) => cloneInspectable(entry)) as T;
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = cloneInspectable(entry);
    }
    return out as T;
  }

  return value;
}
