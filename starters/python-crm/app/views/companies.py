from __future__ import annotations

from typing import Any

from ..data import COMPANIES, segment_summary
from .base import shell_view


def companies_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> Any:
    return shell_view(
        session,
        route="/crm/companies",
        title="Companies",
        heading="Account health and growth context",
        subheading="A compact account view for revenue teams balancing renewals, expansion, and rescue plays.",
        page_name="companies",
        notice=notice,
        error=error,
        page_state={
            "segments": segment_summary(),
            "companies": COMPANIES,
        },
    )
