# CUP

CUP is a protocol-driven UI runtime for backend-first browser applications.

Your backend returns JSON views that match [`schema/uiview.v1.json`](./schema/uiview.v1.json), and the browser runtime validates, renders, and remounts them safely. CUP is built for apps where the backend should stay in charge of routing, authorization, sessions, workflow rules, and mutations.

Best fit:

- dashboards
- admin panels
- CRMs
- portals
- internal tools
- authenticated workflows

Less ideal:

- animation-heavy consumer SPAs
- offline-first client apps
- apps that want most logic in React/Vue/Svelte components

## Install

```bash
npm install @tosiiko/cup
```

## What A CUP View Looks Like

```json
{
  "template": "<section><h1>{{ title }}</h1><button data-action=\"refresh\">Refresh</button></section>",
  "state": {
    "title": "Accounts"
  },
  "actions": {
    "refresh": {
      "type": "fetch",
      "url": "/api/accounts",
      "method": "GET"
    }
  },
  "meta": {
    "version": "1",
    "title": "Accounts",
    "route": "/accounts"
  }
}
```

The practical model is simple:

- the backend owns state, permissions, and mutations
- templates live in files, not giant strings
- views assemble state and choose templates
- the browser mounts protocol views and posts actions back

## Quick Start

```ts
import {
  STARTER_VIEW_POLICY,
  mountRemoteView,
  validateProtocolView,
  validateViewPolicy,
} from '@tosiiko/cup';

async function loadView(url: string, root: HTMLElement) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json();
  const view = validateProtocolView(payload);
  validateViewPolicy(view, STARTER_VIEW_POLICY);
  mountRemoteView(view, root);
}
```

For most CUP apps, that thin browser shell is enough:

- load the current route
- validate the returned view
- mount it
- submit forms or action payloads back to the server
- remount the next server-approved view

## What Ships In `@tosiiko/cup`

- browser runtime helpers like `mountRemoteView()`, `fetchView()`, and `fetchViewStream()`
- explicit transport injection for `fetchView()` and `fetchViewStream()` through `fetchImpl`
- schema validation with `validateProtocolView()` and `validateProtocolPatch()`
- policy validation with `validateViewPolicy()` and `STARTER_VIEW_POLICY`
- inspection helpers with `createInspector()` and `inspectView()`
- patch helpers with `applyProtocolPatch()` and `isProtocolPatch()`
- repair helpers for generated or malformed inputs
- offline draft/retry helpers for server-authoritative patterns
- the versioned wire schema export
- an optional reference theme stylesheet export

## Core Ideas

### Backend Authority

Keep auth, permissions, sessions, routing, and mutations on the server.

### Thin Browser Surface

The browser should validate, mount, and submit data back. It should not become a second business-logic layer.

### File-Based Templates

Keep markup in template files and view logic in backend modules.

### Explicit Contract

Views are data. That makes them easier to validate, test, inspect, and generate safely.

## Template Rules

CUP templates are intentionally small and predictable.

- `{{ value }}` escapes HTML by default
- `{{ value|safe }}` renders trusted HTML and must only be used with sanitized content
- `{% if %}`, `{% elif %}`, `{% else %}`, and `{% endif %}` are supported
- `{% if %}` supports truthy checks, `not` / `!`, and comparisons with `==`, `!=`, `>`, `<`, `>=`, and `<=`
- `{% for item in items %}` and `{% endfor %}` are supported
- `for` blocks expose `loop.index`, `loop.index1`, `loop.first`, and `loop.last`
- unsupported tags like `{% include %}` fail with parser errors

Good practice:

- keep templates focused on rendering
- keep permission logic out of templates
- prefer fixed class names over dynamic class generation
- treat `|safe` as exceptional

## Security Defaults

Runtime defaults:

- `{{ value }}` escapes by default
- `fetchView()` validates incoming protocol views by default
- remote network helpers require an explicit `fetchImpl` from the app
- the runtime targets modern evergreen browsers

Starter-grade backend defaults should include:

- signed cookie sessions
- CSRF protection on every state-changing POST
- no-store headers on HTML and JSON
- server-owned authorization
- policy validation before JSON leaves the server
- relative action URLs by default

Starter policy example:

```ts
import { STARTER_VIEW_POLICY, validateViewPolicy } from '@tosiiko/cup';

validateViewPolicy(view, STARTER_VIEW_POLICY);
```

## Recommended App Structure

```text
my-cup-app/
  app/
    server.py
    routes.py
    actions.py
    sessions.py
    security.py
    data.py
    views/
      auth.py
      overview.py
      accounts.py
      pipeline.py
      security.py
  templates/
    login.html
    shell.html
    pages/
      overview.html
      pipeline.html
      security.html
  static/
    app.js
    app.css
  README.md
```

Why this works:

- `server.py` stays thin
- `routes.py` decides which view to return
- `actions.py` owns mutations
- `security.py` and `sessions.py` isolate security-sensitive code
- `views/` assembles template state
- `templates/` keeps markup editable without bloating backend files

## Official Starters

- [Starter index](./starters)
- [Python minimal starter](./starters/python-minimal)
- [Python portal workflow starter](./starters/python-portal)
- [Python CRM starter](./starters/python-crm)
- [Node dashboard starter](./starters/node-dashboard)

Start here:

- smallest real starting point: [python-minimal](./starters/python-minimal)
- request/review/history workflow: [python-portal](./starters/python-portal)
- richer authenticated shell: [python-crm](./starters/python-crm)
- authenticated Node backend path: [node-dashboard](./starters/node-dashboard)

## Adapters

- [Python adapter](./adapters/python)
- [Go adapter](./adapters/go)
- [Node backend guidance](./docs/node.md)
- [Adapter namespaces and status](./docs/adapters.md)

Production adapters today are Python and Go.

Node and TypeScript now also have alpha wrapper adapter paths, and Rust and Java have alpha source adapters in-repo. See [docs/adapters.md](./docs/adapters.md) for the current implementation level of each language path.

## Docs

- [Architecture](./docs/architecture.md)
- [Routing and streaming](./docs/routing.md)
- [Security](./docs/security.md)
- [Testing](./docs/testing.md)
- [Compatibility and deprecation policy](./docs/compatibility.md)
- [Reference UI vocabulary](./docs/reference-ui.md)
- [Generators](./docs/generators.md)
- [AI guidance](./docs/ai.md)
- [AI prompts, evals, and fixtures](./docs/ai-evals.md)
- [Migration notes](./docs/migrations/pre-1.0-to-0.1.3.md)

## Reference Demos

- [Simple login demo](./demo/login)
- [Structured CRM demo](./demo/dashboard2)
- [Financial dashboard prototype](./demo/dashboard)

Use demos to study patterns. Use starters to begin a real project.

## Development

```bash
npm install
npm run build
npm run test
npm run demo:smoke
npm run starter:smoke
npm run pack:check
```

Useful local commands:

```bash
python3 demo/login/server.py
python3 demo/dashboard/server.py
python3 demo/dashboard2/server.py
python3 starters/python-minimal/server.py
python3 starters/python-portal/server.py
python3 starters/python-crm/server.py
node starters/node-dashboard/server.mjs
```

## Status

- protocol version: `1`
- package version: `0.1.6`
- browser target: modern evergreen browsers
- current focus: stable backend-first runtime, adapters, starters, and release tooling

## License

Current published releases are licensed under the [MIT License](./LICENSE).
