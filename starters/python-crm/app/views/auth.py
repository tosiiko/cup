from __future__ import annotations

from typing import Any

from ..config import APP_NAME
from ..cup_bridge import UIView
from ..data import DEMO_ACCOUNTS, LOGIN_FEATURES
from ..templates import load_template


def login_view(
    session: dict[str, Any],
    *,
    notice: str | None = None,
    error: str | None = None,
    username: str = "",
) -> UIView:
    return (
        UIView(load_template("login.html"))
        .state(
            csrf_token=session["csrf_token"],
            username=username,
            notice=notice,
            error=error,
            features=LOGIN_FEATURES,
            demo_accounts=DEMO_ACCOUNTS,
            app_name=APP_NAME,
        )
        .title(f"{APP_NAME} | Login")
        .route("/login")
    )
