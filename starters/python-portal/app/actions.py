from __future__ import annotations

import time
from dataclasses import dataclass

from .cup_bridge import UIView
from .data import ensure_portal_state
from .routes import resolve_view_for_route


@dataclass
class ActionResult:
    status: int
    view: UIView


def submit_request_action(session: dict[str, object], payload: dict[str, object]) -> ActionResult:
    title = str(payload.get("request_title", "")).strip()
    request_type = str(payload.get("request_type", "")).strip()
    justification = str(payload.get("justification", "")).strip()

    if not title or not request_type or not justification:
        status, view = resolve_view_for_route(
            session,
            "/portal/request",
            error="Every request needs a title, request type, and justification.",
        )
        return ActionResult(status=status, view=view)

    workflow = ensure_portal_state(session)
    workflow["counter"] += 1
    workflow["requests"].insert(
        0,
        {
            "id": f"REQ-{workflow['counter'] + 1000}",
            "title": title,
            "request_type": request_type,
            "justification": justification,
            "status": "Pending",
            "requester": session.get("display_name", "Operator"),
            "requested_at": time.strftime("%Y-%m-%d %H:%M"),
        },
    )

    status, view = resolve_view_for_route(
        session,
        "/portal/review",
        notice="Request submitted. The next review queue view was resolved on the server and remounted in the browser.",
    )
    return ActionResult(status=status, view=view)


def decide_request_action(session: dict[str, object], payload: dict[str, object]) -> ActionResult:
    decision = str(payload.get("decision", "")).strip().lower()
    request_id = str(payload.get("request_id", "")).strip()

    if decision not in {"approve", "decline"} or not request_id:
        status, view = resolve_view_for_route(
            session,
            "/portal/review",
            error="A decision and request id are required before the workflow can continue.",
        )
        return ActionResult(status=status, view=view)

    workflow = ensure_portal_state(session)
    request = next((item for item in workflow["requests"] if item["id"] == request_id), None)
    if not request:
        status, view = resolve_view_for_route(
            session,
            "/portal/review",
            error="The selected request no longer exists in the current workflow state.",
        )
        return ActionResult(status=status, view=view)

    request["status"] = "Approved" if decision == "approve" else "Declined"
    request["decision"] = f"{request['status']} by {session.get('display_name', 'Reviewer')}"
    request["reviewed_at"] = time.strftime("%Y-%m-%d %H:%M")

    status, view = resolve_view_for_route(
        session,
        "/portal/history",
        notice=f"{request_id} marked as {request['status'].lower()}. The history page reflects the server-side workflow trail.",
    )
    return ActionResult(status=status, view=view)
