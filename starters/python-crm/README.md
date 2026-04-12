# CUP Python CRM Starter

This is the first official structured starter for CUP.

It is based on the architecture proven out in `demo/dashboard2`, but this folder is intended to be copied and customized for new Python CUP applications.

## What This Starter Shows

- file-based CUP templates in `templates/`
- thin HTTP transport in `app/server.py`
- route resolution in `app/routes.py`
- authenticated mutations in `app/actions.py`
- session and security boundaries in `app/sessions.py` and `app/security.py`
- small view builders in `app/views/`
- a thin browser shell in `static/app.js`

## Run

From the CUP repo root:

```bash
npm run build
python3 starters/python-crm/server.py
```

Open [http://127.0.0.1:8040](http://127.0.0.1:8040).

You can also run it from inside the folder:

```bash
python3 server.py
```

If you copy this starter outside the repository, point it at a built CUP runtime:

```bash
CUP_DIST_DIR=/path/to/cup/dist python3 server.py
```

## Demo users

- `ops.lead` / `Orbit!2026`
  Full CRM access including opportunity creation and security controls

- `sales.rep` / `Pipeline!2026`
  Read access to overview, companies, contacts, and pipeline

## How To Customize It

Start here:

- `app/data.py` for seed data, route permissions, and sample business state
- `templates/` for page markup
- `app/views/` for the state passed into each template
- `app/actions.py` for form submissions and other mutations
- `app/routes.py` for adding new pages
- `static/app.css` for branding and layout

Keep these boundaries:

- templates render data, but do not enforce permissions
- actions validate and mutate, but do not own transport details
- routes decide which view to return
- sessions and CSRF stay in the backend

## Why This Starter Exists

The goal is to give CUP a canonical Python starting point so new projects do not begin with:

- one giant `server.py`
- inline HTML everywhere
- permission logic mixed into templates
- browser-owned security decisions

Use this folder as the template to copy. Use `demo/dashboard2` as the matching richer reference demo.
