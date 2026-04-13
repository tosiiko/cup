import type { ProtocolPatch, ProtocolView, ViewMeta } from './protocol.js';

export const CUP_PROVENANCE_EXTENSION = 'cup.provenance';
export const CUP_CAPABILITY_NEGOTIATION_EXTENSION = 'cup.capability-negotiation';

export interface CapabilitySupport {
  protocolVersions?: readonly string[];
  extensions?: Record<string, readonly string[]>;
}

export interface NegotiationResult {
  protocolVersion: string;
  supportedVersion: boolean;
  acceptedExtensions: Record<string, string>;
  requiredExtensions: Record<string, string>;
  optionalExtensions: Record<string, string>;
  missingRequiredExtensions: string[];
  unsupportedOptionalExtensions: string[];
}

export const DEFAULT_RUNTIME_CAPABILITIES: Readonly<Required<CapabilitySupport>> = Object.freeze({
  protocolVersions: Object.freeze(['1']),
  extensions: Object.freeze({
    [CUP_PROVENANCE_EXTENSION]: Object.freeze(['1']),
    [CUP_CAPABILITY_NEGOTIATION_EXTENSION]: Object.freeze(['1']),
  }),
});

type NegotiableInput = Pick<ViewMeta, 'version' | 'extensions'> | ProtocolView | ProtocolPatch;

export function negotiateCapabilities(
  input: NegotiableInput,
  capabilities: CapabilitySupport = DEFAULT_RUNTIME_CAPABILITIES,
): NegotiationResult {
  const meta = readMeta(input);
  const protocolVersion = meta.version ?? '1';
  const supportedProtocols = normalizeVersionList(capabilities.protocolVersions, ['1']);
  const acceptedExtensions: Record<string, string> = {};
  const requiredExtensions: Record<string, string> = {};
  const optionalExtensions: Record<string, string> = {};
  const missingRequiredExtensions: string[] = [];
  const unsupportedOptionalExtensions: string[] = [];

  for (const [name, descriptor] of Object.entries(meta.extensions ?? {})) {
    const supportedVersions = normalizeVersionList(capabilities.extensions?.[name], []);
    if (descriptor.required) {
      requiredExtensions[name] = descriptor.version;
    } else {
      optionalExtensions[name] = descriptor.version;
    }

    if (supportedVersions.includes(descriptor.version)) {
      acceptedExtensions[name] = descriptor.version;
      continue;
    }

    const token = `${name}@${descriptor.version}`;
    if (descriptor.required) {
      missingRequiredExtensions.push(token);
    } else {
      unsupportedOptionalExtensions.push(token);
    }
  }

  return {
    protocolVersion,
    supportedVersion: supportedProtocols.includes(protocolVersion),
    acceptedExtensions,
    requiredExtensions,
    optionalExtensions,
    missingRequiredExtensions,
    unsupportedOptionalExtensions,
  };
}

export function listNegotiationIssues(result: NegotiationResult): string[] {
  const issues: string[] = [];
  if (!result.supportedVersion) {
    issues.push(`view.meta.version "${result.protocolVersion}" is not supported by this runtime`);
  }

  for (const extension of result.missingRequiredExtensions) {
    issues.push(`view.meta.extensions requires unsupported extension "${extension}"`);
  }

  return issues;
}

export function createCapabilityHeaders(
  capabilities: CapabilitySupport = DEFAULT_RUNTIME_CAPABILITIES,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-CUP-Protocol-Versions': normalizeVersionList(capabilities.protocolVersions, ['1']).join(', '),
  };

  const extensions = serializeExtensions(capabilities.extensions);
  if (extensions) {
    headers['X-CUP-Extensions'] = extensions;
  }

  return headers;
}

export function parseCapabilityHeaders(headers: Headers | Record<string, string>): CapabilitySupport {
  const protocolVersions = readHeader(headers, 'x-cup-protocol-versions')
    ?? readHeader(headers, 'x-cup-protocol-version');
  const extensions = readHeader(headers, 'x-cup-extensions')
    ?? readHeader(headers, 'x-cup-negotiated-extensions');

  return {
    ...(protocolVersions ? { protocolVersions: splitHeaderValues(protocolVersions) } : {}),
    ...(extensions ? { extensions: parseExtensions(extensions) } : {}),
  };
}

function readMeta(input: NegotiableInput): Pick<ViewMeta, 'version' | 'extensions'> {
  if ('meta' in input && typeof input.meta === 'object' && input.meta !== null) {
    return input.meta;
  }

  return input as Pick<ViewMeta, 'version' | 'extensions'>;
}

function normalizeVersionList(input: readonly string[] | undefined, fallback: string[]): string[] {
  const source = input ?? fallback;
  return Array.from(new Set(source.filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

function serializeExtensions(input?: Record<string, readonly string[]>): string {
  if (!input) return '';

  const tokens: string[] = [];
  for (const [name, versions] of Object.entries(input)) {
    for (const version of normalizeVersionList(versions, [])) {
      tokens.push(`${name}@${version}`);
    }
  }

  return tokens.join(', ');
}

function parseExtensions(header: string): Record<string, string[]> {
  const extensions: Record<string, string[]> = {};

  for (const token of splitHeaderValues(header)) {
    const at = token.lastIndexOf('@');
    if (at <= 0 || at === token.length - 1) {
      continue;
    }

    const name = token.slice(0, at).trim();
    const version = token.slice(at + 1).trim();
    if (!name || !version) continue;

    extensions[name] = [...(extensions[name] ?? []), version];
  }

  return extensions;
}

function splitHeaderValues(header: string): string[] {
  return header
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function readHeader(headers: Headers | Record<string, string>, key: string): string | undefined {
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get(key) ?? undefined;
  }

  const found = Object.entries(headers).find(([candidate]) => candidate.toLowerCase() === key);
  return found?.[1];
}
