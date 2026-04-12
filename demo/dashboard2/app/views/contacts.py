from __future__ import annotations

from typing import Any

from ..data import CONTACTS, contact_signals
from .base import shell_view


def contacts_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> Any:
    return shell_view(
        session,
        route="/crm/contacts",
        title="Contacts",
        heading="Relationship map across active accounts",
        subheading="Track who matters, how warm the relationship is, and what follow-up needs to happen next.",
        page_name="contacts",
        notice=notice,
        error=error,
        page_state={
            "contacts": CONTACTS,
            "signals": contact_signals(),
        },
    )
