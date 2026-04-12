from __future__ import annotations

from collections import defaultdict
from typing import Any

from .config import LEAD_APPROVAL_THRESHOLD, USE_SECURE_COOKIES
from .security import hash_password


def money(amount: float) -> str:
    return f"${amount:,.0f}"


DEMO_ACCOUNTS = [
    {"role": "Revenue Operations Lead", "username": "ops.lead", "password": "Orbit!2026"},
    {"role": "Account Executive", "username": "sales.rep", "password": "Pipeline!2026"},
]

LOGIN_FEATURES = [
    {"label": "Session posture", "value": "Signed cookies, idle timeout, absolute session expiry"},
    {"label": "CRM controls", "value": "Role-based routes, CSRF on every POST, audit-aware actions"},
    {"label": "Password handling", "value": "PBKDF2 hashes with generic auth failures and throttling"},
    {"label": "Template workflow", "value": "Templates live in files, views stay slim and composable"},
]

NAV_DEFINITIONS = [
    {"href": "/crm/overview", "label": "Overview", "permission": "overview:view", "badge": "Today"},
    {"href": "/crm/companies", "label": "Companies", "permission": "companies:view", "badge": ""},
    {"href": "/crm/contacts", "label": "Contacts", "permission": "contacts:view", "badge": ""},
    {"href": "/crm/pipeline", "label": "Pipeline", "permission": "pipeline:view", "badge": "Action"},
    {"href": "/crm/security", "label": "Security", "permission": "security:view", "badge": "Admin"},
]

USER_FIXTURES = {
    "ops.lead": {
        "display_name": "Amara Nanteza",
        "role": "Revenue Operations Lead",
        "region": "East Africa",
        "team": "Revenue Operations",
        "permissions": [
            "overview:view",
            "companies:view",
            "contacts:view",
            "pipeline:view",
            "pipeline:edit",
            "security:view",
            "security:manage",
        ],
        "mfa_enabled": True,
        "salt": "361537a4d0b6cde0643f22f5b0ac7c10",
        "password_hash": hash_password("Orbit!2026", "361537a4d0b6cde0643f22f5b0ac7c10"),
    },
    "sales.rep": {
        "display_name": "Jonah Kato",
        "role": "Account Executive",
        "region": "Kenya and Uganda",
        "team": "Field Sales",
        "permissions": [
            "overview:view",
            "companies:view",
            "contacts:view",
            "pipeline:view",
        ],
        "mfa_enabled": False,
        "salt": "f27ccf36f9ff5034b60a299d580847ef",
        "password_hash": hash_password("Pipeline!2026", "f27ccf36f9ff5034b60a299d580847ef"),
    },
}

ROUTE_PERMISSIONS = {
    "/crm/overview": "overview:view",
    "/crm/companies": "companies:view",
    "/crm/contacts": "contacts:view",
    "/crm/pipeline": "pipeline:view",
    "/crm/security": "security:view",
}

POST_ROUTE_FALLBACKS = {
    "/api/auth/logout": "/crm/overview",
    "/api/leads/create": "/crm/pipeline",
    "/api/security/rotate-session": "/crm/security",
    "/api/security/terminate-others": "/crm/security",
}

PIPELINE_STAGES = [
    {"key": "Discovery", "label": "Discovery", "hint": "New demand and qualification"},
    {"key": "Qualified", "label": "Qualified", "hint": "Scoped with buyer alignment"},
    {"key": "Proposal", "label": "Proposal", "hint": "Commercial review in motion"},
    {"key": "Commit", "label": "Commit", "hint": "Late-stage close plan"},
]

