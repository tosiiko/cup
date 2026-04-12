# cup-go

Go adapter for the CUP protocol.

## Features

- Fluent `UIView` builder
- `Validate()` helper for protocol safety
- `WriteJSON()` for `net/http`

## Example

```go
view := cup.New(`<h1>{{ title }}</h1>`).
    State(cup.S{"title": "Hello"}).
    Title("Home")

if err := view.Validate(); err != nil {
    log.Fatal(err)
}
```
