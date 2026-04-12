import type {
  ActionDescriptor,
  EmitActionDescriptor,
  FetchActionDescriptor,
  JSONValue,
  NavigateActionDescriptor,
  ProtocolView,
  ViewMeta,
} from './protocol.js';

const ACTION_KEYS = new Set(['type', 'url', 'method', 'payload', 'event', 'detail', 'replace']);
const META_KEYS = new Set(['version', 'lang', 'generator', 'title', 'route']);
const VIEW_KEYS = new Set(['template', 'state', 'actions', 'meta']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export class ValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid CUP protocol view:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export function validateProtocolView(input: unknown): ProtocolView {
  const issues: string[] = [];
  validateView(input, 'view', issues);
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
  return input as ProtocolView;
}

function validateView(input: unknown, path: string, issues: string[]): void {
  if (!isPlainObject(input)) {
    issues.push(`${path} must be an object`);
    return;
  }

  validateNoExtraKeys(input, VIEW_KEYS, path, issues);

  if (typeof input.template !== 'string') {
    issues.push(`${path}.template must be a string`);
  }

  if (!isPlainObject(input.state)) {
    issues.push(`${path}.state must be an object`);
  } else {
    validateJSONObject(input.state, `${path}.state`, issues);
  }

  if (input.actions !== undefined) {
    if (!isPlainObject(input.actions)) {
      issues.push(`${path}.actions must be an object`);
    } else {
      for (const [actionName, descriptor] of Object.entries(input.actions)) {
        validateActionDescriptor(descriptor, `${path}.actions.${actionName}`, issues);
      }
    }
  }

  if (input.meta !== undefined) {
    validateMeta(input.meta, `${path}.meta`, issues);
  }
}

function validateActionDescriptor(input: unknown, path: string, issues: string[]): void {
  if (!isPlainObject(input)) {
    issues.push(`${path} must be an object`);
    return;
  }

  validateNoExtraKeys(input, ACTION_KEYS, path, issues);

  switch (input.type) {
    case 'fetch':
      validateFetchAction(input as Partial<FetchActionDescriptor>, path, issues);
      return;
    case 'emit':
      validateEmitAction(input as Partial<EmitActionDescriptor>, path, issues);
      return;
    case 'navigate':
      validateNavigateAction(input as Partial<NavigateActionDescriptor>, path, issues);
      return;
    default:
      issues.push(`${path}.type must be one of fetch, emit, navigate`);
  }
}

function validateFetchAction(input: Partial<FetchActionDescriptor>, path: string, issues: string[]): void {
  if (typeof input.url !== 'string') {
    issues.push(`${path}.url must be a string`);
  }
  if (input.method !== undefined && !METHODS.has(input.method)) {
    issues.push(`${path}.method must be one of GET, POST, PUT, PATCH, DELETE`);
  }
  if (input.payload !== undefined) {
    if (!isPlainObject(input.payload)) {
      issues.push(`${path}.payload must be an object`);
    } else {
      validateJSONObject(input.payload, `${path}.payload`, issues);
    }
  }
}

function validateEmitAction(input: Partial<EmitActionDescriptor>, path: string, issues: string[]): void {
  if (typeof input.event !== 'string') {
    issues.push(`${path}.event must be a string`);
  }
  if (input.detail !== undefined) {
    if (!isPlainObject(input.detail)) {
      issues.push(`${path}.detail must be an object`);
    } else {
      validateJSONObject(input.detail, `${path}.detail`, issues);
    }
  }
}

function validateNavigateAction(input: Partial<NavigateActionDescriptor>, path: string, issues: string[]): void {
  if (typeof input.url !== 'string') {
    issues.push(`${path}.url must be a string`);
  }
  if (input.replace !== undefined && typeof input.replace !== 'boolean') {
    issues.push(`${path}.replace must be a boolean`);
  }
}

function validateMeta(input: unknown, path: string, issues: string[]): void {
  if (!isPlainObject(input)) {
    issues.push(`${path} must be an object`);
    return;
  }

  validateNoExtraKeys(input, META_KEYS, path, issues);

  const meta = input as ViewMeta;
  if (meta.version !== undefined && meta.version !== '1') {
    issues.push(`${path}.version must be "1"`);
  }
  for (const key of ['lang', 'generator', 'title', 'route'] as const) {
    const value = meta[key];
    if (value !== undefined && typeof value !== 'string') {
      issues.push(`${path}.${key} must be a string`);
    }
  }
}

function validateJSONObject(input: Record<string, unknown>, path: string, issues: string[]): void {
  for (const [key, value] of Object.entries(input)) {
    validateJSONValue(value, `${path}.${key}`, issues);
  }
}

function validateJSONValue(input: unknown, path: string, issues: string[]): void {
  if (
    input === null ||
    typeof input === 'string' ||
    typeof input === 'number' ||
    typeof input === 'boolean'
  ) {
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((value, index) => validateJSONValue(value, `${path}[${index}]`, issues));
    return;
  }

  if (isPlainObject(input)) {
    for (const [key, value] of Object.entries(input)) {
      validateJSONValue(value, `${path}.${key}`, issues);
    }
    return;
  }

  issues.push(`${path} must be JSON-serializable`);
}

function validateNoExtraKeys(
  input: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
  issues: string[],
): void {
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      issues.push(`${path} contains unsupported property "${key}"`);
    }
  }
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

export type { ActionDescriptor, JSONValue, ProtocolView };
