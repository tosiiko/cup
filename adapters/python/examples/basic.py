"""
CUP Python Adapter — stdlib HTTP server example
Run: python example.py
Then open: http://localhost:8000

The CUP frontend fetches UIView JSON from these endpoints and renders it.
CORS headers are included so the Vite dev server (localhost:5173) can reach it.
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from cup import STARTER_VIEW_POLICY, FetchAction, UIView, validate_view_policy

# ── Shared state (in-memory for the demo) ────────────────────────────────────

_state = {"count": 0, "items": ["Alpha", "Beta", "Gamma"]}

CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

# ── Views ─────────────────────────────────────────────────────────────────────

def dashboard_view() -> UIView:
    return (
        UIView("""
            <h2>Python Dashboard</h2>
            <p>Served from <strong>cup-python</strong> via stdlib HTTP.</p>

            <div style="margin:1.5rem 0">
                <div style="font-size:3rem;font-weight:800">{{ count }}</div>
                <div style="display:flex;gap:.5rem;margin-top:1rem">
                    <button data-action="increment">+ Increment</button>
                    <button data-action="decrement">− Decrement</button>
                    <button data-action="reset">Reset</button>
                </div>
            </div>

            <h3>Items</h3>
            <ul>
                {% for item in items %}
                    <li>{{ item }}</li>
                {% endfor %}
            </ul>
        """)
        .state(**_state)
        .action("increment", FetchAction("/api/increment"))
        .action("decrement", FetchAction("/api/decrement"))
        .action("reset",     FetchAction("/api/reset"))
        .title("Python Dashboard")
        .route("/")
    )


def send_view(handler: BaseHTTPRequestHandler, view: UIView) -> None:
    validate_view_policy(view, STARTER_VIEW_POLICY)
    body, content_type = view.to_response()
    handler._send(body, 200, content_type)


# ── HTTP handler ──────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):  # silence default access log
        print(f"  {self.path}  {args[0]}")

    def _send(self, body: str, status: int = 200, ct: str = "application/json") -> None:
        encoded = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(encoded)))
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(encoded)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length:
            return json.loads(self.rfile.read(length))
        return {}

    def do_OPTIONS(self):
        self._send("", 204, "text/plain")

    def do_GET(self):
        if self.path == "/":
            send_view(self, dashboard_view())
        else:
            self._send(json.dumps({"error": "not found"}), 404)

    def do_POST(self):
        if self.path == "/api/increment":
            _state["count"] += 1
        elif self.path == "/api/decrement":
            _state["count"] -= 1
        elif self.path == "/api/reset":
            _state["count"] = 0
        else:
            self._send(json.dumps({"error": "unknown action"}), 404)
            return

        # Every action returns the full updated UIView — the runtime remounts it
        send_view(self, dashboard_view())


if __name__ == "__main__":
    addr = ("localhost", 8000)
    print(f"CUP Python server → http://{addr[0]}:{addr[1]}")
    HTTPServer(addr, Handler).serve_forever()
