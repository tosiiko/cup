from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
from collections import defaultdict
from http import cookies
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "adapters" / "python"))

from cup import UIView  # noqa: E402

HOST = "127.0.0.1"
PORT = 8020
SESSION_COOKIE = "cup_dashboard_session"
SESSION_IDLE_SECONDS = 15 * 60
SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60
LOGIN_WINDOW_SECONDS = 10 * 60
LOGIN_MAX_ATTEMPTS = 5
PBKDF2_ITERATIONS = 310_000
SESSION_SECRET = (os.environ.get("CUP_DASHBOARD_SECRET") or secrets.token_hex(32)).encode("utf-8")
USE_SECURE_COOKIES = os.environ.get("CUP_DASHBOARD_SECURE_COOKIES") == "1"

INDEX_FILE = ROOT / "demo" / "dashboard" / "index.html"
APP_JS_FILE = ROOT / "demo" / "dashboard" / "app.js"
APP_CSS_FILE = ROOT / "demo" / "dashboard" / "app.css"
DIST_DIR = ROOT / "dist"

SESSIONS: dict[str, dict[str, Any]] = {}
FAILED_LOGINS: dict[str, list[float]] = defaultdict(list)
AUDIT_EVENTS: list[dict[str, str]] = []

USER_FIXTURES = {
    "treasury.demo": {
        "display_name": "Nadia Okello",
        "role": "Treasury Administrator",
        "team": "Treasury Operations",
        "permissions": [
            "overview:view",
            "accounts:view",
            "transactions:view",
            "payments:view",
            "payments:submit",
            "security:view",
            "security:manage",
        ],
        "salt": "31efc7430ca5eed0c2e38562a9f76791",
        "password_hash": "0bcf1444e06fed29521aebd089504b7939ea5c20a13c47d1c3db72add41abbf5",
        "mfa_enabled": True,
    },
    "analyst.demo": {
        "display_name": "Samuel Achieng",
        "role": "Financial Analyst",
        "team": "Corporate Finance",
        "permissions": [
            "overview:view",
            "accounts:view",
            "transactions:view",
        ],
        "salt": "1032083d3c09ae05360effd2b993285e",
        "password_hash": "c285538635065cf9be68171e64636d7f44d9afd0a6cf6001ea227bd3e0f402f2",
        "mfa_enabled": False,
    },
}

ROUTE_PERMISSIONS = {
    "/dashboard/overview": "overview:view",
    "/dashboard/accounts": "accounts:view",
    "/dashboard/transactions": "transactions:view",
    "/dashboard/payments": "payments:view",
    "/dashboard/security": "security:view",
}

POST_ROUTE_FALLBACKS = {
    "/api/auth/logout": "/dashboard/overview",
    "/api/payments/create": "/dashboard/payments",
    "/api/security/rotate-session": "/dashboard/security",
    "/api/security/terminate-others": "/dashboard/security",
}


def now_ts() -> float:
    return time.time()


def iso_stamp(ts: float | None = None) -> str:
    stamp = time.localtime(ts or now_ts())
    return time.strftime("%Y-%m-%d %H:%M:%S", stamp)


def digest_password(password: str, salt_hex: str) -> str:
    salt = bytes.fromhex(salt_hex)
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS).hex()


def verify_password(password: str, user_record: dict[str, Any]) -> bool:
    expected = user_record["password_hash"]
    candidate = digest_password(password, user_record["salt"])
    return hmac.compare_digest(candidate, expected)


def new_csrf_token() -> str:
    return secrets.token_urlsafe(24)


def session_signature(session_id: str) -> str:
    return hmac.new(SESSION_SECRET, session_id.encode("utf-8"), hashlib.sha256).hexdigest()


def make_cookie_value(session_id: str) -> str:
    return f"{session_id}.{session_signature(session_id)}"


def verify_cookie_value(raw: str) -> str | None:
    if "." not in raw:
        return None
    session_id, signature = raw.split(".", 1)
    if not hmac.compare_digest(signature, session_signature(session_id)):
        return None
    return session_id


def create_session(*, authenticated: bool = False, username: str | None = None, remote_addr: str = "", user_agent: str = "") -> tuple[str, dict[str, Any]]:
    session_id = secrets.token_urlsafe(24)
    created_at = now_ts()
    session: dict[str, Any] = {
        "authenticated": authenticated,
        "username": username,
        "csrf_token": new_csrf_token(),
        "created_at": created_at,
        "last_seen": created_at,
        "remote_addr": remote_addr,
        "user_agent": user_agent[:120],
        "mfa_verified": False,
    }
    if authenticated and username:
        profile = USER_FIXTURES[username]
        session["display_name"] = profile["display_name"]
        session["role"] = profile["role"]
        session["team"] = profile["team"]
        session["permissions"] = list(profile["permissions"])
        session["mfa_verified"] = bool(profile["mfa_enabled"])
    SESSIONS[session_id] = session
    return session_id, session


def destroy_session(session_id: str | None) -> None:
    if session_id:
        SESSIONS.pop(session_id, None)


def prune_attempts(remote_addr: str) -> None:
    cutoff = now_ts() - LOGIN_WINDOW_SECONDS
    FAILED_LOGINS[remote_addr] = [stamp for stamp in FAILED_LOGINS[remote_addr] if stamp >= cutoff]


def record_failed_login(remote_addr: str) -> int:
    prune_attempts(remote_addr)
    FAILED_LOGINS[remote_addr].append(now_ts())
    return max(0, LOGIN_MAX_ATTEMPTS - len(FAILED_LOGINS[remote_addr]))


def reset_failed_logins(remote_addr: str) -> None:
    FAILED_LOGINS.pop(remote_addr, None)


