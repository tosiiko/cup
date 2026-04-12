---
name: cup-plan-execution
description: Use when asked to implement, prioritize, review, or advance work from PLAN.md in the CUP repository. Translates roadmap items into concrete changes across the schema, runtime, adapters, tests, docs, demos, and starters while preserving CUP's security-first, backend-first, contract-first design.
---

# CUP Plan Execution

Use this skill when work is driven by [PLAN.md](./PLAN.md), roadmap phases, production-readiness milestones, long-range platform direction, or any request to "move CUP forward" in a way that should stay aligned with the official plan.

## Core Stance

- Execute the nearest unblocked phase first. By default, `Phase 0` outranks later phases.
- Treat 2030+ roadmap items as strategy, design, governance, or prototypes unless the user explicitly asks for forward-looking implementation work.
- Prefer small, shippable slices with tests over broad speculative refactors.
- Security and correctness take priority over convenience.
- Backend authority takes priority over browser convenience.
- Contract clarity takes priority over hidden magic.

## Read First

Before changing code, inspect the smallest relevant set of files from this list:

- [PLAN.md](./PLAN.md)
- [README.md](./README.md)
- [schema/uiview.v1.json](./schema/uiview.v1.json)
- [package.json](./package.json)
- relevant files in `src/`
- relevant tests in `tests/` and `adapters/*/tests`
- relevant demo or starter files if the change affects user-facing flows

## Roadmap Translation Rules

- Schema or contract change:
  update the schema, validator, TypeScript protocol types, adapters, contract tests, and docs together.
- Template semantics change:
  update the parser, rendering behavior, security tests, docs, and examples together.
- Remote, action, or router change:
  update runtime code, success-path tests, failure-path tests, cleanup tests, and docs together.
- Starter or demo guidance change:
  update the matching demo or starter so the docs reflect shipped patterns rather than aspiration.
- Security-default change:
  add or strengthen tests in the same change whenever possible.
- Release or packaging change:
  verify build, package, and exported artifact behavior before closing the task.

## Repo Slice Map

- Wire contract:
  `schema/`, `src/protocol.ts`, `src/validate.ts`, `adapters/python/`, `adapters/go/`, `tests/runtime/contract.test.ts`
- Template and runtime core:
  `src/parser.ts`, `src/mount.ts`, `src/bind.ts`, `src/cleanup.ts`, `tests/runtime/`
- Remote, actions, and router:
  `src/remote.ts`, `src/actions.ts`, `src/router.ts`, `tests/runtime/`
- Docs, demos, and starters:
  `README.md`, `demo/`, `starters/`, adapter READMEs

## Default Workflow

1. Read the relevant phase in [PLAN.md](./PLAN.md) and restate the concrete milestone in working notes.
2. Identify the smallest coherent repo slice that makes measurable progress on that milestone.
3. Inspect the current implementation and tests before editing.
4. Implement code, tests, and docs together when shipped behavior changes.
5. Validate with the narrowest sufficient command, then widen if the surface area is broad.
6. Report what was completed, what remains, and any residual risk honestly.

## Validation Matrix

- TypeScript runtime:
  `npm run test:ts`
- Python adapter:
  `npm run test:python`
- Go adapter:
  `npm run test:go`
- Full repo gate:
  `npm run test`
  `npm run build`
  `npm run pack:check`

When user-facing flows change, run or smoke-test the most relevant app:

- `python3 demo/login/server.py`
- `python3 demo/dashboard/server.py`
- `python3 demo/dashboard2/server.py`
- `python3 starters/python-crm/server.py`

If a required validation step cannot be run, say so clearly in the final report.

## Phase Guidance

### Phase 0: Immediate Production-Readiness Work

This is the default priority until the core is clearly healthy.

Focus on:

- contract stability
- template and runtime hardening
- remote, action, and router correctness
- adapter alignment
- tests, CI, packaging, and documentation gates

Before doing Phase 1+ implementation work, ask:

- does this leave any Phase 0 safety or correctness blocker unresolved?
- is this a production need or only a future idea?
- can this be delivered as docs, design, or a prototype instead of core complexity?

### Phase 1: Foundation And Adoption

Once the core is healthy, focus on:

- adoption-ready starters
- better developer tooling and inspection
- accessible design patterns and optional tokens
- deterministic patching or streaming improvements
- AI generation guides and repair loops

### Phase 2-4: 2030-2050 Horizons

Default to:

- strategy documents
- extension design
- conformance tooling
- policy and governance scaffolding
- prototypes behind explicit boundaries

Do not quietly move long-horizon complexity into the stable core.

## Security Rules

- Default escaped output stays sacred; `|safe` remains exceptional.
- Do not move auth, permissions, sessions, or sensitive workflow logic into the browser.
- Treat AI-generated templates, actions, and code as untrusted until validated.
- Prefer explicit schemas, allowlists, and deterministic behavior over dynamic magic.
- Add tests for XSS, authorization boundaries, cleanup, and validation failures when touching risky code.
- Favor narrow capabilities over powerful escape hatches.

## Quality Bar

A roadmap item is not fully done unless most of these are true:

- the implementation matches the intended [PLAN.md](./PLAN.md) milestone
- tests cover the changed behavior or failure mode
- docs and examples reflect shipped behavior
- adapters remain aligned if the protocol changed
- security posture is at least as strong as before
- the final report states remaining work honestly

## When Updating PLAN.md

- Update [PLAN.md](./PLAN.md) only when shipped work changes roadmap status, scope, or sequencing.
- Preserve long-horizon sections as steering guidance unless the user explicitly asks to rewrite them.
- Do not mark future phases complete based on prototypes or notes alone.

## Decision Heuristics

- If you are unsure which phase wins, choose the earlier phase.
- If you are unsure whether a change belongs in the protocol, prefer keeping it out unless it clearly improves safety, portability, or interoperability.
- If you are unsure whether behavior should live in the browser or backend, keep it in the backend.
- If you are unsure whether to ship a broad refactor or a narrow fix, ship the narrow fix first.
