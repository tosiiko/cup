# CUP Starters

Starters are the recommended starting points for real CUP applications.

They are different from demos:

- `demo/` shows experiments, prototypes, and reference flows
- `starters/` is where CUP keeps copyable project layouts

## Current Starters

- [`python-crm`](./python-crm)
  The first official structured CUP starter. It demonstrates the recommended Python layout with `app/`, `views/`, `templates/`, and `static/`.

## Starter Principles

Every CUP starter should keep the same core responsibilities:

- backend owns state, permissions, and mutations
- templates live in files
- views assemble state for templates
- browser shell stays thin and mounts protocol views
- security checks live on the server

But starters should still be adapter-idiomatic:

- Python starters should feel natural to Python projects
- Go starters should use Go handler and middleware patterns
- future adapters should keep the same responsibilities without forcing the same folder names