def is_rate_limited(remote_addr: str) -> bool:
    prune_attempts(remote_addr)
    return len(FAILED_LOGINS[remote_addr]) >= LOGIN_MAX_ATTEMPTS


def add_audit_event(event_type: str, username: str, outcome: str, detail: str, remote_addr: str) -> None:
    AUDIT_EVENTS.insert(
        0,
        {
            "timestamp": iso_stamp(),
            "event": event_type,
            "username": username or "anonymous",
            "outcome": outcome,
            "detail": detail,
            "remote_addr": remote_addr or "unknown",
            "outcome_class": {
                "success": "event-pill event-pill--ok",
                "warning": "event-pill event-pill--warn",
                "error": "event-pill event-pill--risk",
            }.get(outcome, "event-pill"),
        },
    )
    del AUDIT_EVENTS[40:]


def money(amount: float) -> str:
    return f"${amount:,.2f}"


def nav_items(current_route: str, permissions: list[str]) -> list[dict[str, Any]]:
    items = [
        {"href": "/dashboard/overview", "label": "Overview", "permission": "overview:view", "badge": "Core"},
        {"href": "/dashboard/accounts", "label": "Accounts", "permission": "accounts:view", "badge": ""},
        {"href": "/dashboard/transactions", "label": "Transactions", "permission": "transactions:view", "badge": ""},
        {"href": "/dashboard/payments", "label": "Payments", "permission": "payments:view", "badge": "Privileged"},
        {"href": "/dashboard/security", "label": "Security", "permission": "security:view", "badge": "Admin"},
    ]
    result: list[dict[str, Any]] = []
    for item in items:
        allowed = item["permission"] in permissions
        result.append(
            {
                **item,
                "allowed": allowed,
                "active": current_route == item["href"],
            }
        )
    return result


def account_data() -> list[dict[str, str]]:
    return [
        {
            "name": "Operating USD",
            "account_no": "1100-USD-OPER",
            "available": money(1_248_420.13),
            "ledger": money(1_260_004.67),
            "currency": "USD",
            "status": "Healthy",
            "status_class": "status-pill status-pill--ok",
        },
        {
            "name": "Collections East Africa",
            "account_no": "2200-EA-COLL",
            "available": money(418_990.52),
            "ledger": money(421_113.91),
            "currency": "KES",
            "status": "Review",
            "status_class": "status-pill status-pill--warn",
        },
        {
            "name": "Client Trust Reserve",
            "account_no": "3300-TRUST-RES",
            "available": money(2_880_112.80),
            "ledger": money(2_880_112.80),
            "currency": "USD",
            "status": "Restricted",
            "status_class": "status-pill status-pill--risk",
        },
    ]


def transaction_data() -> list[dict[str, str]]:
    return [
        {
            "id": "TX-20411",
            "date": "2026-04-12 08:15",
            "counterparty": "Acacia Energy",
            "account": "Operating USD",
            "amount": money(84_240.00),
            "direction": "Outgoing",
            "direction_class": "negative",
            "status": "Settled",
            "status_class": "status-pill status-pill--ok",
            "risk": "Low",
            "risk_class": "status-pill status-pill--ok",
        },
        {
            "id": "TX-20407",
            "date": "2026-04-12 07:42",
            "counterparty": "Nile Telecom",
            "account": "Collections East Africa",
            "amount": money(18_920.55),
            "direction": "Incoming",
            "direction_class": "positive",
            "status": "Monitoring",
            "status_class": "status-pill status-pill--warn",
            "risk": "Medium",
            "risk_class": "status-pill status-pill--warn",
        },
        {
            "id": "TX-20396",
            "date": "2026-04-11 18:01",
            "counterparty": "Zahara Capital",
            "account": "Client Trust Reserve",
            "amount": money(250_000.00),
            "direction": "Outgoing",
            "direction_class": "negative",
            "status": "Held",
            "status_class": "status-pill status-pill--risk",
            "risk": "High",
            "risk_class": "status-pill status-pill--risk",
        },
    ]


TRANSFER_LOG: list[dict[str, str]] = [
    {
        "beneficiary": "Acacia Energy",
        "account": "Operating USD",
        "amount": money(84_240.00),
        "status": "Settled",
        "status_class": "status-pill status-pill--ok",
        "submitted_by": "Nadia Okello",
        "submitted_at": "2026-04-12 08:15",
    },
    {
        "beneficiary": "Zahara Capital",
        "account": "Client Trust Reserve",
        "amount": money(250_000.00),
        "status": "Held for review",
        "status_class": "status-pill status-pill--risk",
        "submitted_by": "Samuel Achieng",
        "submitted_at": "2026-04-11 18:01",
    },
]


