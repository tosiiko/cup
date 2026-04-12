from __future__ import annotations

from typing import Any

ROUTE_FALLBACKS = {
    "/api/requests": "/portal/request",
    "/api/reviews": "/portal/review",
}


def nav_items(route: str) -> list[dict[str, str | bool]]:
    items = [
        {"href": "/portal/request", "label": "Request"},
        {"href": "/portal/review", "label": "Review"},
        {"href": "/portal/history", "label": "History"},
    ]
    return [{**item, "active": item["href"] == route} for item in items]


def starter_highlights() -> list[dict[str, str]]:
    return [
        {
            "label": "Workflow state stays server-side",
            "detail": "Requests, reviewers, and timeline state live in the session-backed workflow object, not in browser-only state.",
        },
        {
            "label": "Each mutation returns the next view",
            "detail": "Submitting a request or recording a decision remounts the next protocol view instead of inventing client-side routing rules.",
        },
        {
            "label": "Security stays visible",
            "detail": "CSRF protection, signed cookies, and starter policy validation are all part of the default request loop.",
        },
    ]


def ensure_portal_state(session: dict[str, Any]) -> dict[str, Any]:
    workflow = session.setdefault(
        "workflow",
        {
            "counter": 3,
            "requests": [
                {
                    "id": "REQ-1001",
                    "title": "Branch access for Kigali launch",
                    "request_type": "Environment",
                    "justification": "Need a staging branch with finance-safe data masks before rollout week.",
                    "status": "Pending",
                    "requester": session.get("display_name", "Operator"),
                    "requested_at": "2026-04-11 09:12",
                },
                {
                    "id": "REQ-1000",
                    "title": "Approve partner onboarding checklist",
                    "request_type": "Approval",
                    "justification": "Ready for compliance review and signature routing.",
                    "status": "Approved",
                    "requester": "Taylor",
                    "requested_at": "2026-04-10 15:30",
                    "decision": "Approved by Delivery Lead",
                },
            ],
        },
    )
    return workflow


def pending_requests(session: dict[str, Any]) -> list[dict[str, Any]]:
    workflow = ensure_portal_state(session)
    return [item for item in workflow["requests"] if item["status"] == "Pending"]


def history_items(session: dict[str, Any]) -> list[dict[str, Any]]:
    workflow = ensure_portal_state(session)
    return [item for item in workflow["requests"] if item["status"] != "Pending"]


def portal_metrics(session: dict[str, Any]) -> list[dict[str, str]]:
    pending = pending_requests(session)
    history = history_items(session)
    approved = [item for item in history if item["status"] == "Approved"]
    declined = [item for item in history if item["status"] == "Declined"]
    return [
        {"label": "Pending approvals", "value": str(len(pending))},
        {"label": "Approved this cycle", "value": str(len(approved))},
        {"label": "Declined this cycle", "value": str(len(declined))},
    ]
