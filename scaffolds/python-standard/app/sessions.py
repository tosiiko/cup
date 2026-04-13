from __future__ import annotations

import secrets
import time
from typing import Any

from .config import SESSION_ABSOLUTE_SECONDS, SESSION_IDLE_SECONDS
from .security import new_csrf_token

SESSIONS: dict[str, dict[str, Any]] = {}


def create_session(*, remote_addr: str, user_agent: str, display_name: str = "Operator") -> tuple[str, dict[str, Any]]:
    session_id = secrets.token_urlsafe(24)
    now = time.time()
    session = {
        "display_name": display_name,
        "csrf_token": new_csrf_token(),
        "created_at": now,
        "last_seen": now,
        "remote_addr": remote_addr,
        "user_agent": user_agent[:120],
    }
    SESSIONS[session_id] = session
    return session_id, session


def destroy_session(session_id: str | None) -> None:
    if session_id:
        SESSIONS.pop(session_id, None)


def session_expired(session: dict[str, Any]) -> bool:
    now = time.time()
    created_at = float(session.get("created_at", 0))
    last_seen = float(session.get("last_seen", 0))
    return (now - created_at) > SESSION_ABSOLUTE_SECONDS or (now - last_seen) > SESSION_IDLE_SECONDS