def build_login_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None, username: str = "") -> UIView:
    template = """
    <div class="auth-layout">
      <section class="auth-hero">
        <div class="stack">
          <div class="brand">
            <div class="brand-mark">C</div>
            <span>CUP Treasury Console</span>
          </div>

          <div class="auth-copy">
            <h1>Financial operations, served as secure protocol views.</h1>
            <p>
              This Python demo shows CUP driving a treasury dashboard with sessions, CSRF,
              security headers, authorization, and audit-aware page flows.
            </p>
          </div>
        </div>

        <div class="feature-grid">
          {% for feature in features %}
            <div class="feature-card">
              <strong>{{ feature.label }}</strong>
              <p>{{ feature.value }}</p>
            </div>
          {% endfor %}
        </div>

        <div class="demo-users">
          {% for account in demo_accounts %}
            <div class="demo-card">
              <strong>{{ account.role }}</strong>
              <p>{{ account.username }}</p>
              <p class="muted">{{ account.password }}</p>
            </div>
          {% endfor %}
        </div>
      </section>

      <section class="auth-panel">
        <div class="panel login-card">
          <div class="section-title">Secure Sign-In</div>
          <h2>Authenticate into the treasury workspace</h2>
          <p>Use one of the demo users to unlock the protected finance pages.</p>

          {% if notice %}
            <div class="banner banner--success">{{ notice }}</div>
          {% endif %}
          {% if error %}
            <div class="banner banner--error">{{ error }}</div>
          {% endif %}

          <form class="stack" data-form-kind="login" data-pending-label="Verifying...">
            <input type="hidden" name="csrf_token" value="{{ csrf_token }}" />

            <div class="field-grid">
              <div class="field">
                <label for="username">Username</label>
                <input class="input" id="username" name="username" autocomplete="username" value="{{ username }}" />
              </div>
              <div class="field">
                <label for="password">Password</label>
                <input class="input" id="password" name="password" type="password" autocomplete="current-password" />
              </div>
            </div>

            <button class="button" type="submit">Sign in</button>
            <p class="helper">Security controls active: CSRF, signed cookies, rate limiting, no-store responses, and route authorization.</p>
          </form>
        </div>
      </section>
    </div>
    """

    return (
        UIView(template)
        .state(
            csrf_token=session["csrf_token"],
            username=username,
            notice=notice,
            error=error,
            features=[
                {"label": "Session policy", "value": "15 min idle timeout, 8 hr absolute lifetime"},
                {"label": "Credential handling", "value": "PBKDF2 password hashing and generic auth errors"},
                {"label": "Request safety", "value": "Strict CSP, CSRF validation, and signed cookies"},
                {"label": "Role controls", "value": "Read-only analyst vs treasury admin permissions"},
            ],
            demo_accounts=[
                {"role": "Treasury Administrator", "username": "treasury.demo", "password": "Vault!2026"},
                {"role": "Financial Analyst", "username": "analyst.demo", "password": "Ledger!2026"},
            ],
        )
        .title("CUP Treasury Console — Login")
        .route("/login")
    )


def shell_view(
    session: dict[str, Any],
    *,
    route: str,
    title: str,
    heading: str,
    subheading: str,
    content_template: str,
    page_state: dict[str, Any],
    notice: str | None = None,
    error: str | None = None,
) -> UIView:
    template = (
        """
    <div class="dashboard-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">C</div>
          <span>CUP Treasury</span>
        </div>

        <nav class="sidebar-nav">
          {% for item in nav %}
            {% if item.allowed %}
              <a href="{{ item.href }}" data-link class="{% if item.active %}nav-link nav-link--active{% else %}nav-link{% endif %}">
                <span>{{ item.label }}</span>
                {% if item.badge %}<span class="nav-pill">{{ item.badge }}</span>{% endif %}
              </a>
            {% else %}
              <div class="nav-link-locked">
                <span>{{ item.label }}</span>
                <span class="muted">Locked</span>
              </div>
            {% endif %}
          {% endfor %}
        </nav>

        <div class="sidebar-card">
          <div class="section-title">Authenticated Session</div>
          <p>{{ display_name }} • {{ role }}</p>
          <p class="helper">Team: {{ team }}</p>
          <p class="helper">MFA verified: {% if mfa_verified %}Yes{% else %}No{% endif %}</p>
        </div>
      </aside>

      <main class="main">
        <section class="topbar">
          <div class="topbar-copy">
            <div class="section-title">{{ title }}</div>
            <h1>{{ heading }}</h1>
            <p>{{ subheading }}</p>
          </div>

          <div class="topbar-meta">
            <div class="summary-card">
              <div class="section-title">Signed in as</div>
              <h2>{{ display_name }}</h2>
              <p>{{ role }}</p>
            </div>

            <form data-form-kind="logout" data-pending-label="Signing out..." class="actions">
              <input type="hidden" name="csrf_token" value="{{ csrf_token }}" />
              <button class="button-ghost" type="submit">Sign out</button>
            </form>
          </div>
        </section>
        """
        + """
        {% if notice %}
          <div class="banner banner--success">{{ notice }}</div>
        {% endif %}
        {% if error %}
          <div class="banner banner--error">{{ error }}</div>
        {% endif %}
        """
        + content_template
        + """
      </main>
    </div>
    """
    )

    state = {
        "title": title,
        "heading": heading,
        "subheading": subheading,
        "display_name": session["display_name"],
        "role": session["role"],
        "team": session["team"],
        "mfa_verified": session["mfa_verified"],
        "csrf_token": session["csrf_token"],
        "notice": notice,
        "error": error,
        "nav": nav_items(route, session["permissions"]),
        **page_state,
    }

    return UIView(template).state_dict(state).title(title).route(route)


