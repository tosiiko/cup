# CUP Security Guide

Security is part of the architecture, not a later cleanup.

## Runtime Defaults

- `{{ value }}` escapes HTML by default
- `fetchView()` validates protocol views by default
- official starters validate outgoing views against `STARTER_VIEW_POLICY`

## Starter Checklist

- signed cookie sessions
- CSRF protection on every state-changing POST
- no-store headers on HTML and JSON
- server-owned auth and authorization
- relative action URLs by default
- policy validation before JSON leaves the server

## Dangerous Patterns To Avoid

- `|safe` with untrusted input
- inline handlers such as `onclick=`
- `javascript:` URLs
- absolute action URLs in starter-grade apps
- client-side permission checks that can drift from the server

## AI-Specific Rule

Treat generated templates and actions as untrusted input until they pass:

1. schema validation
2. policy validation
3. backend authorization

Only then should the browser mount them.
