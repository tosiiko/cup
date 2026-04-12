from __future__ import annotations

from typing import Any

from ..data import security_controls
from ..sessions import AUDIT_EVENTS, iso_stamp, sessions_for_user
from .base import shell_view


def security_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> Any:
    return shell_view(
        session,
        route="/crm/security",
        title="Security Center",
        heading="Identity, sessions, and audit posture",
        subheading="The CRM security page shows how a structured CUP app can keep auth and session logic separate from templates.",
        page_name="security",
        notice=notice,
        error=error,
        page_state={
            "session_created": iso_stamp(session["created_at"]),
            "last_seen": iso_stamp(session["last_seen"]),
            "session_id_short": session["session_id"][-8:],
            "controls": security_controls(),
            "user_sessions": sessions_for_user(session["username"], current_session_id=session["session_id"]),
            "audit_events": AUDIT_EVENTS[:12],
        },
    )
