from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "adapters" / "python"))

from cup import EmitAction, STARTER_VIEW_POLICY, UIView, validate_view_policy  # noqa: E402

HOST = "127.0.0.1"
PORT = 8010
VALID_USERNAME = "demo"
VALID_PASSWORD = "cup123"

INDEX_FILE = ROOT / "demo" / "login" / "index.html"
DIST_DIR = ROOT / "dist"


def login_view(*, username: str = "", error: str | None = None, notice: str | None = None) -> UIView:
    template = """
    <section style="display:grid;gap:22px;">
      <div style="display:grid;gap:10px;">
        <span style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8b7965;">Login Demo</span>
        <h2 style="margin:0;font-size:2.2rem;letter-spacing:-0.05em;color:#24180d;">Welcome back</h2>
        <p style="margin:0;color:#76634f;line-height:1.6;">
          Sign in with the demo account to see a Python server return the next CUP view.
        </p>
      </div>

      {% if error %}
        <div style="padding:14px 16px;border-radius:16px;background:#fff0ee;color:#8f2e22;border:1px solid rgba(143,46,34,0.12);">
          {{ error }}
        </div>
      {% endif %}

      {% if notice %}
        <div style="padding:14px 16px;border-radius:16px;background:#eef8ef;color:#24653a;border:1px solid rgba(36,101,58,0.12);">
          {{ notice }}
        </div>
      {% endif %}

      <form data-login-form style="display:grid;gap:16px;">
        <label style="display:grid;gap:8px;">
          <span style="font-size:13px;font-weight:600;color:#5f4e3f;">Username</span>
          <input
            name="username"
            type="text"
            value="{{ username }}"
            autocomplete="username"
            placeholder="demo"
            style="width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;"
          />
        </label>

        <label style="display:grid;gap:8px;">
          <span style="font-size:13px;font-weight:600;color:#5f4e3f;">Password</span>
          <input
            name="password"
            type="password"
            autocomplete="current-password"
            placeholder="cup123"
            style="width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;"
          />
        </label>

        <button
          type="button"
          data-action="submit"
          data-login-button
          style="margin-top:6px;padding:15px 18px;border:none;border-radius:18px;background:#b05c2f;color:white;font:inherit;font-weight:700;letter-spacing:0.01em;"
        >
          Sign in
        </button>
      </form>

      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#8b7965;font-size:0.9rem;">
        <span>Demo user: <strong style="color:#24180d;">demo</strong></span>
        <span>Demo password: <strong style="color:#24180d;">cup123</strong></span>
      </div>
    </section>
    """

    return (
        UIView(template)
        .state(username=username, error=error, notice=notice)
        .action("submit", EmitAction("cup-login-submit"))
        .title("CUP Python Login")
        .route("/api/view")
    )


def success_view(username: str) -> UIView:
    template = """
    <section style="display:grid;gap:20px;">
      <div style="width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:#eef8ef;color:#24653a;font-size:1.8rem;">
        ✓
      </div>

      <div style="display:grid;gap:10px;">
        <span style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8b7965;">Authenticated</span>
        <h2 style="margin:0;font-size:2.4rem;letter-spacing:-0.05em;color:#24180d;">Hello, {{ username }}</h2>
        <p style="margin:0;color:#76634f;line-height:1.6;">
          The Python backend accepted your credentials and returned this success view as CUP JSON.
        </p>
      </div>

      <div style="display:grid;gap:12px;padding:18px;border-radius:18px;background:#f7f1e9;border:1px solid rgba(102,70,30,0.1);">
        <strong style="font-size:0.82rem;letter-spacing:0.08em;text-transform:uppercase;color:#8b7965;">What happened</strong>
        <span style="color:#5f4e3f;">1. The button emitted a CUP client event.</span>
        <span style="color:#5f4e3f;">2. The browser bridge posted your form values to Python.</span>
        <span style="color:#5f4e3f;">3. Python returned a new `UIView` and the app remounted it.</span>
      </div>

      <button
        type="button"
        data-action="reset"
        style="padding:14px 18px;border:none;border-radius:18px;background:#24180d;color:white;font:inherit;font-weight:700;"
      >
        Back to login
      </button>
    </section>
    """

    return (
        UIView(template)
        .state(username=username)
        .action("reset", EmitAction("cup-login-reset"))
        .title("CUP Login Success")
        .route("/api/login")
    )


class DemoHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[demo] {self.command} {self.path} -> {args[0]}")

    def _send_text(self, body: str, *, content_type: str = "text/html; charset=utf-8", status: int = 200) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _send_json(self, view: UIView, *, status: int = 200) -> None:
        validate_view_policy(view, STARTER_VIEW_POLICY)
        body, content_type = view.to_response()
        self._send_text(body, content_type=content_type, status=status)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        payload = json.loads(raw.decode("utf-8"))
        return payload if isinstance(payload, dict) else {}

    def do_GET(self) -> None:
        if self.path == "/":
            self._send_text(INDEX_FILE.read_text(encoding="utf-8"))
            return

        if self.path == "/api/view":
            self._send_json(login_view(notice="Use the demo credentials shown on the page."))
            return

        if self.path.startswith("/dist/"):
            self._serve_dist_asset()
            return

        self._send_text("Not found", content_type="text/plain; charset=utf-8", status=404)

    def do_POST(self) -> None:
        if self.path != "/api/login":
            self._send_text("Not found", content_type="text/plain; charset=utf-8", status=404)
            return

        payload = self._read_json()
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))

        if username == VALID_USERNAME and password == VALID_PASSWORD:
            self._send_json(success_view(username))
            return

        self._send_json(
            login_view(
                username=username,
                error="Incorrect username or password. Try the demo credentials and submit again.",
            ),
        )

    def _serve_dist_asset(self) -> None:
        relative = self.path.removeprefix("/dist/")
        target = (DIST_DIR / relative).resolve()

        if DIST_DIR.resolve() not in target.parents and target != DIST_DIR.resolve():
            self._send_text("Forbidden", content_type="text/plain; charset=utf-8", status=403)
            return

        if not target.exists() or not target.is_file():
            self._send_text("Not found", content_type="text/plain; charset=utf-8", status=404)
            return

        if target.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        elif target.suffix == ".json":
            content_type = "application/json; charset=utf-8"
        elif target.suffix == ".map":
            content_type = "application/json; charset=utf-8"
        elif target.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        else:
            content_type = "application/octet-stream"

        self._send_text(target.read_text(encoding="utf-8"), content_type=content_type)


def main() -> None:
    if not DIST_DIR.exists():
        raise SystemExit("dist/ not found. Run `npm run build` before starting the demo.")

    server = HTTPServer((HOST, PORT), DemoHandler)
    print(f"CUP Python login demo -> http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
