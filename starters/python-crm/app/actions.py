from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from .config import LEAD_APPROVAL_THRESHOLD
from .cup_bridge import UIView
from .data import LEAD_INTAKE_LOG, PIPELINE_STAGES, USER_FIXTURES, money
from .security import verify_password
from .sessions import (
    add_audit_event,
    create_session,
    destroy_session,
    is_rate_limited,
    record_failed_login,
    reset_failed_logins,
)
from .views.auth import login_view
from .views.base import denied_view
from .views.overview import overview_view
from .views.pipeline import pipeline_view
from .views.security import security_view


@dataclass
class ActionResult:
    status: int
    view: UIView
    session_id: str | None = None


def login_action(
    session_id: str,
    session: dict[str, Any],
    payload: dict[str, Any],
    *,
    remote_addr: str,
    user_agent: str,
) -> ActionResult:
    time.sleep(0.2)

    if is_rate_limited(remote_addr):
        add_audit_event("login", "", "error", "rate limit triggered", remote_addr)
        return ActionResult(
            status=429,
            view=login_view(
                session,
                error="Too many login attempts. Wait a few minutes before trying again.",
                username=str(payload.get("username", "")),
            ),
        )

    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    user_record = USER_FIXTURES.get(username)

    if not user_record or not verify_password(password, user_record):
        remaining = record_failed_login(remote_addr)
        add_audit_event("login", username, "error", "invalid credentials", remote_addr)
        return ActionResult(
            status=401,
            view=login_view(
                session,
                error="Incorrect username or password.",
                notice=f"{remaining} attempts remaining before temporary lockout." if remaining > 0 else None,
                username=username,
            ),
        )

    reset_failed_logins(remote_addr)
    destroy_session(session_id)
    new_session_id, new_session = create_session(
        authenticated=True,
        username=username,
        remote_addr=remote_addr,
        user_agent=user_agent,
    )
    new_session["session_id"] = new_session_id
    add_audit_event("login", username, "success", "authenticated into CRM workspace", remote_addr)
    return ActionResult(
        status=200,
        view=overview_view(new_session, notice="Authentication successful. CRM workspace opened."),
        session_id=new_session_id,
    )


def logout_action(session_id: str, session: dict[str, Any], *, remote_addr: str, user_agent: str) -> ActionResult:
    username = session.get("username") or ""
    destroy_session(session_id)
    new_session_id, anonymous_session = create_session(remote_addr=remote_addr, user_agent=user_agent)
    anonymous_session["session_id"] = new_session_id
    add_audit_event("logout", username, "success", "session closed", remote_addr)
    return ActionResult(
        status=200,
        view=login_view(anonymous_session, notice="You have been signed out safely."),
        session_id=new_session_id,
    )


def create_lead_action(session: dict[str, Any], payload: dict[str, Any], *, remote_addr: str) -> ActionResult:
    if "pipeline:edit" not in session.get("permissions", []):
        add_audit_event("lead_create", session.get("username", ""), "error", "blocked unauthorized lead creation", remote_addr)
        return ActionResult(status=403, view=denied_view(session, "/crm/pipeline"))

    company = str(payload.get("company", "")).strip()
    contact = str(payload.get("contact", "")).strip()
    owner = str(payload.get("owner", "")).strip()
    stage = str(payload.get("stage", "")).strip()
    note = str(payload.get("note", "")).strip()
    try:
        amount = float(str(payload.get("value", "0")).replace(",", ""))
    except ValueError:
        amount = -1

    stage_keys = {column["key"] for column in PIPELINE_STAGES}
    if not company or not contact or not owner or not stage:
        return ActionResult(status=200, view=pipeline_view(session, error="Company, contact, owner, and stage are required."))
    if stage not in stage_keys:
        return ActionResult(status=200, view=pipeline_view(session, error="Choose a valid stage for the opportunity."))
    if amount <= 0:
        return ActionResult(status=200, view=pipeline_view(session, error="Opportunity value must be a positive number."))
    if amount > LEAD_APPROVAL_THRESHOLD:
        add_audit_event("lead_create", session["username"], "warning", f"blocked oversized opportunity {money(amount)} for {company}", remote_addr)
        return ActionResult(
            status=200,
            view=pipeline_view(
                session,
                error=f"This demo blocks opportunities above {money(LEAD_APPROVAL_THRESHOLD)} until executive approval is complete.",
            ),
        )

    lead = {
        "id": f"OP-{int(time.time()) % 100000:05d}",
        "title": f"{company} growth motion",
        "company": company,
        "owner": owner,
        "contact": contact,
        "value": money(amount),
        "value_raw": amount,
        "stage": stage,
        "close_date": "Needs close plan",
        "health": "New",
        "health_class": "status-pill status-pill--ok",
        "note": note or f"Primary contact: {contact}",
    }
    LEAD_INTAKE_LOG.insert(0, lead)
    del LEAD_INTAKE_LOG[10:]
    add_audit_event("lead_create", session["username"], "success", f"created new opportunity for {company}", remote_addr)
    return ActionResult(status=200, view=pipeline_view(session, notice="Opportunity created and added to the pipeline board."))


def rotate_session_action(
    session_id: str,
    session: dict[str, Any],
    *,
    remote_addr: str,
    user_agent: str,
) -> ActionResult:
    if "security:manage" not in session.get("permissions", []):
        return ActionResult(status=403, view=denied_view(session, "/crm/security"))

    username = session["username"]
    destroy_session(session_id)
    new_session_id, new_session = create_session(
        authenticated=True,
        username=username,
        remote_addr=remote_addr,
        user_agent=user_agent,
    )
    new_session["session_id"] = new_session_id
    add_audit_event("session_rotation", username, "success", "rotated session and CSRF token", remote_addr)
    return ActionResult(
        status=200,
        view=security_view(new_session, notice="Session and CSRF token rotated successfully."),
        session_id=new_session_id,
    )


def terminate_other_sessions_action(session_id: str, session: dict[str, Any], *, remote_addr: str) -> ActionResult:
    if "security:manage" not in session.get("permissions", []):
        return ActionResult(status=403, view=denied_view(session, "/crm/security"))

    username = session["username"]
    from .sessions import SESSIONS  # Imported lazily to keep module boundaries small.

    for candidate_id, candidate in list(SESSIONS.items()):
        if candidate_id == session_id:
            continue
        if candidate.get("username") == username:
            destroy_session(candidate_id)

    add_audit_event("session_terminate", username, "success", "terminated other sessions for user", remote_addr)
    return ActionResult(status=200, view=security_view(session, notice="Other active sessions were terminated."))
