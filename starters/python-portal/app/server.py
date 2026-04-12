from __future__ import annotations

import hmac
import json
import time
from http import cookies
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from .actions import ActionResult, decide_request_action, submit_request_action
from .config import DIST_DIR, HOST, INDEX_FILE, PORT, SESSION_ABSOLUTE_SECONDS, SESSION_COOKIE, STATIC_DIR, USE_SECURE_COOKIES
from .cup_bridge import STARTER_VIEW_POLICY, validate_view_policy
from .data import ROUTE_FALLBACKS
from .routes import resolve_view_for_route
from .security import make_cookie_value, security_headers, verify_cookie_value
from .sessions import SESSIONS, create_session, destroy_session, session_expired


class PortalHandler(BaseHTTPRequestHandler):
    server_version = ""
    sys_version = ""

    pending_cookie: str | None = None

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[portal] {self.command} {self.path} -> {args[0]}")

    def remote_addr(self) -> str:
        return self.client_address[0] if self.client_address else "127.0.0.1"

    def send_payload(self, body: bytes, *, status: int, content_type: str, is_json: bool = False) -> None:
        self.send_response(status)
        for key, value in security_headers(is_json=is_json).items():
            self.send_header(key, value)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        if self.pending_cookie:
            self.send_header("Set-Cookie", self.pending_cookie)
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text: str, *, status: int = 200, content_type: str = "text/html; charset=utf-8") -> None:
        self.send_payload(text.encode("utf-8"), status=status, content_type=content_type)

    def send_view(self, view: Any, *, status: int = 200) -> None:
        validate_view_policy(view, STARTER_VIEW_POLICY)
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
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}

    def make_set_cookie(self, session_id: str, *, max_age: int = SESSION_ABSOLUTE_SECONDS) -> str:
        parts = [
            f"{SESSION_COOKIE}={make_cookie_value(session_id)}",
            "Path=/",
            f"Max-Age={max_age}",
            "HttpOnly",
            "SameSite=Lax",
        ]
        if USE_SECURE_COOKIES:
            parts.append("Secure")
        return "; ".join(parts)

    def current_session(self) -> tuple[str, dict[str, Any]]:
        jar = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        raw_cookie = jar.get(SESSION_COOKIE)
        user_agent = self.headers.get("User-Agent", "")
        remote_addr = self.remote_addr()

        if raw_cookie:
            session_id = verify_cookie_value(raw_cookie.value)
            session = SESSIONS.get(session_id or "")
            if session and not session_expired(session):
                session["last_seen"] = time.time()
                session["remote_addr"] = remote_addr
                session["user_agent"] = user_agent[:120]
                session["session_id"] = session_id
                return session_id, session
            destroy_session(session_id if raw_cookie else None)

        session_id, session = create_session(remote_addr=remote_addr, user_agent=user_agent, display_name="Workflow Desk")
        session["session_id"] = session_id
        self.pending_cookie = self.make_set_cookie(session_id)
        return session_id, session

    def require_csrf(self, session: dict[str, Any], payload: dict[str, Any]) -> bool:
        header = self.headers.get("X-CSRF-Token", "")
        token = str(payload.get("csrf_token", ""))
        expected = session["csrf_token"]
        return bool(
            header
            and token
            and hmac.compare_digest(header, expected)
            and hmac.compare_digest(token, expected)
        )

    def csrf_error_view(self, session: dict[str, Any]) -> tuple[int, Any]:
        route = ROUTE_FALLBACKS.get(self.path, "/portal/request")
        return resolve_view_for_route(session, route, error="Security token validation failed. Refresh and try again.")

    def apply_action_result(self, result: ActionResult) -> None:
        self.send_view(result.view, status=result.status)

    def do_GET(self) -> None:
        self.pending_cookie = None
        _, session = self.current_session()

        parsed = urlparse(self.path)
        if parsed.path == "/app.js":
            self.send_file(STATIC_DIR / "app.js", content_type="text/javascript; charset=utf-8")
            return
        if parsed.path == "/app.css":
            self.send_file(STATIC_DIR / "app.css", content_type="text/css; charset=utf-8")
            return
        if parsed.path.startswith("/dist/"):
            self.serve_dist_asset(parsed.path)
            return
        if parsed.path == "/favicon.ico":
            self.send_payload(b"", status=204, content_type="image/x-icon")
            return
        if parsed.path == "/api/views":
            route = parse_qs(parsed.query).get("route", ["/portal/request"])[0]
            status, view = resolve_view_for_route(session, route)
            self.send_view(view, status=status)
            return

        self.send_file(INDEX_FILE, content_type="text/html; charset=utf-8")

    def do_POST(self) -> None:
        self.pending_cookie = None
        _, session = self.current_session()
        payload = self.read_json()

        if not self.require_csrf(session, payload):
            status, view = self.csrf_error_view(session)
            self.send_view(view, status=max(status, 403))
            return

        if self.path == "/api/requests":
            self.apply_action_result(submit_request_action(session, payload))
            return
        if self.path == "/api/reviews":
            self.apply_action_result(decide_request_action(session, payload))
            return

        self.send_text("Not found", status=404, content_type="text/plain; charset=utf-8")

    def serve_dist_asset(self, request_path: str) -> None:
        relative = request_path.removeprefix("/dist/")
        target = (DIST_DIR / relative).resolve()
        dist_root = DIST_DIR.resolve()
        if dist_root not in target.parents and target != dist_root:
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
        raise SystemExit("dist/ not found. Run `npm run build` in the CUP repo or point `CUP_DIST_DIR` to a built runtime directory.")

    server = HTTPServer((HOST, PORT), PortalHandler)
    print(f"CUP portal starter -> http://{HOST}:{PORT}")
    server.serve_forever()
