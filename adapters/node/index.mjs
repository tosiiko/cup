import {
  STARTER_VIEW_POLICY,
  validateProtocolView,
  validateViewPolicy,
} from '../../dist/index.js';

export * from '../../dist/index.js';

export const ADAPTER_NAME = 'node-cup';
export const ADAPTER_GENERATOR = 'node-cup/0.2.4';
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

export function defineNodeView(view, options = {}) {
  const normalized = validateProtocolView(withNodeMeta(view, options.meta));
  if (!options.policy) {
    return normalized;
  }
  return validateViewPolicy(
    normalized,
    options.policy === true ? STARTER_VIEW_POLICY : options.policy,
  );
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
