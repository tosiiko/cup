# cup-python

Python adapter for the CUP protocol.

## Features

- Fluent `UIView` builder
- `validate_view()` helper
- `validate_view_policy(..., STARTER_VIEW_POLICY)` for starter-safe server checks
- `cup-python scaffold page ...` and `cup-python scaffold action ...` for starter-friendly generation
- JSON response helpers for common Python web frameworks

## Example

```python
from cup import STARTER_VIEW_POLICY, FetchAction, UIView, validate_view, validate_view_policy

view = UIView("<h1>{{ title }}</h1>").state(title="Hello").title("Home").route("/")
validate_view(view)
validate_view_policy(view, STARTER_VIEW_POLICY)
```

## Generator

```bash
cup-python scaffold page "Account Health" --route /crm/account-health --out /path/to/app
cup-python scaffold action "sync accounts" --endpoint /api/accounts/sync --success-route /crm/companies --out /path/to/app
```

The generator writes real starter-style files plus `.cup/snippets/` files for the centralized route, action, server, data, and browser edits you still need to paste in manually.
