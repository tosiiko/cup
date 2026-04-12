from __future__ import annotations

from typing import Any

from .config import APP_NAME
from .cup_bridge import UIView
from .data import ensure_portal_state, history_items, nav_items, pending_requests, portal_metrics, starter_highlights
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


def request_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    workflow = ensure_portal_state(session)
    return shell_view(
        session,
        route="/portal/request",
        title="New portal request",
        heading="Collect a workflow request on the server",
        subheading="This starter shows the most common portal pattern: collect a request, route it for review, and keep the timeline authoritative on the backend.",
        page_name="request",
        notice=notice,
        error=error,
        page_state={
            "highlights": starter_highlights(),
            "metrics": portal_metrics(session),
            "draft_request_id": f"REQ-{workflow['counter'] + 1000}",
        },
    )


def review_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    return shell_view(
        session,
        route="/portal/review",
        title="Review queue",
        heading="Review the current pending requests",
        subheading="Review decisions stay simple in the browser: the form only submits the request id, decision, and CSRF token.",
        page_name="review",
        notice=notice,
        error=error,
        page_state={
            "pending_requests": pending_requests(session),
        },
    )


def history_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    return shell_view(
        session,
        route="/portal/history",
        title="Workflow history",
        heading="Inspect the completed workflow trail",
        subheading="Use the history page to confirm the server-side state transitions you just made.",
        page_name="history",
        notice=notice,
        error=error,
        page_state={
            "history_items": history_items(session),
        },
    )


def not_found_view(session: dict[str, Any], route: str) -> UIView:
    return shell_view(
        session,
        route=route,
        title="Route not found",
        heading="This portal route does not exist",
        subheading="The server returned a controlled fallback view instead of exposing a raw error.",
        page_name="history",
        error=f"Unknown route requested: {route}",
        page_state={
            "history_items": history_items(session),
        },
    )
