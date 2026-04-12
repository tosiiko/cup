# CUP CRM Dashboard Demo

`demo/dashboard2` is the first properly structured CUP app in this repository.

Instead of a single large `server.py`, it is split into:

- `app/server.py` for HTTP wiring
- `app/actions.py` for authenticated mutations
- `app/routes.py` for route resolution
- `app/sessions.py` and `app/security.py` for auth/session concerns
- `app/views/` for page state assembly
- `templates/` for CUP template files
- `static/` for the browser bridge and CSS

## Run

From the repo root:

```bash
npm run build
python3 demo/dashboard2/server.py
```

Open [http://127.0.0.1:8030](http://127.0.0.1:8030).

You can also run it from inside the folder with:

```bash
python3 server.py
```

## Demo users

- `ops.lead` / `Orbit!2026`
  Full CRM access including lead creation and security controls

- `sales.rep` / `Pipeline!2026`
  Read access to overview, companies, contacts, and pipeline

## CRM areas covered

- Login and protected routing
- Account and contact views
- Pipeline board with opportunity creation
- Role-based authorization
- Signed sessions, CSRF protection, and login throttling
- Session rotation, session termination, and audit events

## Why this demo matters

This folder is meant to show the shape of a scalable CUP application:

- templates are external files, not giant Python strings
- views focus on state, not transport
- backend security logic is isolated from page markup
- the browser still mounts plain CUP protocol views with no framework lock-in
