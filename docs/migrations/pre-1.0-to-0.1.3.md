# Pre-1.0 Migration Notes

Use this guide if you adopted CUP before the current Phase 0 and Phase 1 hardening work.

## Runtime Changes

- `ProtocolView` is now the wire-format type.
- `ClientView` is the browser-local mounted type.
- `UIView` remains the schema alias for protocol payloads.
- `{{ value }}` now escapes by default. Use `|safe` only for trusted HTML.
- `fetchView()` now takes an options object instead of loose headers.
- Remote views are validated by default before mounting.

## Router And Actions

- router transitions can be static values or getter functions
- dispatchers expose `loading`, `loadingCount`, `activeActions`, and `error`
- dispatcher and router instances now support explicit `destroy()`

## Packaging

- the npm package again ships TypeScript declarations
- the package now includes the schema contract and optional reference CSS

## Recommended Upgrade Path

1. Replace old shared `UIView` TypeScript usage with `ProtocolView` or `ClientView` depending on the call site.
2. Audit templates for any raw HTML assumptions and convert them to `|safe` only where intentional.
3. Update `fetchView()` calls to the options form.
4. Add schema validation and starter policy validation in backend responses before shipping new pages.
