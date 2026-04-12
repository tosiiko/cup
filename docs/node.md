# CUP On Node

Node does not need a separate frontend framework to use CUP well.

## Recommended Pattern

- use Node for HTTP, sessions, auth, headers, and route resolution
- emit plain `ProtocolView` objects from route handlers
- validate them with `validateViewPolicy(..., STARTER_VIEW_POLICY)` before returning JSON
- keep the browser shell small and framework-light

## Official Reference

See [`../starters/node-dashboard`](../starters/node-dashboard) for the Phase 1 Node starter.

It demonstrates:

- signed cookie sessions
- CSRF checks
- protected routes
- a small authenticated dashboard shell
- policy validation before JSON leaves the server

## Why The Main Package Is Enough

For Node backends, the main `@tosiiko/cup` package already provides the useful shared pieces:

- protocol types
- schema validation
- policy validation
- patch and stream helpers
- the browser runtime

That means the “Node adapter” story is intentionally lightweight:
use the same package on the server for validation and on the client for mounting.
