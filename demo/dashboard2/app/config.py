from __future__ import annotations

import os
import secrets
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
DASHBOARD_DIR = APP_DIR.parent
DEMO_DIR = DASHBOARD_DIR.parent
REPO_ROOT = DEMO_DIR.parent

HOST = os.environ.get("CUP_DASHBOARD2_HOST", "127.0.0.1")
PORT = int(os.environ.get("CUP_DASHBOARD2_PORT", "8030"))
APP_NAME = "CUP CRM Studio"

SESSION_COOKIE = "cup_crm_session"
SESSION_IDLE_SECONDS = 20 * 60
SESSION_ABSOLUTE_SECONDS = 10 * 60 * 60
LOGIN_WINDOW_SECONDS = 10 * 60
LOGIN_MAX_ATTEMPTS = 5
PBKDF2_ITERATIONS = 310_000
LEAD_APPROVAL_THRESHOLD = 250_000.0

SESSION_SECRET = (os.environ.get("CUP_CRM_SECRET") or secrets.token_hex(32)).encode("utf-8")
USE_SECURE_COOKIES = os.environ.get("CUP_CRM_SECURE_COOKIES") == "1"

INDEX_FILE = DASHBOARD_DIR / "index.html"
TEMPLATE_DIR = DASHBOARD_DIR / "templates"
STATIC_DIR = DASHBOARD_DIR / "static"
DIST_DIR = REPO_ROOT / "dist"
