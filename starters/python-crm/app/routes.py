from __future__ import annotations

from typing import Any

from .cup_bridge import UIView
from .data import ROUTE_PERMISSIONS
from .sessions import add_audit_event
from .views.auth import login_view
from .views.base import denied_view, not_found_view
from .views.companies import companies_view
from .views.contacts import contacts_view
from .views.overview import overview_view
from .views.pipeline import pipeline_view
from .views.security import security_view


def resolve_view_for_route(
    session: dict[str, Any],
    route: str,
    *,
    remote_addr: str,
    notice: str | None = None,
    error: str | None = None,
) -> tuple[int, UIView]:
    normalized = route if route.startswith("/") else f"/{route}"

    if normalized in {"/", "/login"} or not session.get("authenticated"):
        if session.get("authenticated") and normalized in {"/", "/login"}:
            return 200, overview_view(session, notice="Already signed in.")
        if normalized not in {"/", "/login"}:
            add_audit_event("route_redirect", session.get("username") or "", "warning", f"redirected unauthenticated route {normalized} to login", remote_addr)
        return 200, login_view(
            session,
            notice=notice or "Sign in to open the protected CRM workspace.",
            error=error,
        )

    permission = ROUTE_PERMISSIONS.get(normalized)
    permissions = session.get("permissions", [])
    if permission and permission not in permissions:
        add_audit_event("authorization", session["username"], "error", f"blocked route {normalized}", remote_addr)
        return 403, denied_view(session, normalized)

    if normalized == "/crm/overview":
        return 200, overview_view(session, notice=notice, error=error)
    if normalized == "/crm/companies":
        return 200, companies_view(session, notice=notice, error=error)
    if normalized == "/crm/contacts":
        return 200, contacts_view(session, notice=notice, error=error)
    if normalized == "/crm/pipeline":
        return 200, pipeline_view(session, notice=notice, error=error)
    if normalized == "/crm/security":
        return 200, security_view(session, notice=notice, error=error)

    add_audit_event("route_missing", session["username"], "warning", f"unknown route {normalized}", remote_addr)
    return 404, not_found_view(session, normalized)
