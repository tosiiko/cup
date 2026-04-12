"""CUP Python adapter."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Literal

ADAPTER_VERSION = "cup-python/0.1.0"
SUPPORTED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}


# ── Action descriptors ────────────────────────────────────────────────────────

@dataclass
class FetchAction:
    url: str
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "POST"
    payload: dict[str, Any] = field(default_factory=dict)
    type: str = field(init=False, default="fetch")

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"type": self.type, "url": self.url, "method": self.method}
        if self.payload:
            d["payload"] = self.payload
        return d


@dataclass
class EmitAction:
    event: str
    detail: dict[str, Any] = field(default_factory=dict)
    type: str = field(init=False, default="emit")

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"type": self.type, "event": self.event}
        if self.detail:
            d["detail"] = self.detail
        return d


@dataclass
class NavigateAction:
    url: str
    replace: bool = False
    type: str = field(init=False, default="navigate")

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "url": self.url, "replace": self.replace}


Action = FetchAction | EmitAction | NavigateAction


class ValidationError(ValueError):
    def __init__(self, issues: list[str]) -> None:
        self.issues = issues
        super().__init__("invalid CUP protocol view: " + "; ".join(issues))


# ── UIView builder ────────────────────────────────────────────────────────────

class UIView:
    """
    Fluent builder for the CUP UIView contract.

    All methods return `self` for chaining.
    Call `.to_dict()` or `.to_response()` at the end.
    """

    def __init__(self, template: str) -> None:
        self._template = template
        self._state: dict[str, Any] = {}
        self._actions: dict[str, Action] = {}
        self._title: str | None = None
        self._route: str | None = None

    # ── Builder methods ───────────────────────────────────────────────────────

    def state(self, **kwargs: Any) -> "UIView":
        """Merge keyword arguments into the view state."""
        self._state.update(kwargs)
        return self

    def state_dict(self, data: dict[str, Any]) -> "UIView":
        """Merge a plain dict into the view state."""
        self._state.update(data)
        return self

    def action(self, name: str, descriptor: Action) -> "UIView":
        """Register a named action."""
        self._actions[name] = descriptor
        return self

    def title(self, t: str) -> "UIView":
        self._title = t
        return self

    def route(self, r: str) -> "UIView":
        self._route = r
        return self

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict[str, Any]:
        """Return the UIView as a plain Python dict."""
        out: dict[str, Any] = {
            "template": self._template,
            "state": self._state,
        }
        if self._actions:
            out["actions"] = {k: v.to_dict() for k, v in self._actions.items()}

        meta: dict[str, Any] = {"version": "1", "lang": "python", "generator": ADAPTER_VERSION}
        if self._title:
            meta["title"] = self._title
        if self._route:
            meta["route"] = self._route
        out["meta"] = meta

        validate_view(out)
        return out

    def to_json(self, **kwargs: Any) -> str:
        """Serialise to a JSON string."""
        return json.dumps(self.to_dict(), **kwargs)

    def to_response(self) -> tuple[str, str]:
        """
        Return (json_body, content_type) ready to hand to any HTTP framework.

        Example — stdlib:
            body, ct = view.to_response()
            self.send_response(200)
            self.send_header("Content-Type", ct)
            self.end_headers()
            self.wfile.write(body.encode())

        Example — Flask:
            return Response(*view.to_response())

        Example — Django:
            body, ct = view.to_response()
            return HttpResponse(body, content_type=ct)

        Example — FastAPI / Starlette:
            body, ct = view.to_response()
            return Response(content=body, media_type=ct)
        """
        return self.to_json(), "application/json"


def validate_view(view: UIView | dict[str, Any]) -> dict[str, Any]:
    if isinstance(view, UIView):
        payload = {
            "template": view._template,
            "state": view._state,
            "actions": {k: v.to_dict() for k, v in view._actions.items()} if view._actions else None,
            "meta": {
                "version": "1",
                "lang": "python",
                "generator": ADAPTER_VERSION,
                **({"title": view._title} if view._title else {}),
                **({"route": view._route} if view._route else {}),
            },
        }
        if not payload["actions"]:
            payload.pop("actions")
    else:
        payload = view

    issues: list[str] = []
    _validate_payload(_normalise(payload), "view", issues)
    if issues:
        raise ValidationError(issues)
    return payload


def _normalise(value: Any) -> Any:
    try:
        return json.loads(json.dumps(value))
    except TypeError as exc:
        raise ValidationError([f"value is not JSON-serializable: {exc}"]) from exc


def _validate_payload(value: Any, path: str, issues: list[str]) -> None:
    if not isinstance(value, dict):
        issues.append(f"{path} must be an object")
        return

    _validate_allowed_keys(value, {"template", "state", "actions", "meta"}, path, issues)

    if not isinstance(value.get("template"), str):
        issues.append(f"{path}.template must be a string")

    state = value.get("state")
    if not isinstance(state, dict):
        issues.append(f"{path}.state must be an object")
    else:
        _validate_json_object(state, f"{path}.state", issues)

    actions = value.get("actions")
    if actions is not None:
        if not isinstance(actions, dict):
            issues.append(f"{path}.actions must be an object")
        else:
            for name, descriptor in actions.items():
                _validate_action(descriptor, f"{path}.actions.{name}", issues)

    meta = value.get("meta")
    if meta is not None:
        _validate_meta(meta, f"{path}.meta", issues)


def _validate_action(value: Any, path: str, issues: list[str]) -> None:
    if not isinstance(value, dict):
        issues.append(f"{path} must be an object")
        return

    _validate_allowed_keys(value, {"type", "url", "method", "payload", "event", "detail", "replace"}, path, issues)

    kind = value.get("type")
    if kind == "fetch":
        if not isinstance(value.get("url"), str):
            issues.append(f"{path}.url must be a string")
        method = value.get("method")
        if method is not None and method not in SUPPORTED_METHODS:
            issues.append(f"{path}.method must be a supported HTTP method")
        payload = value.get("payload")
        if payload is not None:
            if not isinstance(payload, dict):
                issues.append(f"{path}.payload must be an object")
            else:
                _validate_json_object(payload, f"{path}.payload", issues)
        return

    if kind == "emit":
        if not isinstance(value.get("event"), str):
            issues.append(f"{path}.event must be a string")
        detail = value.get("detail")
        if detail is not None:
            if not isinstance(detail, dict):
                issues.append(f"{path}.detail must be an object")
            else:
                _validate_json_object(detail, f"{path}.detail", issues)
        return

    if kind == "navigate":
        if not isinstance(value.get("url"), str):
            issues.append(f"{path}.url must be a string")
        replace = value.get("replace")
        if replace is not None and not isinstance(replace, bool):
            issues.append(f"{path}.replace must be a boolean")
        return

    issues.append(f"{path}.type must be one of fetch, emit, navigate")


def _validate_meta(value: Any, path: str, issues: list[str]) -> None:
    if not isinstance(value, dict):
        issues.append(f"{path} must be an object")
        return

    _validate_allowed_keys(value, {"version", "lang", "generator", "title", "route"}, path, issues)

    if "version" in value and value["version"] != "1":
        issues.append(f"{path}.version must be '1'")

    for key in ("lang", "generator", "title", "route"):
        if key in value and not isinstance(value[key], str):
            issues.append(f"{path}.{key} must be a string")


def _validate_json_object(value: dict[str, Any], path: str, issues: list[str]) -> None:
    for key, item in value.items():
        _validate_json_value(item, f"{path}.{key}", issues)


def _validate_json_value(value: Any, path: str, issues: list[str]) -> None:
    if value is None or isinstance(value, (str, int, float, bool)):
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _validate_json_value(item, f"{path}[{index}]", issues)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            _validate_json_value(item, f"{path}.{key}", issues)
        return
    issues.append(f"{path} must be JSON-serializable")


def _validate_allowed_keys(value: dict[str, Any], allowed: set[str], path: str, issues: list[str]) -> None:
    for key in value:
        if key not in allowed:
            issues.append(f"{path} contains unsupported property '{key}'")
