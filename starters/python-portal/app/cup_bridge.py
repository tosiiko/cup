from __future__ import annotations

import sys

from .config import REPO_ROOT

try:
    from cup import STARTER_VIEW_POLICY, UIView, validate_view_policy  # type: ignore # noqa: E402,F401
except ModuleNotFoundError:
    ADAPTER_PATH = str(REPO_ROOT / "adapters" / "python")
    if ADAPTER_PATH not in sys.path:
        sys.path.insert(0, ADAPTER_PATH)

    from cup import STARTER_VIEW_POLICY, UIView, validate_view_policy  # noqa: E402

__all__ = ["STARTER_VIEW_POLICY", "UIView", "validate_view_policy"]
