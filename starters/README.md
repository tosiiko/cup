# CUP Starters

Starters are the recommended starting points for real CUP applications.

They are different from demos:

- `demo/` shows experiments, prototypes, and reference flows
- `starters/` is where CUP keeps copyable project layouts

## Current Starters

- [`python-minimal`](./python-minimal)
  The smallest official CUP starter. It demonstrates the baseline project shape with two routes, one mutation, file-based templates, starter-safe policy validation, and a thin browser bridge.

- [`python-crm`](./python-crm)
  The first official structured CUP starter. It demonstrates the recommended Python layout with `app/`, `views/`, `templates/`, and `static/`.

- [`python-portal`](./python-portal)
  The official workflow starter. It demonstrates a request/review/history portal loop with server-owned state transitions.

- [`node-dashboard`](./node-dashboard)
  The official Node-backed dashboard starter. It demonstrates signed cookie sessions, protected routes, and server-side policy validation without a heavy frontend stack.

## Starter Principles

Every CUP starter should keep the same core responsibilities:

- backend owns state, permissions, and mutations
- templates live in files
- views assemble state for templates
- browser shell stays thin and mounts protocol views
- security checks live on the server

But starters should still be adapter-idiomatic:

- Python starters should feel natural to Python projects
- Go starters should use Go handler and middleware patterns
- future adapters should keep the same responsibilities without forcing the same folder names

Every official starter should also:

- validate outgoing views against the schema and starter policy before sending JSON
- keep action URLs relative and server-owned
- make CSRF, session rotation, no-store headers, and audit events visible in the transport layer
- optionally use `@tosiiko/cup/styles/reference.css` as a baseline instead of inventing a design system on day one
