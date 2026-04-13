import type { ProtocolPatch, ProtocolView, ViewMeta, ViewProvenance } from './protocol.js';

export function applyProtocolPatch(baseView: ProtocolView, patch: ProtocolPatch): ProtocolView {
  const nextState = patch.mode === 'replace'
    ? (patch.state ?? baseView.state)
    : { ...baseView.state, ...(patch.state ?? {}) };

  return {
    template: patch.template ?? baseView.template,
    state: nextState,
    actions: patch.actions ?? baseView.actions,
    meta: mergeViewMeta(baseView.meta, patch.meta),
  };
}

export function isProtocolPatch(input: unknown): input is ProtocolPatch {
  return typeof input === 'object' && input !== null && (input as { kind?: unknown }).kind === 'patch';
}

function mergeViewMeta(base?: ViewMeta, patch?: ViewMeta): ViewMeta | undefined {
  if (!base) return patch;
  if (!patch) return base;

  return {
    ...base,
    ...patch,
    provenance: mergeProvenance(base.provenance, patch.provenance),
    extensions: patch.extensions
      ? { ...(base.extensions ?? {}), ...patch.extensions }
      : base.extensions,
  };
}

function mergeProvenance(base?: ViewProvenance, patch?: ViewProvenance): ViewProvenance | undefined {
  if (!base) return patch;
  if (!patch) return base;

  return {
    ...base,
    ...patch,
    validation: patch.validation
      ? { ...(base.validation ?? {}), ...patch.validation }
      : base.validation,
    policyDecisions: patch.policyDecisions
      ? [...(base.policyDecisions ?? []), ...patch.policyDecisions]
      : base.policyDecisions,
  };
}
