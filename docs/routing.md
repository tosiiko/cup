# CUP Routing

Phase 1 keeps two routing styles official.

## 1. Backend Route Resolution

This is the starter pattern.

- the browser asks for `/api/views?route=...`
- the backend decides which `ProtocolView` to return
- navigation updates `history` and then reloads the current route from the server

Use this for authenticated apps, workflows, and anything where permissions matter.

## 2. Client Router

The TypeScript runtime also exposes `createRouter()` for browser-local routes.

Useful hooks now available:

- `onNavigateStart(context)`
- `onNavigateEnd(context)`
- `onNavigateError(error, context)`

The `context` includes:

- `pathname`
- `params`
- `query`
- `source` as `start`, `navigate`, or `popstate`

## Patch And Stream Patterns

Phase 1 now adds:

- `validateProtocolPatch()`
- `applyProtocolPatch()`
- transport-aware stream helpers on the TypeScript adapter path

Use full views by default.

Use patches when:

- the template stays mostly the same
- only state or metadata changes
- remount cost is noticeable

Use streaming when:

- you need staged loading states
- a queue/table loads in chunks
- a workflow produces multiple server-side phases before settling

When you use the TypeScript adapter's remote helpers, inject the transport from your app through `fetchImpl` rather than relying on an implicit global network client.

Keep these guardrails:

- validate every chunk or patch
- treat patches as optional optimizations, not a trust boundary
- keep the server authoritative for routing and mutations
