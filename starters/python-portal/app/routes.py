from __future__ import annotations

from typing import Any

from .cup_bridge import UIView
from .views import history_view, not_found_view, request_view, review_view


def resolve_view_for_route(
    session: dict[str, Any],
    route: str,
    *,
    notice: str | None = None,
    error: str | None = None,
) -> tuple[int, UIView]:
    normalized = route if route.startswith("/") else f"/{route}"

    if normalized in {"/", "/portal/request"}:
        return 200, request_view(session, notice=notice, error=error)
    if normalized == "/portal/review":
        return 200, review_view(session, notice=notice, error=error)
    if normalized == "/portal/history":
        return 200, history_view(session, notice=notice, error=error)
    return 404, not_found_view(session, normalized)