def overview_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    content = """
    <section class="grid grid-metrics">
      {% for metric in metrics %}
        <div class="metric-card">
          <div class="section-title">{{ metric.label }}</div>
          <div class="metric-value">{{ metric.value }}</div>
          <p class="{{ metric.meta_class }}">{{ metric.meta }}</p>
        </div>
      {% endfor %}
    </section>

    <section class="grid grid-split">
      <div class="table-card">
        <div class="section-title">Priority Alerts</div>
        <div class="list">
          {% for alert in alerts %}
            <div class="list-item">
              <div>
                <div class="amount">{{ alert.title }}</div>
                <div class="table-note">{{ alert.message }}</div>
              </div>
              <span class="{{ alert.status_class }}">{{ alert.status }}</span>
            </div>
          {% endfor %}
        </div>
      </div>

      <div class="summary-card">
        <div class="section-title">Control Posture</div>
        <h2>Security baseline active</h2>
        <p>All privileged views require a signed session, CSRF token, and server-side permission check before data loads.</p>
      </div>
    </section>

    <section class="grid grid-split">
      <div class="table-card">
        <div class="section-title">Liquidity Watchlist</div>
        <table class="table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>Exposure</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {% for row in watchlist %}
              <tr>
                <td>
                  <div class="amount">{{ row.name }}</div>
                  <div class="table-note">{{ row.note }}</div>
                </td>
                <td>{{ row.exposure }}</td>
                <td><span class="{{ row.status_class }}">{{ row.status }}</span></td>
              </tr>
            {% endfor %}
          </tbody>
        </table>
      </div>

      <div class="table-card">
        <div class="section-title">Recent Activity</div>
        <div class="list">
          {% for item in activity %}
            <div class="list-item">
              <div>
                <div class="amount">{{ item.title }}</div>
                <div class="table-note">{{ item.time }}</div>
              </div>
              <span class="{{ item.outcome_class }}">{{ item.outcome }}</span>
            </div>
          {% endfor %}
        </div>
      </div>
    </section>
    """

    return shell_view(
        session,
        route="/dashboard/overview",
        title="Treasury Overview",
        heading="Live financial posture",
        subheading="Critical balances, alerts, and controls across the operating environment.",
        content_template=content,
        notice=notice,
        error=error,
        page_state={
            "metrics": [
                {"label": "Available liquidity", "value": money(4_547_523.45), "meta": "+3.2% vs yesterday", "meta_class": "positive"},
                {"label": "Payments awaiting review", "value": "07", "meta": "2 exceed step-up threshold", "meta_class": "warning"},
                {"label": "Fraud queue", "value": "01", "meta": "manual analyst check active", "meta_class": "negative"},
                {"label": "Policy compliance", "value": "99.4%", "meta": "all controls green except 1 held transfer", "meta_class": "positive"},
            ],
            "alerts": [
                {"title": "High-value trust transfer held", "message": "Transfer TX-20396 needs step-up approval before release.", "status": "Action", "status_class": "status-pill status-pill--risk"},
                {"title": "Analyst session idle threshold approaching", "message": "One session will expire in under 4 minutes without activity.", "status": "Warning", "status_class": "status-pill status-pill--warn"},
                {"title": "Collections FX sweep completed", "message": "Daily conversion finished with treasury variance inside tolerance.", "status": "Healthy", "status_class": "status-pill status-pill--ok"},
            ],
            "watchlist": [
                {"name": "Acacia Energy", "note": "Fuel hedging counterparty", "exposure": money(540_000.00), "status": "Within limit", "status_class": "status-pill status-pill--ok"},
                {"name": "Zahara Capital", "note": "Trust reserve release request", "exposure": money(250_000.00), "status": "Review", "status_class": "status-pill status-pill--warn"},
                {"name": "Nile Telecom", "note": "Collections receivable", "exposure": money(118_920.55), "status": "Monitoring", "status_class": "status-pill status-pill--warn"},
            ],
            "activity": AUDIT_EVENTS[:5] if AUDIT_EVENTS else [
                {"title": "Treasury workspace ready", "time": iso_stamp(), "outcome": "success", "outcome_class": "event-pill event-pill--ok"},
            ],
        },
    )


def accounts_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    content = """
    <section class="grid grid-thirds">
      {% for account in accounts %}
        <div class="summary-card">
          <div class="section-title">{{ account.name }}</div>
          <h2>{{ account.available }}</h2>
          <p>{{ account.account_no }} • {{ account.currency }}</p>
          <p class="helper">Ledger balance: {{ account.ledger }}</p>
          <span class="{{ account.status_class }}">{{ account.status }}</span>
        </div>
      {% endfor %}
    </section>

    <section class="table-card">
      <div class="section-title">Account Controls</div>
      <table class="table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Control owner</th>
            <th>Dual approval</th>
            <th>Daily limit</th>
          </tr>
        </thead>
        <tbody>
          {% for control in controls %}
            <tr>
              <td>{{ control.account }}</td>
              <td>{{ control.owner }}</td>
              <td><span class="{{ control.approval_class }}">{{ control.approval }}</span></td>
              <td>{{ control.limit }}</td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </section>
    """

    return shell_view(
        session,
        route="/dashboard/accounts",
        title="Accounts",
        heading="Treasury account positions",
        subheading="Available balances, reserve posture, and control owners across all managed accounts.",
        content_template=content,
        notice=notice,
        error=error,
        page_state={
            "accounts": account_data(),
            "controls": [
                {"account": "Operating USD", "owner": "Treasury Ops", "approval": "Enabled", "approval_class": "status-pill status-pill--ok", "limit": money(500_000.00)},
                {"account": "Collections East Africa", "owner": "Regional Finance", "approval": "Conditional", "approval_class": "status-pill status-pill--warn", "limit": money(200_000.00)},
                {"account": "Client Trust Reserve", "owner": "Compliance", "approval": "Mandatory", "approval_class": "status-pill status-pill--risk", "limit": money(50_000.00)},
            ],
        },
    )


def transactions_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    content = """
    <section class="table-card">
      <div class="section-title">Latest transaction surveillance</div>
      <table class="table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Counterparty</th>
            <th>Account</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {% for tx in transactions %}
            <tr>
              <td>
                <div class="amount">{{ tx.id }}</div>
                <div class="table-note">{{ tx.date }}</div>
              </td>
              <td>{{ tx.counterparty }}</td>
              <td>{{ tx.account }}</td>
              <td>
                <div class="amount {{ tx.direction_class }}">{{ tx.amount }}</div>
                <div class="table-note">{{ tx.direction }}</div>
              </td>
              <td><span class="{{ tx.status_class }}">{{ tx.status }}</span></td>
              <td><span class="{{ tx.risk_class }}">{{ tx.risk }}</span></td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </section>
    """

    return shell_view(
        session,
        route="/dashboard/transactions",
        title="Transactions",
        heading="Monitored cash movement",
        subheading="Recent money movement with settlement, screening, and exception posture.",
        content_template=content,
        notice=notice,
        error=error,
        page_state={"transactions": transaction_data()},
    )


