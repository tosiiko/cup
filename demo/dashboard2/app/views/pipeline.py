from __future__ import annotations

from typing import Any

from ..config import LEAD_APPROVAL_THRESHOLD
from ..data import lead_stage_options, money, pipeline_board, recent_leads
from .base import shell_view


def pipeline_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> Any:
    return shell_view(
        session,
        route="/crm/pipeline",
        title="Pipeline",
        heading="Opportunity execution board",
        subheading="Create new opportunities, inspect stage load, and keep the forecast honest.",
        page_name="pipeline",
        notice=notice,
        error=error,
        page_state={
            "columns": pipeline_board(),
            "recent_leads": recent_leads(),
            "stage_options": lead_stage_options(),
            "approval_threshold": money(LEAD_APPROVAL_THRESHOLD),
        },
    )
