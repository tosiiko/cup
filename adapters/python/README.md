# cup-python

Python adapter for the CUP protocol.

Use it when Python should own route resolution, security, view assembly, and mutations while the browser stays as a thin CUP renderer.

## What It Includes

- fluent `UIView` builder
- `FetchAction`, `EmitAction`, and `NavigateAction`
- `validate_view()` for schema validation
- `validate_view_policy(..., STARTER_VIEW_POLICY)` for starter-safe server checks
- `to_json()` and `to_response()` helpers for common Python HTTP frameworks
- `cup-python scaffold ...` for starter-friendly route, page, and action generation

## Quick Example

```python
from cup import STARTER_VIEW_POLICY, FetchAction, UIView, validate_view, validate_view_policy

view = (
    UIView("<h1>{{ title }}</h1><button data-action='refresh'>Refresh</button>")
    .state(title="Accounts")
    .action("refresh", FetchAction("/api/accounts", method="GET"))
    .title("Accounts")
    .route("/accounts")
)

validate_view(view)
validate_view_policy(view, STARTER_VIEW_POLICY)
body, content_type = view.to_response()
```

## Why Use The Policy Check

`validate_view()` confirms the protocol shape.

`validate_view_policy(..., STARTER_VIEW_POLICY)` adds starter-safe checks such as:

- requiring `meta.version`
- requiring `meta.title`
- requiring `meta.route`
- rejecting `|safe`
- rejecting inline handlers
- rejecting `javascript:` URLs
- keeping action URLs relative

## Generator

```bash
cup-python scaffold page "Account Health" --route /crm/account-health --out /path/to/app
cup-python scaffold action "sync accounts" --endpoint /api/accounts/sync --success-route /crm/companies --out /path/to/app
```

The generator writes real starter-style files plus `.cup/snippets/` files for the centralized route, action, server, data, and browser edits you still need to paste in manually.

## Reference Material

- starter example: [`../../starters/python-minimal`](../../starters/python-minimal)
- workflow example: [`../../starters/python-portal`](../../starters/python-portal)
- richer authenticated shell: [`../../starters/python-crm`](../../starters/python-crm)
- generator docs: [`../../docs/generators.md`](../../docs/generators.md)