def payments_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    content = """
    <section class="grid grid-split">
      <div class="panel">
        <div class="section-title">Create payment</div>
        <h2>Initiate a protected transfer</h2>
        <p>Server-side validation checks amount thresholds, beneficiary completeness, session state, and CSRF before this view remounts.</p>

        <form class="form-grid" data-form-kind="payment" data-pending-label="Submitting...">
          <input type="hidden" name="csrf_token" value="{{ csrf_token }}" />

          <div class="form-row">
            <div>
              <label class="helper" for="account_name">Debit account</label>
              <select class="select" id="account_name" name="account_name">
                {% for account in accounts %}
                  <option value="{{ account.name }}">{{ account.name }} ({{ account.available }})</option>
                {% endfor %}
              </select>
            </div>
            <div>
              <label class="helper" for="amount">Amount</label>
              <input class="input" id="amount" name="amount" placeholder="2500.00" />
            </div>
          </div>

          <div class="form-row">
            <div>
              <label class="helper" for="beneficiary">Beneficiary</label>
              <input class="input" id="beneficiary" name="beneficiary" placeholder="Supplier or customer name" />
            </div>
            <div>
              <label class="helper" for="reference">Reference</label>
              <input class="input" id="reference" name="reference" placeholder="Invoice or payout reason" />
            </div>
          </div>

          <div class="actions">
            <button class="button" type="submit">Submit payment</button>
            <span class="helper">Transfers over {{ payment_threshold }} require step-up approval and are intentionally blocked in this demo.</span>
          </div>
        </form>
      </div>

      <div class="summary-card">
        <div class="section-title">Payment controls</div>
        <h2>Release policy</h2>
        <p>Only treasury admins can access this page. Every POST requires a valid CSRF token and an authenticated session with the `payments:submit` permission.</p>
        <p class="helper">Threshold: {{ payment_threshold }}</p>
      </div>
    </section>

    <section class="table-card">
      <div class="section-title">Recent payment activity</div>
      <table class="table">
        <thead>
          <tr>
            <th>Beneficiary</th>
            <th>Account</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Submitted by</th>
          </tr>
        </thead>
        <tbody>
          {% for transfer in transfers %}
            <tr>
              <td>
                <div class="amount">{{ transfer.beneficiary }}</div>
                <div class="table-note">{{ transfer.submitted_at }}</div>
              </td>
              <td>{{ transfer.account }}</td>
              <td>{{ transfer.amount }}</td>
              <td><span class="{{ transfer.status_class }}">{{ transfer.status }}</span></td>
              <td>{{ transfer.submitted_by }}</td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </section>
    """

    return shell_view(
        session,
        route="/dashboard/payments",
        title="Payments",
        heading="Initiate controlled cash outflows",
        subheading="Treasury-only action page with CSRF, permission checks, and transfer threshold validation.",
        content_template=content,
        notice=notice,
        error=error,
        page_state={
            "accounts": account_data(),
            "transfers": TRANSFER_LOG[:8],
            "payment_threshold": money(50_000.00),
        },
    )


def security_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> UIView:
    active_sessions = sessions_for_user(session["username"], current_session_id=session["session_id"])
    controls = [
        {"label": "Cookie policy", "value": "HttpOnly, SameSite=Lax, signed server-side session IDs"},
        {"label": "Cache handling", "value": "All HTML and JSON responses use no-store"},
        {"label": "Transport guidance", "value": "Secure cookies can be enforced with CUP_DASHBOARD_SECURE_COOKIES=1"},
        {"label": "Session expiry", "value": f"{SESSION_IDLE_SECONDS // 60} minute idle timeout / {SESSION_ABSOLUTE_SECONDS // 3600} hour absolute timeout"},
    ]

    content = """
    <section class="grid grid-split">
      <div class="security-card">
        <div class="section-title">Current session</div>
        <h2>{{ display_name }}</h2>
        <p>{{ role }} • {{ team }}</p>
        <div class="list">
          <div class="list-item">
            <div>
              <div class="amount">Session created</div>
              <div class="table-note">{{ session_created }}</div>
            </div>
            <span class="code">{{ session_id_short }}</span>
          </div>
          <div class="list-item">
            <div>
              <div class="amount">Last activity</div>
              <div class="table-note">{{ last_seen }}</div>
            </div>
            <span class="{% if mfa_verified %}status-pill status-pill--ok{% else %}status-pill status-pill--warn{% endif %}">
              {% if mfa_verified %}MFA verified{% else %}MFA pending{% endif %}
            </span>
          </div>
        </div>
      </div>

      <div class="security-card">
        <div class="section-title">Session controls</div>
        <div class="stack">
          <form data-form-kind="rotate_session" data-pending-label="Rotating...">
            <input type="hidden" name="csrf_token" value="{{ csrf_token }}" />
            <button class="button-secondary" type="submit">Rotate session + CSRF token</button>
          </form>
          <form data-form-kind="terminate_other_sessions" data-pending-label="Terminating...">
            <input type="hidden" name="csrf_token" value="{{ csrf_token }}" />
            <button class="button-ghost" type="submit">Terminate other sessions</button>
          </form>
        </div>
      </div>
    </section>

    <section class="grid grid-split">
      <div class="table-card">
        <div class="section-title">Security controls</div>
        <div class="list">
          {% for control in controls %}
            <div class="list-item">
              <div>
                <div class="amount">{{ control.label }}</div>
                <div class="table-note">{{ control.value }}</div>
              </div>
            </div>
          {% endfor %}
        </div>
      </div>

      <div class="table-card">
        <div class="section-title">User sessions</div>
        <div class="list">
          {% for item in user_sessions %}
            <div class="list-item">
              <div>
                <div class="amount">{{ item.label }}</div>
                <div class="table-note">{{ item.meta }}</div>
              </div>
              <span class="{{ item.status_class }}">{{ item.status }}</span>
            </div>
          {% endfor %}
        </div>
      </div>
    </section>

    <section class="table-card">
      <div class="section-title">Audit trail</div>
      <table class="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Event</th>
            <th>User</th>
            <th>Outcome</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {% for event in audit_events %}
            <tr>
              <td>{{ event.timestamp }}</td>
              <td>{{ event.event }}</td>
              <td>{{ event.username }}</td>
              <td><span class="{{ event.outcome_class }}">{{ event.outcome }}</span></td>
              <td>{{ event.detail }}</td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </section>
    """

    return shell_view(
        session,
        route="/dashboard/security",
        title="Security Center",
        heading="Operational security controls",
        subheading="Session hygiene, protection posture, and audit activity for the signed-in user.",
        content_template=content,
        notice=notice,
        error=error,
        page_state={
            "session_created": iso_stamp(session["created_at"]),
            "last_seen": iso_stamp(session["last_seen"]),
            "session_id_short": session["session_id"][-8:],
            "controls": controls,
            "user_sessions": active_sessions,
            "audit_events": AUDIT_EVENTS[:10],
        },
    )


