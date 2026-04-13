from __future__ import annotations

import json
import re
from typing import Any

SCRIPT_TAG_PATTERN = re.compile(r"<script\b", re.IGNORECASE)
INLINE_HANDLER_PATTERN = re.compile(r"\son[a-z][a-z0-9_-]*\s*=", re.IGNORECASE)
JAVASCRIPT_URL_PATTERN = re.compile(r"\b(?:href|src)\s*=\s*(['\"])\s*javascript:", re.IGNORECASE)
RELATIVE_URL_PATTERN = re.compile(r"^(\/(?!\/)|\.{1,2}\/|[?#])")

STARTER_VIEW_POLICY: dict[str, Any] = {
    "require_version": True,
    "require_title": True,
    "require_route": True,
    "allow_script_tags": False,
    "allow_inline_handlers": False,
    "allow_javascript_urls": False,
    "action_urls": "relative-only",
}


class PolicyError(ValueError):
    pass


class UIView:
    """Small scaffold-local protocol view builder.

    This keeps generated apps self-contained. It emits plain CUP protocol dicts
    and intentionally does not vendor the published Python adapter source.
    """

    def __init__(self, template: str) -> None:
        self._template = template
        self._state: dict[str, Any] = {}
        self._actions: dict[str, dict[str, Any]] = {}
        self._meta: dict[str, Any] = {
            "version": "1",
            "lang": "python",
            "generator": "cup-init/py-standard",
        }

    def state(self, **values: Any) -> "UIView":
        self._state.update(values)
        return self

    def state_dict(self, data: dict[str, Any]) -> "UIView":
        self._state.update(data)
        return self

    def action(self, name: str, descriptor: dict[str, Any]) -> "UIView":
        if not isinstance(descriptor, dict):
            raise TypeError("action descriptors must be objects")
        self._actions[name] = descriptor
        return self

    def title(self, value: str) -> "UIView":
        self._meta["title"] = value
        return self

    def route(self, value: str) -> "UIView":
        self._meta["route"] = value
        return self

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "template": self._template,
            "state": self._state,
            "meta": self._meta,
        }
        if self._actions:
            payload["actions"] = self._actions
        return payload

    def to_response(self) -> tuple[str, str]:
        return json.dumps(self.to_dict()), "application/json; charset=utf-8"


def validate_view_policy(view: UIView | dict[str, Any], policy: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = view.to_dict() if isinstance(view, UIView) else view
    if not isinstance(payload, dict):
        raise PolicyError("protocol view must be a JSON object")

    effective = {**STARTER_VIEW_POLICY, **(policy or {})}
    template = payload.get("template")
    state = payload.get("state")
    meta = payload.get("meta")
    actions = payload.get("actions")

    if not isinstance(template, str):
        raise PolicyError("view.template must be a string")
    if not isinstance(state, dict):
        raise PolicyError("view.state must be an object")
    if not isinstance(meta, dict):
        raise PolicyError("view.meta must be an object")

    if effective["require_version"] and meta.get("version") != "1":
        raise PolicyError("view.meta.version must be '1'")
    if effective["require_title"] and not isinstance(meta.get("title"), str):
        raise PolicyError("view.meta.title is required")
    if effective["require_route"] and not isinstance(meta.get("route"), str):
        raise PolicyError("view.meta.route is required")
    if not effective["allow_script_tags"] and SCRIPT_TAG_PATTERN.search(template):
        raise PolicyError("view.template must not contain <script> tags")
    if not effective["allow_inline_handlers"] and INLINE_HANDLER_PATTERN.search(template):
        raise PolicyError("view.template must not contain inline event handlers")
    if not effective["allow_javascript_urls"] and JAVASCRIPT_URL_PATTERN.search(template):
        raise PolicyError("view.template must not contain javascript: URLs")

    if actions is not None:
        if not isinstance(actions, dict):
            raise PolicyError("view.actions must be an object when present")
        if effective["action_urls"] == "relative-only":
            for name, descriptor in actions.items():
                if not isinstance(descriptor, dict):
                    raise PolicyError(f"view.actions.{name} must be an object")
                if descriptor.get("type") in {"fetch", "navigate"}:
                    url = descriptor.get("url")
                    if not isinstance(url, str) or not RELATIVE_URL_PATTERN.match(url):
                        raise PolicyError(f"view.actions.{name}.url must stay relative")

    return payload


__all__ = ["PolicyError", "STARTER_VIEW_POLICY", "UIView", "validate_view_policy"]
