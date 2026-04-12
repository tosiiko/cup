from __future__ import annotations

from typing import Any

from ..data import focus_accounts, overview_metrics, playbook_queue
from ..sessions import AUDIT_EVENTS, iso_stamp
from .base import shell_view


def overview_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> Any:
    activity = AUDIT_EVENTS[:6] if AUDIT_EVENTS else [
        {
            "timestamp": iso_stamp(),
            "event": "workspace",
            "username": session["username"],
            "outcome": "success",
            "detail": "CRM workspace opened and ready for action",
            "outcome_class": "event-pill event-pill--ok",
        }
    ]
    return shell_view(
        session,
        route="/crm/overview",
        title="CRM Overview",
        heading="Revenue focus for today",
        subheading="The CRM home surface for pipeline health, renewals, and guided next actions.",
        page_name="overview",
        notice=notice,
        error=error,
        page_state={
            "metrics": overview_metrics(),
            "accounts": focus_accounts(),
            "playbooks": playbook_queue(),
            "activity": activity,
        },
    )
