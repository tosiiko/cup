# CUP Roadmap And Horizon Plan (2026-2050)

## Purpose

- Keep the near-term production work concrete and testable.
- Extend the roadmap beyond launch so CUP has a clear long-term direction in an AI-heavy software world.
- Prioritize security, correctness, accessibility, and backend authority over short-lived convenience.
- Treat anything beyond 2030 as directional strategy, reviewed regularly, not a locked promise.

## Long-Term Thesis

- CUP should become a durable protocol and runtime for backend-owned UI, especially for authenticated software, internal tools, portals, dashboards, CRMs, approval systems, and regulated workflows.
- CUP should not try to replace every frontend framework or win consumer web by brute force.
- In an AI-heavy future, CUP is strongest when it acts as the validated contract between backend systems, AI-generated UI logic, and the browser.
- The browser should remain thin and deterministic; business rules, permissions, policy, and auditability should remain server-authoritative.

## Guiding Principles

- Security and correctness come before convenience.
- The wire contract must stay explicit, versioned, and easy to validate.
- Backends own routing, authorization, sessions, mutations, and sensitive workflow rules.
- Templates should stay readable and file-based rather than hidden inside giant strings or opaque codegen.
- AI assistance should be treated as a productivity layer, not a trust boundary.
- Accessibility is a product requirement, not a cleanup phase.
- Cross-language portability matters: the protocol should outlast any one adapter or framework trend.

## Current State (April 2026)

- CUP is still pre-1.0 and should be treated as an alpha monorepo.
- The current repo already has the core building blocks: a TypeScript runtime, a versioned schema, Python and Go adapters, tests, demos, and starter guidance.
- Phase 0 production-readiness work is complete in the repository as of April 12, 2026.
- The immediate goal now shifts from core hardening to Phase 1 adoption, tooling, and starter quality.

## Horizon Overview

### 2026-2030: Stable Core And Product-Market Fit

- Ship and harden the first stable protocol/runtime/adapters.
- Prove CUP as a serious choice for backend-first business applications.
- Make CUP easy for both humans and AI systems to generate safely.

### 2030-2040: AI-Native Platform Maturity

- Evolve CUP from a runtime into a protocol platform with stronger tooling, policy rails, and component-level primitives.
- Support AI-assisted authoring, repair, migration, and evaluation as first-class workflows.
- Expand adapter coverage and enterprise governance features.

### 2040-2050: Durable Infrastructure Layer

- Keep the protocol stable enough to outlive frontend fashion cycles.
- Make CUP a dependable compatibility layer for long-lived business systems, agentic workflows, and governed UI generation.
- Focus on longevity, migration safety, auditability, and compatibility more than novelty.

## Phase 0: Immediate Production-Readiness Work (2026-2027)

### Status

- Completed in the repository on April 12, 2026.
- The runtime, schema validators, adapters, tests, CI, demo smoke coverage, and npm package smoke coverage now satisfy the Phase 0 release gate described below.

### Summary

- Target the first stable release as a public SDK for modern browsers, shipping the TypeScript runtime plus production-grade Python and Go adapters.
- Optimize for security and correctness first; allow breaking pre-1.0 changes wherever they remove unsafe defaults or ambiguous behavior.
- Treat the current repo as an alpha monorepo: stabilize the wire contract, harden the runtime, package each adapter cleanly, then add CI, release, and documentation gates.

### Public APIs And Contract Changes

- Split the current overloaded `UIView` concept into `ProtocolView` for the JSON wire contract and `ClientView` for browser-mounted views with function handlers. Keep `UIView` as the schema concept on the wire, but stop using the same TypeScript type for both roles.
- Change template semantics so `{{ value }}` HTML-escapes by default. Add one explicit trusted raw escape hatch, `{{ value|safe }}`, and document it as unsafe for untrusted input.
- Change `fetchView(url, container, headers?)` to `fetchView(url, container, options?)`. `options` must include `headers`, `timeoutMs`, `validate` defaulting to `true`, `fetchImpl`, and `onError`.
- Change `RouterOptions.transition` to accept either a static `Transition` or a getter function `() => Transition`, and add `router.destroy()` to remove global listeners.
- Replace ambiguous dispatcher concurrency state with `loading`, `loadingCount`, `activeActions`, and `error`; add `dispatcher.destroy()` and guarantee optimistic rollback on every handler failure.
- Add explicit schema validation helpers: `validateProtocolView()` in TypeScript, `validate_view()` in Python, and `Validate()` in Go. `fetchView()` must validate inbound views by default.

### Implementation Changes

