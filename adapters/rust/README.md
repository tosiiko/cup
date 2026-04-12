# rs-cup

Rust adapter path for CUP.

`rs-cup` is now an alpha in-repo adapter crate with a real builder, protocol structs, validation helpers, and starter-policy validation.

## What It Includes

- `UIView`
- `ProtocolView`
- `ActionDescriptor`
- `fetch()`, `emit()`, and `navigate()`
- `validate_view()`
- `validate_view_policy()`
- `starter_view_policy()`

## Example

```rust
use rs_cup::{fetch, starter_view_policy, validate_view_policy, UIView};
use serde_json::json;

let view = UIView::new("<h1>{{ title }}</h1>")
    .state_value("title", json!("Accounts"))
    .action("refresh", fetch("/api/accounts"))
    .title("Accounts")
    .route("/accounts")
    .to_view();

validate_view_policy(&view, &starter_view_policy()).unwrap();
```

## Current Level

- status: alpha in repo
- implementation: real crate source with tests
- verification: `cargo test` passes in this repo
