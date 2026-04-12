# CUP Compatibility Guarantees

Phase 1 freezes the `v1` wire contract as the stable baseline.

## What Is Stable

- `schema/uiview.v1.json`
- `ProtocolView` and `meta.version = "1"`
- official action types:
  `fetch`, `emit`, `navigate`
- starter policy expectations around `meta.title`, `meta.route`, and relative action URLs

## What Can Change Additively

- new helper APIs in the TypeScript runtime
- new optional starter utilities
- new docs, generators, and adapters
- optional protocol helpers like patches and streaming patterns, as long as full-view `v1` remains valid

## What Requires Explicit Migration Guidance

- changing template semantics
- changing action descriptor shapes
- changing starter policy defaults
- changing adapter behavior in a way that can reject previously valid output

Every breaking change after this point must ship with:

- a migration note in `docs/migrations/`
- updated tests
- updated examples or starters

## Support Expectation

- the repository may evolve package versions independently of protocol `v1`
- official adapters should keep emitting `v1` unless a newer protocol version is explicitly introduced
- future protocol versions should be additive or clearly versioned instead of silently mutating `v1`