- Phase 1: Stabilize repo and package structure. Keep the TypeScript runtime at repo root, move the Vite demo into an `examples/demo` area, exclude `cup_idea` from published artifacts, add `README.md`, `LICENSE`, `CHANGELOG.md`, and `SECURITY.md`, and make Go and Python adapters standalone publishable packages with examples outside library code.
- Phase 2: Harden the template and mount core. Move signals into a dedicated module to remove the current import cycle, make every remount clean prior bindings, either implement or explicitly remove undocumented `{% include %}` support, define the supported template grammar precisely, and add escaping, trusted raw output, and strict parser errors for malformed blocks.
- Phase 3: Fix router, action, and remote correctness. Use one helper that waits for either CSS transitions or animations, eliminate duplicate link interception, support live transition selection through the official router API instead of the current demo workaround, make loading state count-based, rethrow after `errorMiddleware` records errors, and validate remote JSON before mounting. For fetch actions, use query parameters for `GET` and JSON bodies for non-`GET`.
- Phase 4: Stabilize adapters against the schema. Keep `schema/uiview.v1.json` as the first stable wire contract, align adapter output with it exactly, include `meta` consistently, and add contract tests proving Python and Go emit views the TypeScript runtime accepts without adapter-specific branches.
- Phase 5: Add production tooling and release gates. Add TS unit tests and browser integration tests, Python tests, Go tests, schema contract tests, and CI that runs build, test, and package verification on every PR. Publish the runtime with explicit `exports` and types, and ship Python and Go packaging plus automated release verification before any public tag.

### Test Plan

- Template tests: escaping by default, `|safe` raw output, nested `if/for`, comparisons, loop metadata, malformed template failures, and removal of unsupported syntax from docs and examples.
- Runtime tests: remount cleanup, `bind`/`unbind` lifecycle, action success and rollback paths, concurrent actions, router navigation/back/forward, dynamic transitions, remote validation failures, and destroy-path listener cleanup.
- Cross-language contract tests: Python and Go outputs are schema-valid, the TS runtime mounts them unchanged, and `fetch`, `emit`, and `navigate` descriptors behave identically across adapters.
- Security tests: reflected XSS attempts through state interpolation must render as text; only `|safe` may inject trusted HTML; duplicate navigation and leaked global listeners must fail tests.
- Release tests: clean checkout build, demo smoke test, npm package smoke test, Python package build smoke test, Go module import smoke test, and docs/examples that match shipped APIs.

### Assumptions And Defaults For V1

- First stable release targets modern evergreen browsers only; legacy-browser work is out of scope for v1.
- CLI, hot reload, and DevTools are not launch blockers; they stay out of scope until the stable core ships.
- No SSR or hydration support is required for the first production-ready milestone.
- The wire protocol version stays `1`; package versions may evolve independently, but the safety and behavior changes above happen before the first stable public release.

## Phase 1: Foundation And Adoption (2027-2030)

### Status

- Completed in the repository on April 12, 2026.
- Phase 1 now includes: local inspector APIs; starter-safe policy validation helpers in TypeScript, Python, and Go; optional reference CSS; Python and Go scaffold generators; four official starter shapes across Python and Node; patch, stream, offline, and repair helpers in the runtime; Node contract coverage; starter smoke coverage across all official starters; and expanded docs for architecture, routing, security, testing, compatibility, Node usage, migration, and AI prompt/eval workflows.

### Product Goals

- Establish CUP as a credible backend-first alternative for business apps that do not want a heavy SPA stack.
- Make the Python and Go stories production-ready and add a strong Node adapter path.
- Publish at least one canonical starter per major backend style: minimal app, authenticated dashboard, CRM/admin shell, and portal workflow.
- Turn demos into audited reference implementations rather than one-off examples.

### Protocol And Runtime Goals

- Freeze the v1 contract and publish compatibility guarantees.
- Add optional patch-oriented updates for common cases where full remounts are too expensive.
- Add streaming-friendly response patterns for loading states, large tables, and multi-step workflows.
- Improve router/navigation semantics, transition hooks, and progressive enhancement behavior.
- Add offline-aware but server-authoritative patterns for draft state and retryable actions without turning CUP into an offline-first SPA.

### Developer Experience Goals

- Ship stronger docs for architecture, security, templates, actions, routing, styling, and testing.
- Add a local inspector for mounted views, action descriptors, validation failures, and state payloads.
- Add code generators for new routes, views, actions, and templates in each official adapter.
- Add migration guides for every breaking protocol/runtime release.

### Design System Goals

- Publish an official CUP component vocabulary at the documentation level, even if the wire format stays template-first.
- Provide accessible starter patterns for navigation, forms, data tables, dialogs, banners, tabs, pagination, empty states, and error states.
- Introduce design tokens, theme primitives, and a reference CSS package that stays optional.

### Security Goals