COMPANIES = [
    {
        "name": "Kijani Freight",
        "segment": "Logistics",
        "owner": "Jonah Kato",
        "arr": money(420_000),
        "health": "Growing",
        "health_class": "status-pill status-pill--ok",
        "next_step": "Renewal workshop on Apr 18",
    },
    {
        "name": "Mara Health Systems",
        "segment": "Healthcare",
        "owner": "Amara Nanteza",
        "arr": money(615_000),
        "health": "At risk",
        "health_class": "status-pill status-pill--risk",
        "next_step": "Executive check-in requested",
    },
    {
        "name": "Lakefront Retail Group",
        "segment": "Retail",
        "owner": "Jonah Kato",
        "arr": money(280_000),
        "health": "Monitoring",
        "health_class": "status-pill status-pill--warn",
        "next_step": "Champion change in progress",
    },
    {
        "name": "Orbit Learning Labs",
        "segment": "Education",
        "owner": "Amara Nanteza",
        "arr": money(190_000),
        "health": "Healthy",
        "health_class": "status-pill status-pill--ok",
        "next_step": "Case study follow-up",
    },
]

CONTACTS = [
    {
        "name": "Grace Ayo",
        "title": "VP Operations",
        "company": "Kijani Freight",
        "temperature": "Warm",
        "temperature_class": "status-pill status-pill--ok",
        "last_touch": "2 hours ago",
        "next_step": "Share rollout timeline",
    },
    {
        "name": "Peter Lule",
        "title": "CFO",
        "company": "Mara Health Systems",
        "temperature": "Cold",
        "temperature_class": "status-pill status-pill--risk",
        "last_touch": "6 days ago",
        "next_step": "Recover sponsor confidence",
    },
    {
        "name": "Amina Noor",
        "title": "Head of CX",
        "company": "Lakefront Retail Group",
        "temperature": "Watching",
        "temperature_class": "status-pill status-pill--warn",
        "last_touch": "Yesterday",
        "next_step": "Map post-merger stakeholders",
    },
    {
        "name": "Micah Otim",
        "title": "IT Director",
        "company": "Orbit Learning Labs",
        "temperature": "Warm",
        "temperature_class": "status-pill status-pill--ok",
        "last_touch": "Today",
        "next_step": "Confirm pilot success criteria",
    },
]

PIPELINE_DEALS = [
    {
        "id": "OP-3201",
        "title": "Expansion rollout",
        "company": "Kijani Freight",
        "owner": "Jonah Kato",
        "value": money(180_000),
        "value_raw": 180_000.0,
        "stage": "Discovery",
        "close_date": "May 14",
        "health": "Clean",
        "health_class": "status-pill status-pill--ok",
    },
    {
        "id": "OP-3202",
        "title": "Regional renewal",
        "company": "Lakefront Retail Group",
        "owner": "Jonah Kato",
        "value": money(340_000),
        "value_raw": 340_000.0,
        "stage": "Qualified",
        "close_date": "May 28",
        "health": "Risk flagged",
        "health_class": "status-pill status-pill--warn",
    },
    {
        "id": "OP-3203",
        "title": "Platform consolidation",
        "company": "Mara Health Systems",
        "owner": "Amara Nanteza",
        "value": money(590_000),
        "value_raw": 590_000.0,
        "stage": "Proposal",
        "close_date": "Jun 03",
        "health": "Executive attention",
        "health_class": "status-pill status-pill--risk",
    },
    {
        "id": "OP-3204",
        "title": "Campus pilot expansion",
        "company": "Orbit Learning Labs",
        "owner": "Amara Nanteza",
        "value": money(125_000),
        "value_raw": 125_000.0,
        "stage": "Commit",
        "close_date": "Apr 29",
        "health": "Clean",
        "health_class": "status-pill status-pill--ok",
    },
]

LEAD_INTAKE_LOG: list[dict[str, Any]] = [
    {
        "id": "OP-3210",
        "title": "Regional service desk refresh",
        "company": "Northwind Cargo",
        "owner": "Amara Nanteza",
        "value": money(210_000),
        "value_raw": 210_000.0,
        "stage": "Qualified",
        "close_date": "May 20",
        "health": "New",
        "health_class": "status-pill status-pill--ok",
        "note": "Created from inbound referral",
    }
]


