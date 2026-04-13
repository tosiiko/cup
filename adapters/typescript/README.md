# ts-cup

TypeScript adapter path for CUP.

`ts-cup` is currently an alpha wrapper adapter that builds on the core `@tosiiko/cup` package while giving TypeScript backends and server code a dedicated adapter surface.

## What It Adds

- `defineTypeScriptView()`
- `withTypeScriptMeta()`
- `toTypeScriptResponse()`
- `tsFetch()`
- `tsEmit()`
- `tsNavigate()`
- `fetchView()`
- `fetchViewStream()`

These helpers:

- inject TypeScript adapter metadata
- validate the protocol shape
- optionally enforce `STARTER_VIEW_POLICY`
- make server-side response assembly more uniform
- keep the transport-aware remote loading helpers on the TypeScript side rather than in the core package

## Example

```ts
import { defineTypeScriptView, tsFetch, toTypeScriptResponse } from 'ts-cup';

const view = defineTypeScriptView({
  template: '<h1>{{ title }}</h1><button data-action="refresh">Refresh</button>',
  state: { title: 'Accounts' },
  actions: {
    refresh: tsFetch('/api/accounts', { method: 'GET' }),
  },
  meta: {
    title: 'Accounts',
    route: '/accounts',
  },
}, { policy: true });

const response = toTypeScriptResponse(view);
```

## Current Level

- status: alpha in repo
- implementation: wrapper over the core package
- verification: covered by the TypeScript test suite in this repo

See [`examples/basic.ts`](./examples/basic.ts) for a minimal response-building example.
