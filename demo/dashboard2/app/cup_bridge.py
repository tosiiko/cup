from __future__ import annotations

import sys

from .config import REPO_ROOT

ADAPTER_PATH = str(REPO_ROOT / "adapters" / "python")
if ADAPTER_PATH not in sys.path:
    sys.path.insert(0, ADAPTER_PATH)

from cup import UIView  # noqa: E402

__all__ = ["UIView"]
