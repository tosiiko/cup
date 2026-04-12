# node-cup

Node adapter path for CUP.

`node-cup` is currently an alpha wrapper adapter that builds on the core `@tosiiko/cup` package while giving Node backends a dedicated package surface and Node-specific helper functions.

## What It Adds

- `defineNodeView()`
- `withNodeMeta()`
- `toNodeResponse()`
- `nodeFetch()`
- `nodeEmit()`
- `nodeNavigate()`

These helpers:

- inject Node adapter metadata
- validate the protocol shape
- optionally enforce `STARTER_VIEW_POLICY`
- make plain `http` handlers simpler

## Example

```js
import { defineNodeView, nodeFetch, toNodeResponse } from 'node-cup';

const view = defineNodeView({
  template: '<h1>{{ title }}</h1><button data-action="refresh">Refresh</button>',
  state: { title: 'Accounts' },
  actions: {
    refresh: nodeFetch('/api/accounts', { method: 'GET' }),
  },
  meta: {
    title: 'Accounts',
    route: '/accounts',
  },
}, { policy: true });

const response = toNodeResponse(view);
```

## Current Level

- status: alpha in repo
- implementation: wrapper over the core package
- verification: covered by the TypeScript test suite in this repo

See [`examples/basic.mjs`](./examples/basic.mjs) for a minimal Node server example.
