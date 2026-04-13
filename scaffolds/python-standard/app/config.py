from __future__ import annotations

import os
import secrets
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
STARTER_DIR = APP_DIR.parent

HOST = os.environ.get("CUP_APP_HOST", "127.0.0.1")
PORT = int(os.environ.get("CUP_APP_PORT", "8050"))
APP_NAME = "CUP Python App"

SESSION_COOKIE = "cup_app_session"
SESSION_IDLE_SECONDS = 2 * 60 * 60
SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60

SESSION_SECRET = (os.environ.get("CUP_APP_SECRET") or secrets.token_hex(32)).encode("utf-8")
USE_SECURE_COOKIES = os.environ.get("CUP_APP_SECURE_COOKIES") == "1"

INDEX_FILE = STARTER_DIR / "index.html"
TEMPLATE_DIR = STARTER_DIR / "templates"
STATIC_DIR = STARTER_DIR / "static"
RUNTIME_FILE = STARTER_DIR / "cup" / "index.js"
