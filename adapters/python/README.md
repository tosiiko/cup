# cup-python

Python adapter for the CUP protocol.

## Features

- Fluent `UIView` builder
- `validate_view()` helper
- JSON response helpers for common Python web frameworks

## Example

```python
from cup import UIView, FetchAction, validate_view

view = UIView("<h1>{{ title }}</h1>").state(title="Hello")
validate_view(view)
```
