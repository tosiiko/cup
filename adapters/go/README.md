# cup-go

Go adapter for the CUP protocol.

Use it when `net/http` should own route resolution, state assembly, and protected mutations while the browser remains a thin CUP client.

## What It Includes

- fluent `UIView` builder
- `Fetch`, `Emit`, and `Navigate` action helpers
- `Validate()` for protocol safety
- `ValidatePolicy(..., cup.StarterViewPolicy)` for starter-safe server checks
- `WriteJSON()` for `net/http`
- `go run ./cmd/cupgen scaffold ...` for starter-oriented scaffolding

## Quick Example

```go
view := cup.New(`<h1>{{ title }}</h1><button data-action="refresh">Refresh</button>`).
    State(cup.S{"title": "Accounts"}).
    Action("refresh", cup.Fetch("/api/accounts", cup.WithMethod("GET"))).
    Title("Accounts").
    Route("/accounts")

if err := view.Validate(); err != nil {
    log.Fatal(err)
}

if err := cup.ValidatePolicy(view.ToMap(), cup.StarterViewPolicy); err != nil {
    log.Fatal(err)
}
```

## Why Use The Policy Check

`Validate()` confirms the protocol shape.

`ValidatePolicy(..., cup.StarterViewPolicy)` adds starter-safe checks such as:

- requiring `meta.version`
- requiring `meta.title`
- requiring `meta.route`
- rejecting `|safe`
- rejecting inline handlers
- rejecting `javascript:` URLs
- keeping action URLs relative

## Generator

```bash
go run ./cmd/cupgen scaffold page "Account Health" --route /crm/account-health --out /tmp/cup-go-app
go run ./cmd/cupgen scaffold action "sync accounts" --endpoint /api/accounts/sync --success-route /crm/companies --out /tmp/cup-go-app
```

The Go generator writes real `internal/views/` and `templates/` files where appropriate, plus `.cup/snippets/` files for route and action registration in your own `net/http` server.

## Reference Material

- protocol/runtime overview: [`../../README.md`](../../README.md)
- generator docs: [`../../docs/generators.md`](../../docs/generators.md)
- Node backend path clarification: [`../../docs/node.md`](../../docs/node.md)