- Make secure defaults impossible to miss in every starter.
- Standardize CSRF, signed sessions, no-store headers, authorization boundaries, and audit logging guidance.
- Add higher-level safe rendering guidance for attributes, URLs, CSS, and trusted HTML.
- Add policy checks so official starters can reject malformed or non-compliant views before they ever reach the browser.

### AI Goals

- Document how AI systems should generate valid CUP views using the schema contract.
- Add validation-and-repair loops where generated output that fails schema or policy checks is repaired automatically.
- Provide prompts, evals, and fixtures for AI-assisted route generation, template generation, and action wiring.
- Treat AI-generated templates and actions as untrusted until validated and authorized.

## Phase 2: AI-Native Platform Maturity (2030-2035)

### Product Position

- CUP should be recognized as infrastructure for AI-assisted business software, not just a niche runtime.
- The primary user story becomes: a team with backend expertise can generate, review, validate, deploy, and govern UI safely across languages.

### Protocol Goals

- Introduce a versioned extension model so optional capabilities can grow without destabilizing the core contract.
- Add first-class primitives for partial update regions, list/table pagination hints, form metadata, and richer action semantics.
- Add view provenance metadata so generated views can record generator identity, validation status, and policy decisions.
- Add explicit capability negotiation between runtime and backend where useful.

### Runtime Goals

- Support incremental patching, streaming, and event-driven updates while preserving deterministic validation.
- Add built-in observability hooks for traces, action spans, render spans, validation failures, and policy decisions.
- Improve performance for large state payloads and frequently updated dashboards.
- Preserve progressive degradation paths so CUP apps can still function in constrained environments where possible.

### AI Workflow Goals

- Support agent-first authoring where AI can scaffold routes, templates, actions, tests, and docs in one flow.
- Add official eval suites for generated CUP artifacts covering validity, permission correctness, security boundaries, accessibility, and task completion.
- Add policy-aware code generation for high-risk surfaces such as billing, approvals, identity, and security settings.
- Add explainability tooling so teams can inspect why a view exists, which data it uses, and which policies gate its actions.

### Ecosystem Goals

- Add mature adapters for additional languages where demand is strong: Rust, Java, and .NET are likely candidates.
- Grow a plugin ecosystem for auth providers, design systems, data table patterns, analytics, and common workflow modules.
- Publish adapter conformance kits so third-party implementations can verify protocol compliance before claiming support.

### Governance Goals

- Define long-term support windows for protocol versions.
- Add compatibility test suites that can be run by vendors, internal platforms, and regulated teams.
- Publish a formal security response process and release signing story.
- Add deployment profiles for regulated environments that need stricter defaults and narrower capabilities.

## Phase 3: Platform Expansion And Governance (2035-2040)

### Product Goals

- Move from “useful framework choice” to “durable internal platform layer” for companies running long-lived software estates.
- Make CUP attractive for modernization projects where organizations need to keep backend authority while upgrading decades of UI surface area.

### Protocol And Compatibility Goals

- Preserve backward compatibility aggressively and make migrations explicit, tool-assisted, and reversible.
- Add declarative compatibility profiles so older and newer runtimes can interoperate within defined limits.
- Maintain a strict separation between stable core semantics and experimental extensions.

### Security And Policy Goals

- Add first-class policy packs for regulated domains without exposing dangerous low-level escape hatches by default.
- Expand provenance metadata into a durable audit model for generated views, generated actions, and human approvals.
- Add stronger trusted-rendering boundaries, safer DOM integration options, and hardened defaults for modern browser capabilities available at that time.

### Operational Goals

- Add fleet-level tooling for compatibility checks, schema rollouts, adapter drift detection, and incident forensics.
- Support long-term archival and replay of view/action traces for debugging and compliance.
- Provide operational guidance for large multi-tenant deployments and mixed-version estates.

### Accessibility And Internationalization Goals

- Make high-quality accessibility auditing part of the normal development and release loop.
- Expand official guidance for localization, RTL layout support, dense enterprise data views, and assistive-technology-friendly interaction patterns.
- Ensure official component patterns remain usable without requiring bespoke frontend engineering.

## Phase 4: Durable Infrastructure Layer (2040-2050)

### Strategic Goal

- Keep CUP useful because it is stable, inspectable, governable, and portable, not because it chases every trend.

### Expected Position By 2050

- CUP should function as a long-lived UI contract layer for backend-first systems, AI-assisted app generation pipelines, and governed enterprise workflows.
- The protocol should be stable enough that organizations can keep apps alive for decades, swap adapters, replace AI tooling, and still preserve their UI contracts.
- CUP should support mixed human-and-AI maintenance as a normal mode of operation.

### 2040-2050 Priorities

