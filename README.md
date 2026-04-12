# CUP

CUP is a protocol-driven UI runtime for modern browsers.

Your backend returns JSON views that conform to [`schema/uiview.v1.json`](./schema/uiview.v1.json), and the browser runtime validates, renders, and remounts them safely. The practical shape that worked best in the demos is:

- backend owns state, permissions, and mutations
- templates live in files, not giant strings
- views assemble state and choose templates
- the browser mounts plain protocol views and posts actions back

## Install

```bash
npm install @tosiiko/cup
```

## What CUP Is Best At

- Server-driven dashboards, admin panels, CRMs, portals, and authenticated workflows
- Apps where Python, Go, or another backend should own routing, authorization, and business rules
- Interfaces that benefit from HTML-like templating without locking into a frontend framework
- Systems where runtime validation and safe-by-default rendering matter

## Best-Practice Use

The strongest pattern from the demos is:

1. Keep transport, auth, sessions, and route resolution in backend modules.
2. Keep CUP templates in a `templates/` folder.
3. Keep view builders small and focused on state assembly.
4. Keep the browser shell thin: load a protocol view, validate it, mount it, submit forms back to the server.

Avoid this:

- one giant `server.py` with routes, templates, auth, and data mixed together
- large inline template strings for every page
- putting permission logic in the browser
- using `|safe` with untrusted content

## Recommended App Structure

This is the structure we now recommend for a real CUP app:

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

Why this works well:

- `server.py` stays thin and readable
- `routes.py` decides which view to return
- `actions.py` owns authenticated mutations
- `security.py` and `sessions.py` isolate security-critical behavior
- `views/` maps backend state into template state
- `templates/` lets you work on markup without bloating Python files

## Runtime Example

The browser side should stay small.

```ts
import { mountRemoteView, validateProtocolView } from '@tosiiko/cup';

async function loadView(url: string, root: HTMLElement) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json();
  const view = validateProtocolView(payload);
  mountRemoteView(view, root);
}
```

For most CUP apps, this thin shell is enough:

- load current route
- intercept internal links
- submit forms as JSON
- remount the next protocol view

## Template Rules

CUP templates intentionally stay small and predictable.

- `{{ value }}` escapes HTML by default
- `{{ value|safe }}` renders trusted HTML and must only be used with sanitized content
- `{% if %}`, `{% elif %}`, `{% else %}`, and `{% endif %}` are supported
- `{% for item in items %}` and `{% endfor %}` are supported
- unsupported tags fail with parser errors

Recommended template practice:

- keep page markup in template files
- keep logic in the backend, not in the template
- use templates for rendering, not for permission checks
- prefer fixed class names over dynamic class generation

## Security Defaults And Guidance

CUP now ships with safer defaults, but production safety still depends on backend design.

Runtime defaults:

- `{{ value }}` escapes HTML by default
- `fetchView()` validates incoming protocol views by default
- the runtime targets modern evergreen browsers

Backend guidance:

- validate protocol views before sending or mounting them
- use signed server-side sessions for authenticated apps
- require CSRF tokens on every state-changing POST
- enforce authorization on the server for every protected route and action
- return no-store headers for authenticated HTML and JSON
- keep audit events and session controls outside the browser

## Styling

CUP works with plain CSS, design systems, or utility frameworks like Tailwind.

Tailwind works well if you:

- scan your template files in Tailwind `content`
- include backend files if class names live there
- prefer literal class names over dynamic string construction
- keep a small custom stylesheet for app-level tokens and special components

## Core Types

- `ProtocolView`: wire-format view returned by a backend
- `ClientView`: browser-local mounted view with function handlers
- `UIView`: alias of `ProtocolView` for the schema contract

## Adapters

- Python: [`adapters/python`](./adapters/python)
- Go: [`adapters/go`](./adapters/go)

Both adapters emit the same protocol shape that the TypeScript runtime accepts, and both include validation helpers.

## Official Starters

- Starter index: [`starters`](./starters)
- Python CRM starter: [`starters/python-crm`](./starters/python-crm)

If you want the best starting point for a new CUP app, begin with [`starters/python-crm`](./starters/python-crm).

## Reference Demos

- Simple login demo: [`demo/login`](./demo/login)
- Structured CRM app: [`demo/dashboard2`](./demo/dashboard2)
- Financial dashboard prototype: [`demo/dashboard`](./demo/dashboard)

Use demos to study patterns and flows. Use starters when you want to begin a new project.

## Development

```bash
npm install
npm run build
npm run test
```

Useful demo commands:

```bash
python3 demo/login/server.py
python3 demo/dashboard/server.py
python3 demo/dashboard2/server.py
python3 starters/python-crm/server.py
```
