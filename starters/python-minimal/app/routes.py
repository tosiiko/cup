from __future__ import annotations

from typing import Any

from .cup_bridge import UIView
from .views import guide_view, not_found_view, welcome_view


def resolve_view_for_route(
    session: dict[str, Any],
    route: str,
    *,
    notice: str | None = None,
    error: str | None = None,
) -> tuple[int, UIView]:
    normalized = route if route.startswith("/") else f"/{route}"

    if normalized in {"/", "/welcome"}:
        return 200, welcome_view(session, notice=notice, error=error)
    if normalized == "/guide":
        return 200, guide_view(session, notice=notice, error=error)
    return 404, not_found_view(session, normalized)
