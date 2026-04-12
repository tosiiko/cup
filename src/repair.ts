import type { ActionDescriptor, HTTPMethod, JSONValue, ProtocolPatch, ProtocolView, ViewMeta } from './protocol.js';
import type { ViewPolicy } from './policy.js';
import { validateViewPolicy } from './policy.js';
import { validateProtocolPatch, validateProtocolView } from './validate.js';

export interface RepairOptions {
  defaults?: {
    title?: string;
    route?: string;
  };
  policy?: ViewPolicy;
}

const VIEW_KEYS = new Set(['template', 'state', 'actions', 'meta']);
const PATCH_KEYS = new Set(['kind', 'mode', 'template', 'state', 'actions', 'meta']);
const ACTION_KEYS: Record<ActionDescriptor['type'], Set<string>> = {
  fetch: new Set(['type', 'url', 'method', 'payload']),
  emit: new Set(['type', 'event', 'detail']),
  navigate: new Set(['type', 'url', 'replace']),
};
const META_KEYS = new Set(['version', 'lang', 'generator', 'title', 'route']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

interface ViewCandidate {
  template: string;
  state: Record<string, JSONValue>;
  actions?: Record<string, ActionDescriptor>;
  meta?: ViewMeta;
}

interface PatchCandidate {
  kind: 'patch';
  mode?: 'merge' | 'replace';
  template?: string;
  state?: Record<string, JSONValue>;
  actions?: Record<string, ActionDescriptor>;
  meta?: ViewMeta;
}

export function repairProtocolViewCandidate(input: unknown, options: RepairOptions = {}): ProtocolView {
  const view = isPlainObject(input) ? sanitizeViewCandidate(input) : { template: '<p></p>', state: {} };
  view.meta = sanitizeMeta(view.meta, options.defaults);
  const repaired = validateProtocolView(view);
  return options.policy ? validateViewPolicy(repaired, options.policy) : repaired;
}

export function repairProtocolPatchCandidate(input: unknown, options: RepairOptions = {}): ProtocolPatch {
  const patch: PatchCandidate = isPlainObject(input) ? sanitizePatchCandidate(input) : { kind: 'patch' };
  patch.meta = sanitizeMeta(patch.meta, options.defaults);
  return validateProtocolPatch(patch);
}

function sanitizeViewCandidate(input: Record<string, unknown>): ViewCandidate {
  const view = pickAllowed(input, VIEW_KEYS);
  if (typeof view.template !== 'string') {
    view.template = '<p></p>';
  } else {
    view.template = sanitizeTemplate(view.template);
  }
  view.state = isPlainObject(view.state) ? sanitizeJSONObject(view.state) : {};
  if (view.actions !== undefined) {
    view.actions = isPlainObject(view.actions) ? sanitizeActions(view.actions) : undefined;
  }
  return view as unknown as ViewCandidate;
}

function sanitizePatchCandidate(input: Record<string, unknown>): PatchCandidate {
  const patch = pickAllowed(input, PATCH_KEYS);
  patch.kind = 'patch';
  if (patch.mode !== 'replace') {
    patch.mode = 'merge';
  }
  if (patch.template !== undefined) {
    patch.template = typeof patch.template === 'string' ? sanitizeTemplate(patch.template) : '<p></p>';
  }
  if (patch.state !== undefined) {
    patch.state = isPlainObject(patch.state) ? sanitizeJSONObject(patch.state) : {};
  }
  if (patch.actions !== undefined) {
    patch.actions = isPlainObject(patch.actions) ? sanitizeActions(patch.actions) : undefined;
  }
  return patch as unknown as PatchCandidate;
}

function sanitizeTemplate(template: string): string {
  return template
    .replace(/\|\s*safe\b/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z][a-z0-9_-]*\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\b(href|src)\s*=\s*(['"])\s*javascript:.*?\2/gi, '$1="#"');
}

function sanitizeJSONObject(input: Record<string, unknown>): Record<string, JSONValue> {
  const out: Record<string, JSONValue> = {};
  for (const [key, value] of Object.entries(input)) {
    const next = sanitizeJSONValue(value);
    if (next !== undefined) {
      out[key] = next;
    }
  }
  return out;
}

function sanitizeJSONValue(value: unknown): JSONValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeJSONValue(entry))
      .filter((entry): entry is JSONValue => entry !== undefined);
  }
  if (isPlainObject(value)) {
    return sanitizeJSONObject(value);
  }
  return undefined;
}

function sanitizeActions(input: Record<string, unknown>): Record<string, ActionDescriptor> {
  const out: Record<string, ActionDescriptor> = {};
  for (const [name, descriptor] of Object.entries(input)) {
    if (!isPlainObject(descriptor) || typeof descriptor.type !== 'string') continue;
    const kind = descriptor.type as ActionDescriptor['type'];
    const allowed = ACTION_KEYS[kind];
    if (!allowed) continue;
    const next = pickAllowed(descriptor, allowed) as Record<string, unknown>;
    if (kind === 'fetch') {
      if (typeof next.url !== 'string') continue;
      const method = typeof next.method === 'string' && METHODS.has(next.method)
        ? next.method as HTTPMethod
        : 'POST';
      const payload = isPlainObject(next.payload) ? sanitizeJSONObject(next.payload) : undefined;
      out[name] = {
        type: 'fetch',
        url: sanitizeActionURL(next.url),
        method,
        ...(payload ? { payload } : {}),
      };
      continue;
    }
    if (kind === 'emit') {
      if (typeof next.event !== 'string') continue;
      const detail = isPlainObject(next.detail) ? sanitizeJSONObject(next.detail) : undefined;
      out[name] = {
        type: 'emit',
        event: next.event,
        ...(detail ? { detail } : {}),
      };
      continue;
    }
    if (typeof next.url !== 'string') continue;
    out[name] = {
      type: 'navigate',
      url: sanitizeActionURL(next.url),
      ...(typeof next.replace === 'boolean' ? { replace: next.replace } : {}),
    };
  }
  return out;
}

function sanitizeMeta(input: unknown, defaults?: { title?: string; route?: string }): ViewMeta {
  const meta = isPlainObject(input) ? pickAllowed(input, META_KEYS) : {};
  return {
    version: '1',
    ...(typeof meta.lang === 'string' ? { lang: meta.lang } : {}),
    ...(typeof meta.generator === 'string' ? { generator: meta.generator } : {}),
    ...(typeof meta.title === 'string' ? { title: meta.title } : defaults?.title ? { title: defaults.title } : {}),
    ...(typeof meta.route === 'string' ? { route: meta.route } : defaults?.route ? { route: defaults.route } : {}),
  };
}

function pickAllowed(input: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (allowed.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function sanitizeActionURL(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return `${parsed.pathname || '/'}${parsed.search}${parsed.hash}` || '/';
    } catch {
      return '/';
    }
  }
  return url;
}
