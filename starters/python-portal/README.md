# CUP Python Portal Workflow Starter

This starter is the official workflow-oriented CUP example.

It focuses on the request/review/history loop that shows up in portals, approvals, onboarding flows, and other authenticated business workflows:

- request submission stays server-authoritative
- review decisions are simple POSTs with CSRF protection
- the server returns the next protocol view after every state change

## What It Shows

- `app/routes.py` chooses the next workflow screen
- `app/actions.py` mutates the workflow state and returns the next view
- `app/views.py` assembles request, queue, and history state for the templates
- `templates/` keeps the markup file-based and predictable
- `static/app.js` stays thin and only drives route loads plus form submissions

## Run

From the CUP repo root:

```bash
npm run build
python3 starters/python-portal/server.py
```

Open [http://127.0.0.1:8065](http://127.0.0.1:8065).

## Why This Starter Exists

Use this when your app is more about workflow progression than dashboard chrome:

- approval requests
- onboarding portals
- ops escalations
- multi-step internal forms

If you need a broad admin shell instead, use [`../python-crm`](../python-crm). If you need the smallest possible scaffold, start with [`../python-minimal`](../python-minimal).
