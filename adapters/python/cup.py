"""CUP Python adapter."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Literal

ADAPTER_VERSION = "cup-python/0.3.0"
PROVENANCE_EXTENSION = "cup.provenance"
SUPPORTED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
SCRIPT_TAG_PATTERN = re.compile(r"<script\b", re.IGNORECASE)
INLINE_HANDLER_PATTERN = re.compile(r"\son[a-z][a-z0-9_-]*\s*=", re.IGNORECASE)
JAVASCRIPT_URL_PATTERN = re.compile(r"\b(?:href|src)\s*=\s*(['\"])\s*javascript:", re.IGNORECASE)
SAFE_FILTER_PATTERN = re.compile(r"\|\s*safe\b")
RELATIVE_URL_PATTERN = re.compile(r"^(\/(?!\/)|\.{1,2}\/|[?#])")


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


@dataclass(frozen=True)
class ViewPolicy:
    require_version: bool = False
    require_title: bool = False
    require_route: bool = False
    allow_safe_filter: bool = True
    allow_inline_handlers: bool = True
    allow_javascript_urls: bool = True
    allow_script_tags: bool = True
    action_urls: Literal["relative-only", "any"] = "any"


STARTER_VIEW_POLICY = ViewPolicy(
    require_version=True,
    require_title=True,
    require_route=True,
    allow_safe_filter=False,
    allow_inline_handlers=False,
    allow_javascript_urls=False,
    allow_script_tags=False,
    action_urls="relative-only",
)


class PolicyError(ValueError):
    def __init__(self, issues: list[str]) -> None:
        self.issues = issues
        super().__init__("CUP view policy rejected: " + "; ".join(issues))


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
        meta["provenance"] = {
            "source": "adapter",
            "generatedBy": ADAPTER_VERSION,
            "generatedAt": _iso_now(),
            "validation": {
                "schema": "valid",
                "policy": "skipped",
                "validator": ADAPTER_VERSION,
                "checkedAt": _iso_now(),
            },
        }
        meta["extensions"] = {
            PROVENANCE_EXTENSION: {"version": "1"},
        }
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
                "provenance": {
                    "source": "adapter",
                    "generatedBy": ADAPTER_VERSION,
                    "generatedAt": _iso_now(),
                    "validation": {
                        "schema": "valid",
                        "policy": "skipped",
                        "validator": ADAPTER_VERSION,
                        "checkedAt": _iso_now(),
                    },
                },
                "extensions": {
                    PROVENANCE_EXTENSION: {"version": "1"},
                },
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
    _annotate_schema_provenance(payload)
    return payload


def validate_view_policy(view: UIView | dict[str, Any], policy: ViewPolicy | None = None) -> dict[str, Any]:
    payload = validate_view(view)
    effective = policy or ViewPolicy()
    issues: list[str] = []
    _validate_policy_payload(payload, "view", effective, issues)
    if issues:
        raise PolicyError(issues)
    _annotate_policy_provenance(payload, "starter-view-policy" if policy is STARTER_VIEW_POLICY else "custom-view-policy")
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

    kind = value.get("type")
    if kind == "fetch":
        _validate_allowed_keys(value, {"type", "url", "method", "payload"}, path, issues)
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
        _validate_allowed_keys(value, {"type", "event", "detail"}, path, issues)
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
        _validate_allowed_keys(value, {"type", "url", "replace"}, path, issues)
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

    _validate_allowed_keys(value, {"version", "lang", "generator", "title", "route", "provenance", "extensions"}, path, issues)

    if "version" in value and value["version"] != "1":
        issues.append(f"{path}.version must be '1'")

    for key in ("lang", "generator", "title", "route"):
        if key in value and not isinstance(value[key], str):
            issues.append(f"{path}.{key} must be a string")

    provenance = value.get("provenance")
    if provenance is not None:
        _validate_provenance(provenance, f"{path}.provenance", issues)

    extensions = value.get("extensions")
    if extensions is not None:
        if not isinstance(extensions, dict):
            issues.append(f"{path}.extensions must be an object")
        else:
            for name, descriptor in extensions.items():
                _validate_extension_descriptor(descriptor, f"{path}.extensions.{name}", issues)


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


def _validate_provenance(value: Any, path: str, issues: list[str]) -> None:
    if not isinstance(value, dict):
        issues.append(f"{path} must be an object")
        return

    _validate_allowed_keys(value, {"source", "generatedBy", "generatedAt", "requestId", "validation", "policyDecisions"}, path, issues)

    if "source" in value and value["source"] not in {"human", "ai", "adapter", "hybrid"}:
        issues.append(f"{path}.source must be one of human, ai, adapter, hybrid")
    for key in ("generatedBy", "generatedAt", "requestId"):
        if key in value and not isinstance(value[key], str):
            issues.append(f"{path}.{key} must be a string")

    validation = value.get("validation")
    if validation is not None:
        _validate_validation_provenance(validation, f"{path}.validation", issues)

    policy_decisions = value.get("policyDecisions")
    if policy_decisions is not None:
        if not isinstance(policy_decisions, list):
            issues.append(f"{path}.policyDecisions must be an array")
        else:
            for index, decision in enumerate(policy_decisions):
                _validate_policy_decision(decision, f"{path}.policyDecisions[{index}]", issues)


def _validate_validation_provenance(value: Any, path: str, issues: list[str]) -> None:
    if not isinstance(value, dict):
        issues.append(f"{path} must be an object")
        return

    _validate_allowed_keys(value, {"schema", "policy", "validator", "checkedAt"}, path, issues)

    if value.get("schema") not in {"valid", "repaired", "unchecked"}:
        issues.append(f"{path}.schema must be one of valid, repaired, unchecked")
    if "policy" in value and value["policy"] not in {"passed", "failed", "skipped"}:
        issues.append(f"{path}.policy must be one of passed, failed, skipped")
    for key in ("validator", "checkedAt"):
        if key in value and not isinstance(value[key], str):
            issues.append(f"{path}.{key} must be a string")


def _validate_policy_decision(value: Any, path: str, issues: list[str]) -> None:
    if not isinstance(value, dict):
        issues.append(f"{path} must be an object")
        return

    _validate_allowed_keys(value, {"policy", "outcome", "detail"}, path, issues)

    if not isinstance(value.get("policy"), str):
        issues.append(f"{path}.policy must be a string")
    if value.get("outcome") not in {"allow", "deny", "skip"}:
        issues.append(f"{path}.outcome must be one of allow, deny, skip")
    if "detail" in value and not isinstance(value["detail"], str):
        issues.append(f"{path}.detail must be a string")


def _validate_extension_descriptor(value: Any, path: str, issues: list[str]) -> None:
    if not isinstance(value, dict):
        issues.append(f"{path} must be an object")
        return

    _validate_allowed_keys(value, {"version", "required", "config"}, path, issues)

    if not isinstance(value.get("version"), str):
        issues.append(f"{path}.version must be a string")
    if "required" in value and not isinstance(value["required"], bool):
        issues.append(f"{path}.required must be a boolean")
    config = value.get("config")
    if config is not None:
        if not isinstance(config, dict):
            issues.append(f"{path}.config must be an object")
        else:
            _validate_json_object(config, f"{path}.config", issues)


def _validate_policy_payload(value: dict[str, Any], path: str, policy: ViewPolicy, issues: list[str]) -> None:
    meta = value.get("meta") if isinstance(value.get("meta"), dict) else {}
    template = value.get("template", "")
    actions = value.get("actions") if isinstance(value.get("actions"), dict) else {}

    if policy.require_version and meta.get("version") != "1":
        issues.append(f"{path}.meta.version is required by policy")
    if policy.require_title and not meta.get("title"):
        issues.append(f"{path}.meta.title is required by policy")
    if policy.require_route and not meta.get("route"):
        issues.append(f"{path}.meta.route is required by policy")
    if not policy.allow_safe_filter and isinstance(template, str) and SAFE_FILTER_PATTERN.search(template):
        issues.append(f"{path}.template uses the |safe filter, which is disabled by policy")
    if not policy.allow_script_tags and isinstance(template, str) and SCRIPT_TAG_PATTERN.search(template):
        issues.append(f"{path}.template contains a <script> tag, which is disabled by policy")
    if not policy.allow_inline_handlers and isinstance(template, str) and INLINE_HANDLER_PATTERN.search(template):
        issues.append(f"{path}.template contains inline event handler attributes, which are disabled by policy")
    if not policy.allow_javascript_urls and isinstance(template, str) and JAVASCRIPT_URL_PATTERN.search(template):
        issues.append(f"{path}.template contains a javascript: URL, which is disabled by policy")

    if policy.action_urls == "relative-only":
        for name, descriptor in actions.items():
            _validate_policy_action(descriptor, f"{path}.actions.{name}", issues)


def _validate_policy_action(value: Any, path: str, issues: list[str]) -> None:
    if not isinstance(value, dict):
        return
    if value.get("type") not in {"fetch", "navigate"}:
        return
    url = value.get("url")
    if not isinstance(url, str) or not RELATIVE_URL_PATTERN.match(url):
        issues.append(f"{path}.url must stay relative under the current policy")


def _annotate_schema_provenance(payload: dict[str, Any]) -> None:
    meta = payload.setdefault("meta", {})
    if not isinstance(meta, dict):
        return

    provenance = meta.setdefault("provenance", {})
    if not isinstance(provenance, dict):
        return

    provenance.setdefault("source", "adapter")
    provenance.setdefault("generatedBy", meta.get("generator"))
    provenance.setdefault("generatedAt", _iso_now())
    validation = provenance.setdefault("validation", {})
    if isinstance(validation, dict):
        validation["schema"] = "valid"
        validation["policy"] = validation.get("policy", "skipped")
        validation["validator"] = validation.get("validator", meta.get("generator", ADAPTER_VERSION))
        validation["checkedAt"] = _iso_now()

    extensions = meta.setdefault("extensions", {})
    if isinstance(extensions, dict):
        extensions.setdefault(PROVENANCE_EXTENSION, {"version": "1"})


def _annotate_policy_provenance(payload: dict[str, Any], policy_name: str) -> None:
    meta = payload.get("meta")
    if not isinstance(meta, dict):
        return

    provenance = meta.setdefault("provenance", {})
    if not isinstance(provenance, dict):
        return

    validation = provenance.setdefault("validation", {})
    if isinstance(validation, dict):
        validation["policy"] = "passed"
        validation["checkedAt"] = _iso_now()

    decisions = provenance.setdefault("policyDecisions", [])
    if isinstance(decisions, list):
        decisions.append({"policy": policy_name, "outcome": "allow"})


def _iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
