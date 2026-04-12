import type { ProtocolPatch, ProtocolView } from './protocol.js';

export function applyProtocolPatch(baseView: ProtocolView, patch: ProtocolPatch): ProtocolView {
  const nextState = patch.mode === 'replace'
    ? (patch.state ?? baseView.state)
    : { ...baseView.state, ...(patch.state ?? {}) };

  return {
    template: patch.template ?? baseView.template,
    state: nextState,
    actions: patch.actions ?? baseView.actions,
    meta: patch.meta ? { ...(baseView.meta ?? {}), ...patch.meta } : baseView.meta,
  };
}

export function isProtocolPatch(input: unknown): input is ProtocolPatch {
  return typeof input === 'object' && input !== null && (input as { kind?: unknown }).kind === 'patch';
}
