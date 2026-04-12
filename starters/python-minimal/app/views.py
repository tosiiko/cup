from __future__ import annotations

from typing import Any

from .config import APP_NAME
from .cup_bridge import UIView
from .data import FEATURES, GUIDE_FILES, QUICKSTART_STEPS, nav_items
from .templates import render_shell


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
        "app_name": APP_NAME,
        "title": title,
        "heading": heading,
        "subheading": subheading,
        "display_name": session["display_name"],
        "csrf_token": session["csrf_token"],
        "nav": nav_items(route),
        "notice": notice,
        "error": error,
        **page_state,
    }
    return UIView(render_shell(page_name)).state_dict(state).title(title).route(route)


def welcome_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    return shell_view(
        session,
        route="/",
        title=APP_NAME,
        heading="Backend-first UI with a tiny surface area",
        subheading="Use this starter when you want the real CUP boundaries without the weight of a large starter app.",
        page_name="welcome",
        notice=notice,
        error=error,
        page_state={
            "features": FEATURES,
            "steps": QUICKSTART_STEPS,
        },
    )


def guide_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    return shell_view(
        session,
        route="/guide",
        title="Starter guide",
        heading="Where to edit first",
        subheading="These are the files to touch when you start replacing the scaffold with your real product logic.",
        page_name="guide",
        notice=notice,
        error=error,
        page_state={
            "files": GUIDE_FILES,
        },
    )


def not_found_view(session: dict[str, Any], route: str) -> UIView:
    return shell_view(
        session,
        route=route,
        title="Route not found",
        heading="This starter route does not exist",
        subheading="The server returned a controlled fallback view instead of exposing a raw error.",
        page_name="guide",
        error=f"Unknown route requested: {route}",
        page_state={
            "files": GUIDE_FILES,
        },
    )
