# CUP Node Dashboard Starter

This starter is the official Node-backed dashboard reference for Phase 1.

It shows the same boundaries as the Python starters:

- signed cookie sessions
- CSRF validation on every mutation
- policy validation before protocol views leave the server
- a tiny browser shell that only mounts and remounts protocol views

## What It Shows

- `/login` as the public route
- protected dashboard routes resolved on the server
- one authenticated mutation for dismissing alerts
- Node emitting plain CUP protocol views without a framework dependency

## Run

From the CUP repo root:

```bash
npm run build
node starters/node-dashboard/server.mjs
```

Open [http://127.0.0.1:8075](http://127.0.0.1:8075).

Use the demo credentials already filled into the sign-in form:

- username: `analyst@cup.local`
- password: `demo-pass`

## Why This Starter Exists

Use this starter when your backend is Node but you still want the CUP backend-first contract instead of a client-heavy SPA.
