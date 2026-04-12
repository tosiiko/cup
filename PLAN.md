# CUP Production-Readiness Plan

## Summary
- Target the first stable release as a public SDK for modern browsers, shipping the TypeScript runtime plus production-grade Python and Go adapters.
- Optimize for security and correctness first; allow breaking pre-1.0 changes wherever they remove unsafe defaults or ambiguous behavior.
- Treat the current repo as an alpha monorepo: stabilize the wire contract, harden the runtime, package each adapter cleanly, then add CI, release, and documentation gates.

## Public APIs and Contract Changes
- Split the current overloaded `UIView` concept into `ProtocolView` for the JSON wire contract and `ClientView` for browser-mounted views with function handlers. Keep `UIView` as the schema concept on the wire, but stop using the same TypeScript type for both roles.
- Change template semantics so `{{ value }}` HTML-escapes by default. Add one explicit trusted raw escape hatch, `{{ value|safe }}`, and document it as unsafe for untrusted input.
- Change `fetchView(url, container, headers?)` to `fetchView(url, container, options?)`. `options` must include `headers`, `timeoutMs`, `validate` defaulting to `true`, `fetchImpl`, and `onError`.
- Change `RouterOptions.transition` to accept either a static `Transition` or a getter function `() => Transition`, and add `router.destroy()` to remove global listeners.
- Replace ambiguous dispatcher concurrency state with `loading`, `loadingCount`, `activeActions`, and `error`; add `dispatcher.destroy()` and guarantee optimistic rollback on every handler failure.
- Add explicit schema validation helpers: `validateProtocolView()` in TypeScript, `validate_view()` in Python, and `Validate()` in Go. `fetchView()` must validate inbound views by default.

## Implementation Changes
- Phase 1: Stabilize repo and package structure. Keep the TypeScript runtime at repo root, move the Vite demo into an `examples/demo` area, exclude `cup_idea` from published artifacts, add `README.md`, `LICENSE`, `CHANGELOG.md`, and `SECURITY.md`, and make Go and Python adapters standalone publishable packages with examples outside library code.
- Phase 2: Harden the template and mount core. Move signals into a dedicated module to remove the current import cycle, make every remount clean prior bindings, either implement or explicitly remove undocumented `{% include %}` support, define the supported template grammar precisely, and add escaping, trusted raw output, and strict parser errors for malformed blocks.
- Phase 3: Fix router, action, and remote correctness. Use one helper that waits for either CSS transitions or animations, eliminate duplicate link interception, support live transition selection through the official router API instead of the current demo workaround, make loading state count-based, rethrow after `errorMiddleware` records errors, and validate remote JSON before mounting. For fetch actions, use query parameters for `GET` and JSON bodies for non-`GET`.
- Phase 4: Stabilize adapters against the schema. Keep `schema/uiview.v1.json` as the first stable wire contract, align adapter output with it exactly, include `meta` consistently, and add contract tests proving Python and Go emit views the TypeScript runtime accepts without adapter-specific branches.
- Phase 5: Add production tooling and release gates. Add TS unit tests and browser integration tests, Python tests, Go tests, schema contract tests, and CI that runs build, test, and package verification on every PR. Publish the runtime with explicit `exports` and types, and ship Python and Go packaging plus automated release verification before any public tag.

## Test Plan
- Template tests: escaping by default, `|safe` raw output, nested `if/for`, comparisons, loop metadata, malformed template failures, and removal of unsupported syntax from docs and examples.
- Runtime tests: remount cleanup, `bind`/`unbind` lifecycle, action success and rollback paths, concurrent actions, router navigation/back/forward, dynamic transitions, remote validation failures, and destroy-path listener cleanup.
- Cross-language contract tests: Python and Go outputs are schema-valid, the TS runtime mounts them unchanged, and `fetch`, `emit`, and `navigate` descriptors behave identically across adapters.
- Security tests: reflected XSS attempts through state interpolation must render as text; only `|safe` may inject trusted HTML; duplicate navigation and leaked global listeners must fail tests.
- Release tests: clean checkout build, demo smoke test, npm package smoke test, Python package build smoke test, Go module import smoke test, and docs/examples that match shipped APIs.

## Assumptions and Defaults
- First stable release targets modern evergreen browsers only; legacy-browser work is out of scope for v1.
- CLI, hot reload, and DevTools are not launch blockers; they stay out of scope until the stable core ships.
- No SSR or hydration support is required for the first production-ready milestone.
- The wire protocol version stays `1`; package versions may evolve independently, but the safety and behavior changes above happen before the first stable public release.
