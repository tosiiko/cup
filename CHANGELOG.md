# Changelog

## Unreleased

## 0.1.4

- Restored published TypeScript declaration files and `types` exports for the runtime package.
- Hardened the runtime around remote action errors, destroy-path cleanup, and request-shaping behavior.
- Tightened TypeScript, Python, and Go action validation so each action type rejects unsupported cross-type fields.
- Expanded contract tests so Python and Go adapter fixtures verify metadata and runtime navigation behavior end-to-end.
- Added stronger release smoke coverage for the login demo and packed npm artifact verification.
- Added a local inspector API, starter-safe view policy helpers, and optional reference CSS for Phase 1 adoption work.
- Added starter and adapter documentation for policy validation, reference styling, AI generation guidance, and pre-1.0 migration notes.
- Added Python and Go scaffold generators for new pages and actions, with starter-safe file output plus paste-ready wiring snippets.
- Added a new `python-minimal` starter plus a starter smoke test covering route load, policy validation, CSRF, and mutation remounting.
- Added patch validation, patch application, streaming remote mounts, offline draft/retry helpers, and repair helpers to the TypeScript runtime.
- Added new `python-portal` and `node-dashboard` starters and expanded starter smoke coverage across all official starter shapes.
- Added Node contract coverage plus Phase 1 docs for architecture, routing, security, testing, compatibility, and AI prompt/eval fixtures.

## 0.1.3

- Removed published TypeScript declaration files from the npm package.
- Removed `types` exports so the package no longer exposes the declaration graph.
- Kept the bundled and minified JavaScript runtime as the only distributed implementation artifact.

## 0.1.2

- Switched npm builds to emit a bundled and minified runtime entry instead of publishing the full readable module graph.
- Stopped publishing JavaScript source maps and declaration maps.
- Kept type declarations while reducing the amount of implementation detail exposed in the npm artifact.

## 0.1.1

- Updated the README with practical guidance for structuring real CUP applications.
- Added best-practice recommendations for using `templates/`, modular backends, and thin browser shells.
- Documented `demo/dashboard2` as the reference structured CUP application.
- Added guidance for Tailwind and production-oriented security boundaries.

## 0.1.0

- Split protocol and client-side view types.
- Escaped template rendering by default with `|safe` as the trusted escape hatch.
- Added protocol validation for TypeScript, Python, and Go adapters.
- Hardened router, action dispatcher, and remote fetching behavior.
- Added tests, CI, adapter packaging, and an isolated demo application.