def nav_items(current_route: str, permissions: list[str]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for item in NAV_DEFINITIONS:
        allowed = item["permission"] in permissions
        items.append({**item, "allowed": allowed, "active": current_route == item["href"]})
    return items


def overview_metrics() -> list[dict[str, str]]:
    return [
        {"label": "Active pipeline", "value": money(3_860_000), "meta": "+12% week over week", "meta_class": "positive"},
        {"label": "Renewals this month", "value": "18", "meta": "14 healthy, 4 need exec support", "meta_class": "warning"},
        {"label": "Next-best actions", "value": "12", "meta": "playbooks due by end of day", "meta_class": "positive"},
        {"label": "Forecast confidence", "value": "84%", "meta": "one proposal still high-risk", "meta_class": "warning"},
    ]


def focus_accounts() -> list[dict[str, str]]:
    return [
        {"name": "Mara Health Systems", "owner": "Amara Nanteza", "value": "Multithread with CFO and COO", "status": "At risk", "status_class": "status-pill status-pill--risk"},
        {"name": "Lakefront Retail Group", "owner": "Jonah Kato", "value": "Stabilize after champion change", "status": "Monitor", "status_class": "status-pill status-pill--warn"},
        {"name": "Kijani Freight", "owner": "Jonah Kato", "value": "Upsell analytics package", "status": "Healthy", "status_class": "status-pill status-pill--ok"},
    ]


def playbook_queue() -> list[dict[str, str]]:
    return [
        {"title": "Executive rescue plan", "detail": "Mara Health Systems needs a sponsor-level recovery sequence.", "status": "Urgent", "status_class": "status-pill status-pill--risk"},
        {"title": "Champion mapping", "detail": "Lakefront Retail Group added two new procurement stakeholders.", "status": "Open", "status_class": "status-pill status-pill--warn"},
        {"title": "Reference request", "detail": "Orbit Learning Labs is ready for a peer customer story.", "status": "Ready", "status_class": "status-pill status-pill--ok"},
    ]


def segment_summary() -> list[dict[str, str]]:
    return [
        {"segment": "Logistics", "accounts": "14 accounts", "trend": "+9% expansion"},
        {"segment": "Healthcare", "accounts": "08 accounts", "trend": "Renewal risk elevated"},
        {"segment": "Retail", "accounts": "11 accounts", "trend": "Champion churn up"},
        {"segment": "Education", "accounts": "07 accounts", "trend": "Pilot motion healthy"},
    ]


def contact_signals() -> list[dict[str, str]]:
    return [
        {"label": "Mutual champion access", "value": "7 accounts have a new internal advocate"},
        {"label": "Decision latency", "value": "3 late-stage deals slipped by more than 5 days"},
        {"label": "Relationship health", "value": "71% of priority contacts touched in the last week"},
    ]


def pipeline_board() -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for deal in [*LEAD_INTAKE_LOG, *PIPELINE_DEALS]:
        grouped[deal["stage"]].append(deal)

    columns: list[dict[str, Any]] = []
    for column in PIPELINE_STAGES:
        stage_deals = grouped.get(column["key"], [])
        total = sum(float(deal.get("value_raw", 0.0)) for deal in stage_deals)
        columns.append(
            {
                "label": column["label"],
                "hint": column["hint"],
                "count": f"{len(stage_deals):02d}",
                "total": money(total),
                "deals": stage_deals,
                "empty": not stage_deals,
            }
        )
    return columns


def recent_leads() -> list[dict[str, Any]]:
    return LEAD_INTAKE_LOG[:6]


def lead_stage_options() -> list[str]:
    return [stage["key"] for stage in PIPELINE_STAGES]


def security_controls() -> list[dict[str, str]]:
    secure_cookie_status = "Enabled when CUP_CRM_SECURE_COOKIES=1" if not USE_SECURE_COOKIES else "Enabled"
    return [
        {"label": "Cookie policy", "value": "HttpOnly, SameSite=Lax, signed session IDs"},
        {"label": "Secure cookie mode", "value": secure_cookie_status},
        {"label": "Lead approval gate", "value": f"New opportunities above {money(LEAD_APPROVAL_THRESHOLD)} are blocked in this demo"},
        {"label": "Cache posture", "value": "HTML and JSON responses send no-store headers"},
    ]