def denied_view(session: dict[str, Any], route: str) -> UIView:
    content = """
    <section class="panel">
      <div class="section-title">Access denied</div>
      <h2>You do not have permission to open this workspace section.</h2>
      <p>This request was authenticated but blocked by a server-side authorization check for <span class="code">{{ denied_route }}</span>.</p>
    </section>
    """
    return shell_view(
        session,
        route=route,
        title="Access denied",
        heading="Authorization blocked this route",
        subheading="The finance dashboard only exposes sections that match the current role permissions.",
        content_template=content,
        page_state={"denied_route": route},
        error="Your role does not include the permission required for this page.",
    )


def not_found_view(session: dict[str, Any], route: str) -> UIView:
    content = """
    <section class="panel">
      <div class="section-title">Not found</div>
      <h2>No page exists for this route.</h2>
      <p>Requested route: <span class="code">{{ missing_route }}</span></p>
    </section>
    """
    return shell_view(
        session,
        route="/dashboard/overview",
        title="Route not found",
        heading="This dashboard page does not exist",
        subheading="The server returned a controlled fallback view instead of leaking an internal error.",
        content_template=content,
        page_state={"missing_route": route},
        error="Unknown route requested.",
    )


def sessions_for_user(username: str, *, current_session_id: str | None = None) -> list[dict[str, str]]:
    current = now_ts()
    result: list[dict[str, str]] = []
    for session_id, session in SESSIONS.items():
        if session.get("username") != username:
            continue
        idle_seconds = int(current - session["last_seen"])
        is_current = session_id == current_session_id
        result.append(
            {
                "label": session_id[-8:],
                "meta": f"{session.get('remote_addr', 'unknown')} • idle {idle_seconds}s • {session.get('role', 'Anonymous')}",
                "status": "Current" if is_current else "Active",
                "status_class": "status-pill status-pill--ok" if is_current or idle_seconds < 600 else "status-pill status-pill--warn",
            }
        )
    return result


