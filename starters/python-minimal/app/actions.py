from __future__ import annotations

import time
from dataclasses import dataclass

from .cup_bridge import UIView
from .routes import resolve_view_for_route


@dataclass
class ActionResult:
    status: int
    view: UIView


def update_preferences_action(session: dict[str, object], payload: dict[str, object]) -> ActionResult:
    time.sleep(0.05)
    display_name = str(payload.get("display_name", "")).strip()

    if not display_name:
        status, view = resolve_view_for_route(session, "/", error="Display name is required before you can save.")
        return ActionResult(status=status, view=view)

    if len(display_name) > 40:
        status, view = resolve_view_for_route(session, "/", error="Display name must stay under 40 characters.")
        return ActionResult(status=status, view=view)

    session["display_name"] = display_name
    session["updated_at"] = time.time()
    status, view = resolve_view_for_route(session, "/", notice="Display name saved. The server updated the session and remounted the view.")
    return ActionResult(status=status, view=view)
