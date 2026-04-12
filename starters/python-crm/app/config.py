from __future__ import annotations

import os
import secrets
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
STARTER_DIR = APP_DIR.parent
STARTERS_DIR = STARTER_DIR.parent
REPO_ROOT = STARTERS_DIR.parent

HOST = "127.0.0.1"
PORT = 8040
APP_NAME = "CUP CRM Starter"

SESSION_COOKIE = "cup_crm_session"
SESSION_IDLE_SECONDS = 20 * 60
SESSION_ABSOLUTE_SECONDS = 10 * 60 * 60
LOGIN_WINDOW_SECONDS = 10 * 60
LOGIN_MAX_ATTEMPTS = 5
PBKDF2_ITERATIONS = 310_000
LEAD_APPROVAL_THRESHOLD = 250_000.0

SESSION_SECRET = (os.environ.get("CUP_STARTER_SECRET") or secrets.token_hex(32)).encode("utf-8")
USE_SECURE_COOKIES = os.environ.get("CUP_STARTER_SECURE_COOKIES") == "1"

INDEX_FILE = STARTER_DIR / "index.html"
TEMPLATE_DIR = STARTER_DIR / "templates"
STATIC_DIR = STARTER_DIR / "static"
DIST_DIR = Path(os.environ.get("CUP_DIST_DIR", REPO_ROOT / "dist"))
