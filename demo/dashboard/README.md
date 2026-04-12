# CUP Financial Dashboard Demo

This demo is a larger Python-powered CUP application with:

- password hashing with PBKDF2
- signed server-side sessions
- CSRF protection
- login rate limiting
- security headers
- protected routes and role-based authorization
- audit logging and session management

## Run

From the repo root:

```bash
npm run build
python3 demo/dashboard/server.py
```

Open [http://127.0.0.1:8020](http://127.0.0.1:8020).

## Demo users

- `treasury.demo` / `Vault!2026`
  Full access: overview, accounts, transactions, payments, security

- `analyst.demo` / `Ledger!2026`
  Read-only access: overview, accounts, transactions

## Security areas covered

- Hashed passwords
- Signed session cookies
- Session idle and absolute expiry
- CSRF tokens for every POST
- Login throttling
- Authorization checks per page and action
- Security and cache-control headers
- Session rotation and "terminate other sessions" controls
- Audit events rendered in the security page

## Note

This is a security-conscious demo, not a real bank. It uses an in-memory store and demo data so it stays easy to read and run locally.
