import type { ActionDescriptor, ProtocolView } from './protocol.js';
import { validateProtocolView } from './validate.js';

export type ActionURLPolicy = 'relative-only' | 'any';

export interface ViewPolicy {
  requireVersion?: boolean;
  requireTitle?: boolean;
  requireRoute?: boolean;
  allowSafeFilter?: boolean;
  allowInlineHandlers?: boolean;
  allowJavaScriptURLs?: boolean;
  allowScriptTags?: boolean;
  actionURLs?: ActionURLPolicy;
}

export const STARTER_VIEW_POLICY: Readonly<ViewPolicy> = Object.freeze({
  requireVersion: true,
  requireTitle: true,
  requireRoute: true,
  allowSafeFilter: false,
  allowInlineHandlers: false,
  allowJavaScriptURLs: false,
  allowScriptTags: false,
  actionURLs: 'relative-only',
});

export class PolicyError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`CUP view policy rejected:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'PolicyError';
    this.issues = issues;
  }
}

const DEFAULT_POLICY: Readonly<ViewPolicy> = Object.freeze({
  requireVersion: false,
  requireTitle: false,
  requireRoute: false,
  allowSafeFilter: true,
  allowInlineHandlers: true,
  allowJavaScriptURLs: true,
  allowScriptTags: true,
  actionURLs: 'any',
});

const SCRIPT_TAG_PATTERN = /<script\b/i;
const INLINE_HANDLER_PATTERN = /\son[a-z][a-z0-9_-]*\s*=/i;
const JAVASCRIPT_URL_PATTERN = /\b(?:href|src)\s*=\s*(['"])\s*javascript:/i;
const SAFE_FILTER_PATTERN = /\|\s*safe\b/;
const RELATIVE_URL_PATTERN = /^(\/(?!\/)|\.{1,2}\/|[?#])/;

export function validateViewPolicy(input: unknown, policy: ViewPolicy = DEFAULT_POLICY): ProtocolView {
  const view = validateProtocolView(input);
  const issues: string[] = [];
  const effective = { ...DEFAULT_POLICY, ...policy };

  if (effective.requireVersion && view.meta?.version !== '1') {
    issues.push('view.meta.version is required by policy');
  }
  if (effective.requireTitle && !view.meta?.title) {
    issues.push('view.meta.title is required by policy');
  }
  if (effective.requireRoute && !view.meta?.route) {
    issues.push('view.meta.route is required by policy');
  }
  if (!effective.allowSafeFilter && SAFE_FILTER_PATTERN.test(view.template)) {
    issues.push('view.template uses the |safe filter, which is disabled by policy');
  }
  if (!effective.allowScriptTags && SCRIPT_TAG_PATTERN.test(view.template)) {
    issues.push('view.template contains a <script> tag, which is disabled by policy');
  }
  if (!effective.allowInlineHandlers && INLINE_HANDLER_PATTERN.test(view.template)) {
    issues.push('view.template contains inline event handler attributes, which are disabled by policy');
  }
  if (!effective.allowJavaScriptURLs && JAVASCRIPT_URL_PATTERN.test(view.template)) {
    issues.push('view.template contains a javascript: URL, which is disabled by policy');
  }

  if (effective.actionURLs === 'relative-only' && view.actions) {
    for (const [name, descriptor] of Object.entries(view.actions)) {
      validateActionURL(descriptor, `view.actions.${name}`, issues);
    }
  }

  if (issues.length > 0) {
    throw new PolicyError(issues);
  }

  return view;
}

function validateActionURL(descriptor: ActionDescriptor, path: string, issues: string[]): void {
  if (descriptor.type !== 'fetch' && descriptor.type !== 'navigate') {
    return;
  }

  if (!RELATIVE_URL_PATTERN.test(descriptor.url)) {
    issues.push(`${path}.url must stay relative under the current policy`);
  }
}
