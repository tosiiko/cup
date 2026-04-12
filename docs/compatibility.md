# CUP Compatibility And Deprecation Policy

This document defines the stability rules for CUP from `0.1.6` onward.

## Stability Scope

CUP has three different compatibility surfaces:

- wire protocol compatibility:
  `ProtocolView`, `ProtocolPatch`, `schema/uiview.v1.json`, and `meta.version`
- package API compatibility:
  exported helpers in `@tosiiko/cup`
- adapter compatibility:
  language adapters that emit or validate CUP protocol payloads

These surfaces evolve at different speeds and should not be conflated.

## Strict Backward Compatibility

The baseline rule is simple:

- a valid `v1` CUP view should remain a valid `v1` CUP view across patch releases
- a patch release must not silently reinterpret existing `v1` payloads
- transport, adapter, and runtime improvements should be additive by default

In practice, that means:

- `meta.version = "1"` remains the stable wire contract for the current generation of CUP
- existing action kinds stay stable:
  `fetch`, `emit`, `navigate`
- policy hardening may reject unsafe output, but it must not silently change the meaning of previously valid safe output
- documented public exports should not disappear in a patch release

## Package Versioning Rules

CUP follows stricter rules than default pre-`1.0` semver expectations.

- patch releases:
  bug fixes, additive helpers, docs, tests, scaffolds, and hardening that does not break documented safe usage
- minor releases:
  larger additive surfaces, new adapter layers, or new optional protocol capabilities
- breaking wire changes:
  require a new protocol version, not a silent `v1` mutation

If a change would break documented usage, it must not ship as a silent patch-level surprise.

## Version Negotiation Strategy

Current CUP negotiation is intentionally simple:

- clients validate `meta.version`
- official adapters emit `v1`
- the runtime treats `v1` as the only accepted stable protocol version today

That is the current strategy:

- static `v1` by default
- no silent downgrade or upgrade logic
- no implicit cross-version coercion

If CUP introduces `v2`, these rules apply:

1. `v1` remains explicitly supported until a documented retirement window ends.
2. Servers must emit the version they actually serve in `meta.version`.
3. Clients must opt into a newer protocol version explicitly through transport-level negotiation, adapter configuration, or both.
4. A future negotiation header or accept-parameter strategy must be documented before `v2` becomes official.
5. `v1` and `v2` must never be silently conflated.

## Deprecation Policy

Deprecations must be explicit and documented.

Every deprecation requires:

- a changelog entry
- a compatibility note or migration note
- updated tests
- updated examples, starters, or adapter docs when relevant

Normal deprecation flow:

1. mark the API, behavior, or pattern as deprecated in docs and release notes
2. provide the supported replacement
3. keep the deprecated path available for at least one subsequent published release unless there is a security exception
4. remove it only with migration guidance

Security exception:

- if a behavior is unsafe, CUP may tighten or disable it faster, but the release notes must explain why

## Adapter Obligations

Official adapters should:

- declare which protocol versions they support
- keep emitted `meta.version` aligned with the supported wire contract
- avoid claiming publication or production status that the registry does not support
- update their generator/version metadata when the repo release version changes

The adapter registry in [`../adapters/namespaces.json`](../adapters/namespaces.json) is the source of truth for:

- namespace intent
- in-repo implementation state
- maturity
- publication status
- protocol version binding

## Required Release Hygiene

Any release that changes compatibility expectations should update:

- [CHANGELOG.md](../CHANGELOG.md)
- this compatibility policy
- relevant adapter docs
- relevant starter or example code
- contract or regression tests
