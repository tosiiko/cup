import type {
  ActionDescriptor,
  EmitActionDescriptor,
  FetchActionDescriptor,
  JSONValue,
  NavigateActionDescriptor,
  PatchMode,
  ProtocolPatch,
  ProtocolView,
  ViewProvenance,
  ViewMeta,
} from './protocol.js';
import {
  listNegotiationIssues,
  negotiateCapabilities,
  type CapabilitySupport,
  type NegotiationResult,
} from './negotiation.js';
import {
  emitRuntimeTrace,
  type TraceListener,
  type ValidationTraceContext,
} from './tracing.js';

const FETCH_ACTION_KEYS = new Set(['type', 'url', 'method', 'payload']);
const EMIT_ACTION_KEYS = new Set(['type', 'event', 'detail']);
const NAVIGATE_ACTION_KEYS = new Set(['type', 'url', 'replace']);
const META_KEYS = new Set(['version', 'lang', 'generator', 'title', 'route', 'provenance', 'extensions']);
const VIEW_KEYS = new Set(['template', 'state', 'actions', 'meta']);
const PATCH_KEYS = new Set(['kind', 'mode', 'template', 'state', 'actions', 'meta']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const PATCH_MODES = new Set(['merge', 'replace']);
const PROVENANCE_KEYS = new Set(['source', 'generatedBy', 'generatedAt', 'requestId', 'validation', 'policyDecisions']);
const VALIDATION_PROVENANCE_KEYS = new Set(['schema', 'policy', 'validator', 'checkedAt']);
const POLICY_DECISION_KEYS = new Set(['policy', 'outcome', 'detail']);
const EXTENSION_KEYS = new Set(['version', 'required', 'config']);
const PROVENANCE_SOURCES = new Set(['human', 'ai', 'adapter', 'hybrid']);
const VALIDATION_SCHEMA_STATES = new Set(['valid', 'repaired', 'unchecked']);
const VALIDATION_POLICY_STATES = new Set(['passed', 'failed', 'skipped']);
const POLICY_OUTCOMES = new Set(['allow', 'deny', 'skip']);

export class ValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid CUP protocol view:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export interface ValidationOptions {
  capabilities?: CapabilitySupport;
  container?: Element;
  onTrace?: TraceListener;
  context?: ValidationTraceContext;
}

export function validateProtocolView(input: unknown, options: ValidationOptions = {}): ProtocolView {
  const startedAt = now();
  const issues: string[] = [];
  validateView(input, 'view', issues);
  const negotiation = issues.length === 0 && options.capabilities
    ? negotiateCapabilities(input as ProtocolView, options.capabilities)
    : undefined;
  if (negotiation) {
    issues.push(...listNegotiationIssues(negotiation));
  }
  if (issues.length > 0) {
    emitValidationTrace('view', startedAt, issues, input, negotiation, options);
    throw new ValidationError(issues);
  }
  emitValidationTrace('view', startedAt, [], input, negotiation, options);
  return input as ProtocolView;
}

export function validateProtocolPatch(input: unknown, options: ValidationOptions = {}): ProtocolPatch {
  const startedAt = now();
  const issues: string[] = [];
  validatePatch(input, 'patch', issues);
  const negotiation = issues.length === 0 && options.capabilities
    ? negotiateCapabilities(input as ProtocolPatch, options.capabilities)
    : undefined;
  if (negotiation) {
    issues.push(...listNegotiationIssues(negotiation));
  }
  if (issues.length > 0) {
    emitValidationTrace('patch', startedAt, issues, input, negotiation, options);
    throw new ValidationError(issues);
  }
  emitValidationTrace('patch', startedAt, [], input, negotiation, options);
  return input as ProtocolPatch;
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

function validatePatch(input: unknown, path: string, issues: string[]): void {
  if (!isPlainObject(input)) {
    issues.push(`${path} must be an object`);
    return;
  }

  validateNoExtraKeys(input, PATCH_KEYS, path, issues);

  if (input.kind !== 'patch') {
    issues.push(`${path}.kind must be "patch"`);
  }

  if (input.mode !== undefined) {
    if (typeof input.mode !== 'string' || !PATCH_MODES.has(input.mode as PatchMode)) {
      issues.push(`${path}.mode must be one of merge, replace`);
    }
  }

  if (input.template !== undefined && typeof input.template !== 'string') {
    issues.push(`${path}.template must be a string`);
  }

  if (input.state !== undefined) {
    if (!isPlainObject(input.state)) {
      issues.push(`${path}.state must be an object`);
    } else {
      validateJSONObject(input.state, `${path}.state`, issues);
    }
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

  if (
    input.template === undefined &&
    input.state === undefined &&
    input.actions === undefined &&
    input.meta === undefined
  ) {
    issues.push(`${path} must include at least one patch field`);
  }
}

function validateActionDescriptor(input: unknown, path: string, issues: string[]): void {
  if (!isPlainObject(input)) {
    issues.push(`${path} must be an object`);
    return;
  }

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
  validateNoExtraKeys(input as Record<string, unknown>, FETCH_ACTION_KEYS, path, issues);
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
  validateNoExtraKeys(input as Record<string, unknown>, EMIT_ACTION_KEYS, path, issues);
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
  validateNoExtraKeys(input as Record<string, unknown>, NAVIGATE_ACTION_KEYS, path, issues);
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

  if (meta.provenance !== undefined) {
    validateProvenance(meta.provenance, `${path}.provenance`, issues);
  }

  if (meta.extensions !== undefined) {
    if (!isPlainObject(meta.extensions)) {
      issues.push(`${path}.extensions must be an object`);
    } else {
      for (const [name, descriptor] of Object.entries(meta.extensions)) {
        validateExtensionDescriptor(descriptor, `${path}.extensions.${name}`, issues);
      }
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

function validateProvenance(input: unknown, path: string, issues: string[]): void {
  if (!isPlainObject(input)) {
    issues.push(`${path} must be an object`);
    return;
  }

  validateNoExtraKeys(input, PROVENANCE_KEYS, path, issues);

  const provenance = input as ViewProvenance;
  if (provenance.source !== undefined && !PROVENANCE_SOURCES.has(provenance.source)) {
    issues.push(`${path}.source must be one of human, ai, adapter, hybrid`);
  }
  for (const key of ['generatedBy', 'generatedAt', 'requestId'] as const) {
    const value = provenance[key];
    if (value !== undefined && typeof value !== 'string') {
      issues.push(`${path}.${key} must be a string`);
    }
  }
  if (provenance.validation !== undefined) {
    validateValidationProvenance(provenance.validation, `${path}.validation`, issues);
  }
  if (provenance.policyDecisions !== undefined) {
    if (!Array.isArray(provenance.policyDecisions)) {
      issues.push(`${path}.policyDecisions must be an array`);
    } else {
      provenance.policyDecisions.forEach((decision, index) => {
        validatePolicyDecision(decision, `${path}.policyDecisions[${index}]`, issues);
      });
    }
  }
}

function validateValidationProvenance(input: unknown, path: string, issues: string[]): void {
  if (!isPlainObject(input)) {
    issues.push(`${path} must be an object`);
    return;
  }

  validateNoExtraKeys(input, VALIDATION_PROVENANCE_KEYS, path, issues);

  const validation = input as Record<string, unknown>;
  if (typeof validation.schema !== 'string' || !VALIDATION_SCHEMA_STATES.has(validation.schema)) {
    issues.push(`${path}.schema must be one of valid, repaired, unchecked`);
  }
  if (validation.policy !== undefined && (typeof validation.policy !== 'string' || !VALIDATION_POLICY_STATES.has(validation.policy))) {
    issues.push(`${path}.policy must be one of passed, failed, skipped`);
  }
  for (const key of ['validator', 'checkedAt'] as const) {
    const value = validation[key];
    if (value !== undefined && typeof value !== 'string') {
      issues.push(`${path}.${key} must be a string`);
    }
  }
}

function validatePolicyDecision(input: unknown, path: string, issues: string[]): void {
  if (!isPlainObject(input)) {
    issues.push(`${path} must be an object`);
    return;
  }

  validateNoExtraKeys(input, POLICY_DECISION_KEYS, path, issues);

  const decision = input as Record<string, unknown>;
  if (typeof decision.policy !== 'string') {
    issues.push(`${path}.policy must be a string`);
  }
  if (typeof decision.outcome !== 'string' || !POLICY_OUTCOMES.has(decision.outcome)) {
    issues.push(`${path}.outcome must be one of allow, deny, skip`);
  }
  if (decision.detail !== undefined && typeof decision.detail !== 'string') {
    issues.push(`${path}.detail must be a string`);
  }
}

function validateExtensionDescriptor(input: unknown, path: string, issues: string[]): void {
  if (!isPlainObject(input)) {
    issues.push(`${path} must be an object`);
    return;
  }

  validateNoExtraKeys(input, EXTENSION_KEYS, path, issues);

  const descriptor = input as Record<string, unknown>;
  if (typeof descriptor.version !== 'string') {
    issues.push(`${path}.version must be a string`);
  }
  if (descriptor.required !== undefined && typeof descriptor.required !== 'boolean') {
    issues.push(`${path}.required must be a boolean`);
  }
  if (descriptor.config !== undefined) {
    if (!isPlainObject(descriptor.config)) {
      issues.push(`${path}.config must be an object`);
    } else {
      validateJSONObject(descriptor.config, `${path}.config`, issues);
    }
  }
}

function emitValidationTrace(
  target: 'view' | 'patch',
  startedAt: number,
  issues: string[],
  input: unknown,
  negotiation: NegotiationResult | undefined,
  options: ValidationOptions,
): void {
  emitRuntimeTrace({
    kind: 'validation',
    at: new Date().toISOString(),
    target,
    status: issues.length === 0 ? 'passed' : 'failed',
    durationMs: now() - startedAt,
    issues: [...issues],
    protocolVersion: readProtocolVersion(input),
    requiredExtensions: negotiation
      ? Object.entries(negotiation.requiredExtensions).map(([name, version]) => `${name}@${version}`)
      : [],
    negotiatedExtensions: negotiation?.acceptedExtensions ?? {},
    missingRequiredExtensions: negotiation?.missingRequiredExtensions ?? [],
    ...(options.context ? { context: options.context } : {}),
  }, {
    container: options.container,
    listener: options.onTrace,
  });
}

function readProtocolVersion(input: unknown): string | undefined {
  if (!isPlainObject(input)) return undefined;

  if (isPlainObject(input.meta) && typeof input.meta.version === 'string') {
    return input.meta.version;
  }

  if (typeof input.version === 'string') {
    return input.version;
  }

  return undefined;
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export type { ActionDescriptor, JSONValue, PatchMode, ProtocolPatch, ProtocolView };
