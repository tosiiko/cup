# cup-go

Go adapter for the CUP protocol.

## Features

- Fluent `UIView` builder
- `Validate()` helper for protocol safety
- `ValidatePolicy(..., cup.StarterViewPolicy)` for starter-safe server checks
- `go run ./cmd/cupgen scaffold ...` for view/template scaffolds and wiring snippets
- `WriteJSON()` for `net/http`

## Example

```go
view := cup.New(`<h1>{{ title }}</h1>`).
    State(cup.S{"title": "Hello"}).
    Title("Home")

if err := view.Validate(); err != nil {
    log.Fatal(err)
}

if err := cup.ValidatePolicy(view.ToMap(), cup.StarterViewPolicy); err != nil {
    log.Fatal(err)
}
```

## Generator

```bash
go run ./cmd/cupgen scaffold page "Account Health" --route /crm/account-health --out /tmp/cup-go-app
go run ./cmd/cupgen scaffold action "sync accounts" --endpoint /api/accounts/sync --success-route /crm/companies --out /tmp/cup-go-app
```

The Go generator writes real `internal/views/` and `templates/` files where appropriate, plus `.cup/snippets/` files for route and action registration in your own `net/http` server.