class DashboardHandler(BaseHTTPRequestHandler):
    server_version = ""
    sys_version = ""

    pending_cookie: str | None = None

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[dashboard] {self.command} {self.path} -> {args[0]}")

    def remote_addr(self) -> str:
        return self.client_address[0] if self.client_address else "127.0.0.1"

    def security_headers(self, *, is_json: bool = False) -> dict[str, str]:
        return {
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
            "Referrer-Policy": "same-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Resource-Policy": "same-origin" if not is_json else "same-origin",
        }

    def send_payload(self, body: bytes, *, status: int, content_type: str, is_json: bool = False) -> None:
        self.send_response(status)
        for key, value in self.security_headers(is_json=is_json).items():
            self.send_header(key, value)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        if self.pending_cookie:
            self.send_header("Set-Cookie", self.pending_cookie)
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text: str, *, status: int = 200, content_type: str = "text/html; charset=utf-8") -> None:
        self.send_payload(text.encode("utf-8"), status=status, content_type=content_type)

    def send_view(self, view: UIView, *, status: int = 200) -> None:
        body, content_type = view.to_response()
        self.send_payload(body.encode("utf-8"), status=status, content_type=content_type, is_json=True)

    def send_file(self, target: Path, *, content_type: str) -> None:
        self.send_payload(target.read_bytes(), status=200, content_type=content_type)

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, dict) else {}

    def current_session(self) -> tuple[str, dict[str, Any], bool]:
        jar = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        raw_cookie = jar.get(SESSION_COOKIE)
        user_agent = self.headers.get("User-Agent", "")
        remote_addr = self.remote_addr()

        if raw_cookie:
            session_id = verify_cookie_value(raw_cookie.value)
            session = SESSIONS.get(session_id or "")
            if session and not self.session_expired(session):
                session["last_seen"] = now_ts()
                session["remote_addr"] = remote_addr
                session["user_agent"] = user_agent[:120]
                session["session_id"] = session_id
                return session_id, session, False
            destroy_session(session_id if raw_cookie else None)

        session_id, session = create_session(remote_addr=remote_addr, user_agent=user_agent)
        session["session_id"] = session_id
        self.pending_cookie = self.make_set_cookie(session_id)
        return session_id, session, True

    def session_expired(self, session: dict[str, Any]) -> bool:
        now = now_ts()
        idle = now - session["last_seen"]
        absolute = now - session["created_at"]
        return idle > SESSION_IDLE_SECONDS or absolute > SESSION_ABSOLUTE_SECONDS

    def make_set_cookie(self, session_id: str, *, max_age: int = SESSION_ABSOLUTE_SECONDS) -> str:
        value = make_cookie_value(session_id)
        parts = [
            f"{SESSION_COOKIE}={value}",
            "Path=/",
            f"Max-Age={max_age}",
            "HttpOnly",
            "SameSite=Lax",
        ]
        if USE_SECURE_COOKIES:
            parts.append("Secure")
        return "; ".join(parts)

    def clear_cookie(self) -> None:
        parts = [f"{SESSION_COOKIE}=", "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"]
        if USE_SECURE_COOKIES:
            parts.append("Secure")
        self.pending_cookie = "; ".join(parts)

    def require_csrf(self, session: dict[str, Any], payload: dict[str, Any]) -> bool:
        header = self.headers.get("X-CSRF-Token", "")
        token = str(payload.get("csrf_token", ""))
        expected = session["csrf_token"]
        return bool(header and token and hmac.compare_digest(header, expected) and hmac.compare_digest(token, expected))

    def csrf_error_view(self, session: dict[str, Any], payload: dict[str, Any]) -> tuple[int, UIView]:
        error = "Security token validation failed. Refresh and try again."
        if not session.get("authenticated") or self.path == "/api/auth/login":
            return 403, build_login_view(
                session,
                error=error,
                username=str(payload.get("username", "")).strip(),
            )

        route = POST_ROUTE_FALLBACKS.get(self.path, "/dashboard/overview")
        status, view = self.resolve_view_for_route(session, route, error=error)
        return max(status, 403), view

    def resolve_view_for_route(self, session: dict[str, Any], route: str, *, notice: str | None = None, error: str | None = None) -> tuple[int, UIView]:
        normalized = route if route.startswith("/") else f"/{route}"
        if normalized in {"/", "/login"} or not session.get("authenticated"):
            if session.get("authenticated") and normalized in {"/", "/login"}:
                return 200, overview_view(session, notice="Already signed in.")
            if normalized not in {"/", "/login"}:
                add_audit_event("route_redirect", session.get("username") or "", "warning", f"redirected unauthenticated route {normalized} to login", self.remote_addr())
            return 200, build_login_view(session, notice=notice or "Sign in to open the protected finance workspace.", error=error)

        permission = ROUTE_PERMISSIONS.get(normalized)
        permissions = session.get("permissions", [])
        if permission and permission not in permissions:
            add_audit_event("authorization", session["username"], "error", f"blocked route {normalized}", self.remote_addr())
            return 403, denied_view(session, normalized)

        if normalized == "/dashboard/overview":
            return 200, overview_view(session, notice=notice, error=error)
        if normalized == "/dashboard/accounts":
            return 200, accounts_view(session, notice=notice, error=error)
        if normalized == "/dashboard/transactions":
            return 200, transactions_view(session, notice=notice, error=error)
        if normalized == "/dashboard/payments":
            return 200, payments_view(session, notice=notice, error=error)
        if normalized == "/dashboard/security":
            return 200, security_view(session, notice=notice, error=error)

        add_audit_event("route_missing", session["username"], "warning", f"unknown route {normalized}", self.remote_addr())
        return 404, not_found_view(session, normalized)

    def do_GET(self) -> None:
        self.pending_cookie = None
        session_id, session, _ = self.current_session()
        session["session_id"] = session_id

        parsed = urlparse(self.path)
        if parsed.path == "/app.js":
            self.send_file(APP_JS_FILE, content_type="text/javascript; charset=utf-8")
            return
        if parsed.path == "/app.css":
            self.send_file(APP_CSS_FILE, content_type="text/css; charset=utf-8")
            return
        if parsed.path.startswith("/dist/"):
            self.serve_dist_asset(parsed.path)
            return
        if parsed.path == "/favicon.ico":
            self.send_payload(b"", status=204, content_type="image/x-icon")
            return
        if parsed.path == "/api/views":
            route = parse_qs(parsed.query).get("route", ["/login"])[0]
            status, view = self.resolve_view_for_route(session, route)
            self.send_view(view, status=status)
            return

        self.send_file(INDEX_FILE, content_type="text/html; charset=utf-8")

    def do_POST(self) -> None:
        self.pending_cookie = None
        session_id, session, _ = self.current_session()
        session["session_id"] = session_id
        payload = self.read_json()

        if not self.require_csrf(session, payload):
            add_audit_event("csrf", session.get("username") or "", "error", f"rejected CSRF on {self.path}", self.remote_addr())
            status, view = self.csrf_error_view(session, payload)
            self.send_view(view, status=status)
            return

        if self.path == "/api/auth/login":
            self.handle_login(session_id, session, payload)
            return
        if self.path == "/api/auth/logout":
            self.handle_logout(session_id, session)
            return
        if self.path == "/api/payments/create":
            self.handle_payment(session, payload)
            return
        if self.path == "/api/security/rotate-session":
            self.handle_rotate_session(session_id, session)
            return
        if self.path == "/api/security/terminate-others":
            self.handle_terminate_other_sessions(session_id, session)
            return

        self.send_view(build_login_view(session, error="Unknown POST endpoint."), status=404)

    def handle_login(self, session_id: str, session: dict[str, Any], payload: dict[str, Any]) -> None:
        time.sleep(0.25)
        remote_addr = self.remote_addr()

        if is_rate_limited(remote_addr):
            add_audit_event("login", "", "error", "rate limit triggered", remote_addr)
            self.send_view(
                build_login_view(
                    session,
                    error="Too many login attempts. Wait a few minutes before trying again.",
                    username=str(payload.get("username", "")),
                ),
                status=429,
            )
            return

        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        user_record = USER_FIXTURES.get(username)

        if not user_record or not verify_password(password, user_record):
            remaining = record_failed_login(remote_addr)
            add_audit_event("login", username, "error", "invalid credentials", remote_addr)
            self.send_view(
                build_login_view(
                    session,
                    error="Incorrect username or password.",
                    notice=f"{remaining} attempts remaining before temporary lockout." if remaining > 0 else None,
                    username=username,
                ),
                status=401,
            )
            return

        reset_failed_logins(remote_addr)
        destroy_session(session_id)
        new_session_id, new_session = create_session(
            authenticated=True,
            username=username,
            remote_addr=remote_addr,
            user_agent=self.headers.get("User-Agent", ""),
        )
        new_session["session_id"] = new_session_id
        self.pending_cookie = self.make_set_cookie(new_session_id)
        add_audit_event("login", username, "success", "authenticated into treasury workspace", remote_addr)
        self.send_view(overview_view(new_session, notice="Authentication successful. Secure workspace opened."))

    def handle_logout(self, session_id: str, session: dict[str, Any]) -> None:
        username = session.get("username") or ""
        destroy_session(session_id)
        new_session_id, anonymous_session = create_session(
            remote_addr=self.remote_addr(),
            user_agent=self.headers.get("User-Agent", ""),
        )
        anonymous_session["session_id"] = new_session_id
        self.pending_cookie = self.make_set_cookie(new_session_id)
        add_audit_event("logout", username, "success", "session closed", self.remote_addr())
        self.send_view(build_login_view(anonymous_session, notice="You have been signed out safely."))

    def handle_payment(self, session: dict[str, Any], payload: dict[str, Any]) -> None:
        if "payments:submit" not in session.get("permissions", []):
            add_audit_event("payment", session.get("username", ""), "error", "blocked unauthorized payment action", self.remote_addr())
            self.send_view(denied_view(session, "/dashboard/payments"), status=403)
            return

        beneficiary = str(payload.get("beneficiary", "")).strip()
        account_name = str(payload.get("account_name", "")).strip()
        reference = str(payload.get("reference", "")).strip()
        try:
            amount = float(str(payload.get("amount", "0")).replace(",", ""))
        except ValueError:
            amount = -1

        if not beneficiary or not account_name or not reference:
            self.send_view(payments_view(session, error="All payment fields are required."), status=422)
            return
        if amount <= 0:
            self.send_view(payments_view(session, error="Amount must be a positive number."), status=422)
            return
        if amount > 50_000:
            add_audit_event("payment", session["username"], "warning", f"blocked high-value payment {money(amount)} for {beneficiary}", self.remote_addr())
            self.send_view(
                payments_view(
                    session,
                    error="This demo blocks transfers above $50,000 until step-up approval is completed.",
                ),
                status=409,
            )
            return

        TRANSFER_LOG.insert(
            0,
            {
                "beneficiary": beneficiary,
                "account": account_name,
                "amount": money(amount),
                "status": "Queued",
                "status_class": "status-pill status-pill--warn",
                "submitted_by": session["display_name"],
                "submitted_at": iso_stamp(),
            },
        )
        del TRANSFER_LOG[10:]
        add_audit_event("payment", session["username"], "success", f"submitted payment {money(amount)} to {beneficiary}", self.remote_addr())
        self.send_view(payments_view(session, notice="Payment submitted to the review queue."))

    def handle_rotate_session(self, session_id: str, session: dict[str, Any]) -> None:
        if "security:manage" not in session.get("permissions", []):
            self.send_view(denied_view(session, "/dashboard/security"), status=403)
            return

        rotated = dict(session)
        destroy_session(session_id)
        new_session_id, new_session = create_session(
            authenticated=True,
            username=rotated["username"],
            remote_addr=self.remote_addr(),
            user_agent=self.headers.get("User-Agent", ""),
        )
        new_session["session_id"] = new_session_id
        self.pending_cookie = self.make_set_cookie(new_session_id)
        add_audit_event("session_rotation", new_session["username"], "success", "rotated session and CSRF token", self.remote_addr())
        self.send_view(security_view(new_session, notice="Session and CSRF token rotated successfully."))

    def handle_terminate_other_sessions(self, session_id: str, session: dict[str, Any]) -> None:
        if "security:manage" not in session.get("permissions", []):
            self.send_view(denied_view(session, "/dashboard/security"), status=403)
            return

        username = session["username"]
        for candidate_id, candidate in list(SESSIONS.items()):
            if candidate_id == session_id:
                continue
            if candidate.get("username") == username:
                destroy_session(candidate_id)
        add_audit_event("session_terminate", username, "success", "terminated other sessions for user", self.remote_addr())
        self.send_view(security_view(session, notice="Other active sessions were terminated."))

    def serve_dist_asset(self, request_path: str) -> None:
        relative = request_path.removeprefix("/dist/")
        target = (DIST_DIR / relative).resolve()
        if DIST_DIR.resolve() not in target.parents and target != DIST_DIR.resolve():
            self.send_text("Forbidden", status=403, content_type="text/plain; charset=utf-8")
            return
        if not target.exists() or not target.is_file():
            self.send_text("Not found", status=404, content_type="text/plain; charset=utf-8")
            return

        if target.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        elif target.suffix == ".json":
            content_type = "application/json; charset=utf-8"
        elif target.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif target.suffix == ".map":
            content_type = "application/json; charset=utf-8"
        else:
            content_type = "application/octet-stream"
        self.send_file(target, content_type=content_type)


def main() -> None:
    if not DIST_DIR.exists():
        raise SystemExit("dist/ not found. Run `npm run build` before starting the dashboard demo.")

    server = HTTPServer((HOST, PORT), DashboardHandler)
    print(f"CUP financial dashboard demo -> http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