- Maintain strong protocol stewardship with slow, deliberate change.
- Keep migration tooling excellent so old applications can be upgraded safely.
- Preserve auditability and replayability for regulated and high-value workflows.
- Maintain excellent documentation and training data so future AI systems can generate CUP artifacts correctly.
- Ensure official tooling can validate not only syntax and schema, but also policy, accessibility, compatibility, and provenance.
- Continue broad adapter coverage so CUP stays independent of any single language or vendor stack.

### What Should Not Happen

- CUP should not become dependent on one model vendor, one cloud, one framework, or one adapter.
- CUP should not rely on opaque generated code that teams cannot inspect or override.
- CUP should not allow convenience APIs to erode backend authority over permissions and mutations.
- CUP should not let “experimental” features quietly become permanent security liabilities.

## Capability Tracks Across All Horizons

### 1. Protocol Stewardship

- Keep the core schema compact, explicit, and versioned.
- Grow via extensions, profiles, and negotiated capabilities rather than contract ambiguity.
- Publish compatibility guarantees and deprecation schedules clearly.

### 2. Runtime And Performance

- Keep the browser runtime thin, inspectable, and safe by default.
- Improve rendering, patching, streaming, caching, and navigation only where the behavior stays deterministic and debuggable.
- Avoid turning the runtime into a hidden app framework with too much implicit state.

### 3. Security And Trust

- Keep escaping, validation, and strict defaults central to the design.
- Treat trusted HTML as exceptional and policy-governed.
- Keep server authorization authoritative for all protected routes and actions.
- Build for auditability, provenance, and review of AI-generated artifacts.
- Favor high-level security guidance and tested patterns over exposing dangerous low-level mechanics.

### 4. AI Authoring And Evaluation

- Make CUP easy for structured-output models to target.
- Provide schemas, examples, eval suites, repair loops, and policy checks.
- Support both code-first and prompt-first workflows.
- Ensure AI-generated code and views are reviewable by humans and enforceable by tooling.

### 5. Accessibility And UX Quality

- Keep WCAG-aligned patterns in official starters and components.
- Prevent inaccessible defaults from creeping into reference material.
- Make forms, tables, navigation, and error handling accessible by construction where possible.

### 6. Tooling And Observability

- Provide inspectors, validators, traces, test harnesses, and conformance suites.
- Make failures easy to explain: schema failure, policy failure, authorization failure, render failure, action failure, or compatibility failure.
- Build release gates that catch drift early.

### 7. Ecosystem And Adapters

- Keep Python and Go excellent.
- Add adapters only when they can be maintained to full conformance quality.
- Make third-party adapters verify themselves against official suites before being recommended.

### 8. Governance And Operations

- Document support windows, release processes, security response procedures, and compatibility policy.
- Provide profiles for regulated, enterprise, and general-purpose deployment needs.
- Support large-scale operational use without forcing teams into one hosting model.

## Major Risks

- CUP remains too low-level and gets bypassed by higher-level tools.
- CUP grows too many ad hoc features and loses the simplicity that makes it safe and portable.
- AI tooling generates fragile views faster than teams can govern them.
- The ecosystem fragments around unofficial schemas or incompatible adapters.
- CUP tries to compete with full SPA ecosystems on their terms instead of winning its own category.

## Anti-Goals

- Do not optimize for consumer social apps, design-heavy marketing sites, or hyper-custom client-side experiences first.
- Do not move authorization, policy, or sensitive workflow control into the browser.
- Do not hide protocol behavior inside magical tooling that teams cannot debug.
- Do not make security-sensitive escape hatches feel normal or ergonomic for everyday use.

## Success Metrics By 2030

- A stable `1.x` protocol family with strong compatibility guarantees.
- Production-grade TypeScript, Python, Go, and at least one additional major adapter.
- Official starters that are secure, accessible, and used in real business applications.
- Strong test coverage across runtime, schema, adapters, security, and examples.
- AI generation workflows that consistently produce valid CUP artifacts with measurable repair rates and eval quality.

## Success Metrics By 2040

- Widespread use in backend-first internal software and regulated workflow applications.
- Mature conformance testing and compatibility support across multiple adapters.
- Strong observability, provenance, and governance tooling for generated and human-authored UI.
- Low-friction upgrades across long-lived CUP applications.

## Success Metrics By 2050

- CUP remains useful because it is durable, portable, and governable.
- Organizations can preserve and evolve CUP applications across multiple backend generations, AI generations, and infrastructure shifts.
- The protocol remains understandable to both humans and machine tooling without a proprietary dependency trap.

## Review Cadence

- Revisit the 2026-2030 sections every quarter while CUP is pre-1.0 or early `1.x`.
- Revisit the 2030-2040 sections annually once the stable core ships.
- Revisit the 2040-2050 horizon every 2-3 years as a strategic steering document, not a fixed delivery promise.
