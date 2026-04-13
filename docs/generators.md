# CUP Generators

CUP now ships two generator layers:

- `cup init`
  for runnable project bootstraps
- adapter-specific scaffold commands
  for adding new pages and actions inside existing apps

`cup init` is the fastest way to start development from an empty folder.

`cup upgrade` refreshes the vendored `cup/index.js` runtime inside generated apps without regenerating the rest of the project.

## Project Init

Use the package binary to scaffold a runnable CUP app into the current directory or a target directory:

```bash
npx @tosiiko/cup init --adapter py-cup
npx @tosiiko/cup init my-node-login --adapter node-cup
npx @tosiiko/cup init my-ts-login --adapter ts-cup
npx @tosiiko/cup init my-go-login --adapter go-cup
npx @tosiiko/cup upgrade
npx @tosiiko/cup upgrade services/internal-app
```

Currently runnable `init` adapters:

- `py-cup`
- `go-cup`
- `node-cup`
- `ts-cup`

What `cup init` writes:

- a working app you can run immediately
- the CUP browser runtime where needed
- a small server or app shell you can run immediately
- a README with the next commands

The goal is “pick up and load,” not “blank starter with homework.”

Template behavior today:

- `py-cup`
  defaults to the standard structured Python app scaffold
- `py-cup --template login`
  keeps the tiny single-purpose login demo
- `node-cup`, `ts-cup`, and `go-cup`
  currently generate the login demo scaffolds

## Runtime Upgrade

Use this when a generated app vendors `cup/index.js` and you want to refresh it to the latest runtime shipped by the currently installed `@tosiiko/cup` package:

```bash
npx @tosiiko/cup upgrade
```

or for another folder:

```bash
npx @tosiiko/cup upgrade path/to/app
```

This replaces only `cup/index.js`. It does not rewrite your app code, templates, routes, or actions.

The generators follow one rule on purpose: they write safe starter files and snippet files, but they do not silently rewrite your existing route or action modules.

## Python

Use the installable CLI:

```bash
cup-python scaffold page "Account Health" --route /crm/account-health --out starters/python-crm
cup-python scaffold action "sync accounts" --endpoint /api/accounts/sync --success-route /crm/companies --out starters/python-crm
```

You can also run it from the repo without installing:

```bash
python3 adapters/python/cup_codegen.py scaffold page "Account Health" --route /crm/account-health --out starters/python-crm
```

What it writes:

- real files for starter-style views and templates
- `.cup/snippets/*.py` for route, data, action, and server insertions
- `.cup/snippets/*.js` when browser endpoint wiring is needed

## Go

Use the Go command from the adapter module:

```bash
cd adapters/go
go run ./cmd/cupgen scaffold page "Account Health" --route /crm/account-health --out /tmp/cup-go-app
go run ./cmd/cupgen scaffold action "sync accounts" --endpoint /api/accounts/sync --success-route /crm/companies --out /tmp/cup-go-app
```

What it writes:

- real files for generated views and templates
- `.cup/snippets/*.go` for route and action handler wiring
- `.cup/snippets/*.js` for browser endpoint examples when you need a thin browser bridge

## Why Snippets Instead Of Auto-Rewrites

- the current Python starter keeps routes and actions centralized
- the Go adapter does not yet ship a canonical starter layout
- snippet output is safer than trying to patch arbitrary application code

## Recommended Workflow

1. Generate the page or action scaffold into your app root.
2. Paste the matching snippets into the centralized route, action, data, or server files.
3. Replace placeholder records, payload validation, and success notices with real business logic.
4. Keep `validate_view_policy(..., STARTER_VIEW_POLICY)` or `cup.ValidatePolicy(..., cup.StarterViewPolicy)` in the final response path.
