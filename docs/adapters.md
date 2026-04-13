# CUP Adapter Namespaces

This document defines the official CUP adapter naming plan and the status model used by the adapter registry.

## Why This Exists

The protocol is language-agnostic, but that does not mean CUP already ships official adapters for every language.

This registry solves two problems:

- it gives the project one canonical naming scheme
- it prevents the docs from loosely saying “all languages” when only some adapters are actually implemented today

## Current Truth

Production adapters today:

- Python
- Go

Alpha adapter paths also exist in-repo for:

- Node.js
- TypeScript
- Rust
- Java

Runnable `cup init` project scaffolds today:

- `py-cup`
- `go-cup`
- `node-cup`
- `ts-cup`

The remaining language folders are bootstrapped scaffolds for future implementation.

## Naming Rule

- core runtime:
  `@tosiiko/cup`
- language adapters:
  `<language>-cup` or short-code `*-cup`

The current namespace family is:

- `py-cup`
- `go-cup`
- `node-cup`
- `ts-cup`
- `rs-cup`
- `java-cup`
- `dotnet-cup`
- `php-cup`
- `rb-cup`
- `ex-cup`
- `kt-cup`
- `swift-cup`
- `dart-cup`
- `clj-cup`
- `lua-cup`
- `zig-cup`
- `nim-cup`
- `ocaml-cup`
- `perl-cup`
- `hs-cup`

## Important Limitation

This file is a project namespace registry, not proof of package-manager reservation.

A name here means:

- CUP intends to use it
- CUP documentation should treat it as the canonical namespace

It does **not** automatically mean:

- the package is already published
- the name is reserved on npm, PyPI, crates.io, NuGet, Packagist, Hex, RubyGems, or another ecosystem registry
- the adapter is already production-ready just because an in-repo scaffold exists

## Source Of Truth

The machine-readable namespace registry lives at:

- [`../adapters/namespaces.json`](../adapters/namespaces.json)

Use that file when generating docs, release plans, or future adapter work.

## Registry Fields

The registry deliberately separates project intent from implementation reality.

- `intent`
  Whether the namespace is an official CUP track.
- `repository_state`
  Whether the adapter is currently implemented in the repo or only bootstrapped.
- `implementation_kind`
  The technical shape of the adapter:
  `production`, `wrapper`, `source`, or `scaffold`
- `maturity`
  The expected confidence level:
  `stable`, `alpha`, or `scaffold`
- `publication_status`
  Whether the ecosystem-native package is published yet.
- `protocol_versions`
  Which CUP wire-protocol versions the adapter is expected to support.
- `depends_on_core_package`
  Whether the adapter intentionally reuses the core `@tosiiko/cup` package surface.

## Practical Interpretation

- Python and Go:
  implemented, production, stable, not yet separately published under the planned `*-cup` namespace
- Node and TypeScript:
  implemented, wrapper, alpha, not yet separately published
  TypeScript also owns the current in-repo transport-aware remote helpers so the core `@tosiiko/cup` package can stay transport-free.
- Rust and Java:
  implemented, source, alpha, not yet separately published
- remaining adapters:
  official namespace intent exists, but implementation is still scaffold-level
