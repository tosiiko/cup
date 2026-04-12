# CUP On Node

Node does not need a separate frontend framework to use CUP well.

For Node today, the published package is still `@tosiiko/cup`, and the in-repo `node-cup` path is an alpha wrapper namespace rather than a separately published npm package.

## What The Node Path Includes

- `ProtocolView` and protocol validation
- `validateViewPolicy(..., STARTER_VIEW_POLICY)`
- patch and stream helpers
- the browser runtime for mounting and remounting views
- the in-repo `node-cup` alpha wrapper surface
- official Node starter coverage through `starters/node-dashboard`

## Recommended Pattern

- use Node for HTTP, sessions, auth, headers, and route resolution
- emit plain `ProtocolView` objects from route handlers
- validate them with `validateViewPolicy(..., STARTER_VIEW_POLICY)` before returning JSON
- keep the browser shell small and framework-light
- let the server decide the next route and next view after every mutation

## Official Reference

See [`../starters/node-dashboard`](../starters/node-dashboard) for the Phase 1 Node starter.

It demonstrates:

- signed cookie sessions
- CSRF checks
- protected routes
- a small authenticated dashboard shell
- policy validation before JSON leaves the server

## Minimal Example

```ts
import {
  STARTER_VIEW_POLICY,
  validateViewPolicy,
} from '@tosiiko/cup';

const view = validateViewPolicy({
  template: '<h1>{{ title }}</h1>',
  state: { title: 'Accounts' },
  meta: {
    version: '1',
    title: 'Accounts',
    route: '/accounts',
  },
}, STARTER_VIEW_POLICY);
```

## Important Clarification

Node is a first-class backend path in CUP.
The current published runtime is `@tosiiko/cup`, while `node-cup` exists in-repo as an alpha wrapper namespace that may later become its own published adapter package.

That means the Node story is:

- one published shared package today
- one alpha Node wrapper path in-repo
- one shared protocol contract
- one official Node starter
- server-side validation plus browser-side mounting
