from __future__ import annotations

import secrets
import time
from collections import defaultdict
from typing import Any

from .config import LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SECONDS, SESSION_ABSOLUTE_SECONDS, SESSION_IDLE_SECONDS
from .data import USER_FIXTURES
from .security import new_csrf_token

SESSIONS: dict[str, dict[str, Any]] = {}
FAILED_LOGINS: dict[str, list[float]] = defaultdict(list)
AUDIT_EVENTS: list[dict[str, str]] = []


def now_ts() -> float:
    return time.time()


def iso_stamp(ts: float | None = None) -> str:
    stamp = time.localtime(ts or now_ts())
    return time.strftime("%Y-%m-%d %H:%M:%S", stamp)


def create_session(
    *,
    authenticated: bool = False,
    username: str | None = None,
    remote_addr: str = "",
    user_agent: str = "",
) -> tuple[str, dict[str, Any]]:
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
        session["region"] = profile["region"]
        session["team"] = profile["team"]
        session["permissions"] = list(profile["permissions"])
        session["mfa_verified"] = bool(profile["mfa_enabled"])

    SESSIONS[session_id] = session
    return session_id, session


def destroy_session(session_id: str | None) -> None:
    if session_id:
        SESSIONS.pop(session_id, None)


def session_expired(session: dict[str, Any]) -> bool:
    now = now_ts()
    idle = now - float(session["last_seen"])
    absolute = now - float(session["created_at"])
    return idle > SESSION_IDLE_SECONDS or absolute > SESSION_ABSOLUTE_SECONDS


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
    del AUDIT_EVENTS[60:]


def sessions_for_user(username: str, *, current_session_id: str | None = None) -> list[dict[str, str]]:
    current = now_ts()
    result: list[dict[str, str]] = []
    for session_id, session in SESSIONS.items():
        if session.get("username") != username:
            continue
        idle_seconds = int(current - float(session["last_seen"]))
        is_current = session_id == current_session_id
        result.append(
            {
                "label": session_id[-8:],
                "meta": f"{session.get('remote_addr', 'unknown')} | idle {idle_seconds}s | {session.get('role', 'Anonymous')}",
                "status": "Current" if is_current else "Active",
                "status_class": "status-pill status-pill--ok" if is_current or idle_seconds < 600 else "status-pill status-pill--warn",
            }
        )
    return result
