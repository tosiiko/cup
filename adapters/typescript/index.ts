import {
  STARTER_VIEW_POLICY,
  validateProtocolView,
  validateViewPolicy,
} from '../../dist/index.js';
import type {
  EmitActionDescriptor,
  FetchActionDescriptor,
  JSONValue,
  NavigateActionDescriptor,
  ProtocolView,
  ViewPolicy,
} from '../../dist/index.js';

export * from '../../dist/index.js';

export const ADAPTER_NAME = 'ts-cup';
export const ADAPTER_GENERATOR = 'ts-cup/0.1.6';
export const ADAPTER_LANG = 'ts';

export interface TypeScriptAdapterOptions {
  meta?: Partial<ProtocolView['meta']>;
  policy?: boolean | ViewPolicy;
}

export interface TypeScriptResponseOptions extends TypeScriptAdapterOptions {
  status?: number;
  headers?: Record<string, string>;
}

export function tsFetch(
  url: string,
  options: { method?: FetchActionDescriptor['method']; payload?: Record<string, JSONValue> } = {},
): FetchActionDescriptor {
  return {
    type: 'fetch',
    url,
    ...(options.method ? { method: options.method } : {}),
    ...(options.payload ? { payload: options.payload } : {}),
  };
}

export function tsEmit(
  event: string,
  detail?: Record<string, JSONValue>,
): EmitActionDescriptor {
  return {
    type: 'emit',
    event,
    ...(detail ? { detail } : {}),
  };
}

export function tsNavigate(
  url: string,
  options: { replace?: boolean } = {},
): NavigateActionDescriptor {
  return {
    type: 'navigate',
    url,
    ...(typeof options.replace === 'boolean' ? { replace: options.replace } : {}),
  };
}

export function withTypeScriptMeta(
  view: ProtocolView,
  meta: Partial<ProtocolView['meta']> = {},
): ProtocolView {
  return {
    ...view,
    meta: {
      version: '1',
      lang: ADAPTER_LANG,
      generator: ADAPTER_GENERATOR,
      ...(view.meta ?? {}),
      ...meta,
    },
  };
}

export function defineTypeScriptView(
  view: ProtocolView,
  options: TypeScriptAdapterOptions = {},
): ProtocolView {
  const normalized = validateProtocolView(withTypeScriptMeta(view, options.meta));
  if (!options.policy) {
    return normalized;
  }
  return validateViewPolicy(
    normalized,
    options.policy === true ? STARTER_VIEW_POLICY : options.policy,
  );
}

export function toTypeScriptResponse(
  view: ProtocolView,
  options: TypeScriptResponseOptions = {},
): {
  status: number;
  headers: Record<string, string>;
  body: string;
  view: ProtocolView;
} {
  const normalized = defineTypeScriptView(view, {
    meta: options.meta,
    policy: options.policy,
  });

  return {
    status: options.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(normalized),
    view: normalized,
  };
}
