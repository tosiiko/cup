import {
  CUP_PROVENANCE_EXTENSION,
  STARTER_VIEW_POLICY,
  validateProtocolView,
  validateViewPolicy,
} from '../../dist/index.js';

export * from '../../dist/index.js';

export const ADAPTER_NAME = 'node-cup';
export const ADAPTER_GENERATOR = 'node-cup/0.3.0';
export const ADAPTER_LANG = 'node';

export function nodeFetch(url, options = {}) {
  const action = {
    type: 'fetch',
    url,
  };

  if (options.method) {
    action.method = options.method;
  }
  if (options.payload && typeof options.payload === 'object' && !Array.isArray(options.payload)) {
    action.payload = options.payload;
  }

  return action;
}

export function nodeEmit(event, detail = undefined) {
  return {
    type: 'emit',
    event,
    ...(detail ? { detail } : {}),
  };
}

export function nodeNavigate(url, options = {}) {
  return {
    type: 'navigate',
    url,
    ...(typeof options.replace === 'boolean' ? { replace: options.replace } : {}),
  };
}

export function withNodeMeta(view, meta = {}) {
  const existingMeta = view.meta ?? {};
  const existingProvenance = existingMeta.provenance ?? {};
  return {
    ...view,
    meta: {
      version: '1',
      lang: ADAPTER_LANG,
      generator: ADAPTER_GENERATOR,
      ...existingMeta,
      ...meta,
      provenance: {
        source: 'adapter',
        generatedBy: ADAPTER_GENERATOR,
        generatedAt: existingProvenance.generatedAt ?? new Date().toISOString(),
        ...existingProvenance,
        ...(meta.provenance ?? {}),
        validation: {
          schema: 'valid',
          policy: 'skipped',
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
    },
  };
}

export function defineNodeView(view, options = {}) {
  const normalized = validateProtocolView(withNodeMeta(view, options.meta));
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

export function toNodeResponse(view, options = {}) {
  const normalized = defineNodeView(view, {
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
