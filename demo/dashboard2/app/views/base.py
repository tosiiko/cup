from __future__ import annotations

from typing import Any

from ..cup_bridge import UIView
from ..data import nav_items
from ..templates import render_shell


def shell_view(
    session: dict[str, Any],
    *,
    route: str,
    title: str,
    heading: str,
    subheading: str,
    page_name: str,
    page_state: dict[str, Any],
    notice: str | None = None,
    error: str | None = None,
) -> UIView:
    state = {
        "title": title,
        "heading": heading,
        "subheading": subheading,
        "display_name": session["display_name"],
        "role": session["role"],
        "team": session["team"],
        "region": session["region"],
        "mfa_verified": session["mfa_verified"],
        "csrf_token": session["csrf_token"],
        "notice": notice,
        "error": error,
        "nav": nav_items(route, session["permissions"]),
        **page_state,
    }
    return UIView(render_shell(page_name)).state_dict(state).title(title).route(route)


def denied_view(session: dict[str, Any], route: str) -> UIView:
    return shell_view(
        session,
        route=route,
        title="Access denied",
        heading="This workspace section is restricted",
        subheading="The server authenticated the request but blocked it with a role permission check.",
        page_name="denied",
        page_state={"requested_route": route},
        error="Your role does not include the permission required for this page or action.",
    )


def not_found_view(session: dict[str, Any], route: str) -> UIView:
    return shell_view(
        session,
        route=route,
        title="Route not found",
        heading="This CRM page does not exist",
        subheading="The server returned a controlled fallback view instead of exposing an internal error.",
        page_name="not_found",
        page_state={"requested_route": route},
        error="Unknown route requested.",
    )
