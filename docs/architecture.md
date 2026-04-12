# CUP Architecture

Use this structure when you want CUP to stay backend-first and easy to maintain.

## Recommended Layers

- transport layer:
  own HTTP, sessions, CSRF, auth, headers, and route parsing here
- route resolver:
  map a route plus the current user/session into one protocol view
- action layer:
  own mutations here and return the next protocol view after every write
- view builders:
  assemble state for one page at a time
- templates:
  keep markup file-based and predictable
- browser shell:
  load a protocol view, validate it, mount it, and submit forms back to the server

## Request Loop

1. The browser asks the backend for `/api/views?route=...`.
2. The backend resolves the route and builds a `ProtocolView`.
3. The backend validates the view against schema and policy before sending JSON.
4. The browser validates again, mounts the view, and syncs the route/title.
5. Mutations post JSON back to the server and remount the next validated view.

## Good Boundaries

- keep permissions and workflow rules on the server
- let templates render state, not decide auth
- keep the browser free of business logic
- make every mutation return the next server-approved state

## Anti-Patterns

- giant inline templates embedded in route handlers
- browser-only permission logic
- stateful client routers fighting backend routes
- bypassing policy checks because “the template came from codegen”
