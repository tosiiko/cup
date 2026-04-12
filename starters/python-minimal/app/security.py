from __future__ import annotations

import hashlib
import hmac
import secrets

from .config import SESSION_SECRET


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


def security_headers(*, is_json: bool = False) -> dict[str, str]:
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
