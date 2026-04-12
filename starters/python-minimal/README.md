# CUP Python Minimal Starter

This is the smallest official CUP starter for real applications.

It is intentionally modest:

- two routes
- one small mutation
- file-based templates
- a thin browser shell
- signed cookie sessions and CSRF protection

## What It Shows

- `app/server.py` keeps HTTP transport small
- `app/routes.py` resolves the current page
- `app/actions.py` owns the one state-changing mutation
- `app/views.py` assembles state for the templates
- `templates/` holds file-based CUP markup
- `static/app.js` stays thin and only loads, validates, and remounts protocol views

## Run

From the CUP repo root:

```bash
npm run build
python3 starters/python-minimal/server.py
```

Open [http://127.0.0.1:8050](http://127.0.0.1:8050).

If you copy this starter outside the repository, point it at a built CUP runtime:

```bash
CUP_DIST_DIR=/path/to/cup/dist python3 server.py
```

## Why This Starter Exists

Use this when you want to start smaller than the CRM starter but still keep the real CUP boundaries:

- backend stays authoritative
- templates live in files
- the browser only bridges route loads and form posts
- starter-safe policy validation runs before JSON leaves the server

If you need a richer authenticated app shell, move up to [`../python-crm`](../python-crm).
