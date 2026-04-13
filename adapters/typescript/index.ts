import {
  CUP_PROVENANCE_EXTENSION,
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
export type { FetchViewOptions, FetchViewStreamOptions, RemoteMount, RemoteStream } from './remote';
export { fetchView, fetchViewStream } from './remote';

export const ADAPTER_NAME = 'ts-cup';
export const ADAPTER_GENERATOR = 'ts-cup/0.3.0';
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
  const existingMeta = view.meta ?? {};
  const existingProvenance = existingMeta.provenance ?? {};
  const mergedMeta = {
    version: '1' as const,
    lang: ADAPTER_LANG,
    generator: ADAPTER_GENERATOR,
    ...existingMeta,
    ...meta,
    provenance: {
      source: 'adapter' as const,
      generatedBy: ADAPTER_GENERATOR,
      generatedAt: existingProvenance.generatedAt ?? new Date().toISOString(),
      ...existingProvenance,
      ...(meta.provenance ?? {}),
      validation: {
        schema: 'valid' as const,
        policy: 'skipped' as const,
        validator: ADAPTER_GENERATOR,
        checkedAt: new Date().toISOString(),
        ...(existingProvenance.validation ?? {}),
        ...(meta.provenance?.validation ?? {}),
      },
    },
    extensions: {
      [CUP_PROVENANCE_EXTENSION]: { version: '1' },
      ...(existingMeta.extensions ?? {}),
      ...(meta.extensions ?? {}),
    },
  };

  return {
    ...view,
    meta: mergedMeta,
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
  const withPolicy = validateViewPolicy(
    normalized,
    options.policy === true ? STARTER_VIEW_POLICY : options.policy,
  );
  return {
    ...withPolicy,
    meta: {
      ...(withPolicy.meta ?? {}),
      provenance: {
        ...(withPolicy.meta?.provenance ?? {}),
        validation: {
          ...(withPolicy.meta?.provenance?.validation ?? {}),
          schema: 'valid',
          policy: 'passed',
          validator: ADAPTER_GENERATOR,
          checkedAt: new Date().toISOString(),
        },
        policyDecisions: [
          ...(withPolicy.meta?.provenance?.policyDecisions ?? []),
          {
            policy: options.policy === true ? 'starter-view-policy' : 'custom-view-policy',
            outcome: 'allow',
          },
        ],
      },
      extensions: {
        [CUP_PROVENANCE_EXTENSION]: { version: '1' },
        ...(withPolicy.meta?.extensions ?? {}),
      },
    },
  };
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
