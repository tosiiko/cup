"""Scaffold helpers for CUP Python starter-style apps."""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ScaffoldFile:
    path: str
    content: str


@dataclass(frozen=True)
class ScaffoldBundle:
    kind: str
    name: str
    files: tuple[ScaffoldFile, ...]
    notes: tuple[str, ...]


def scaffold_page(
    name: str,
    *,
    route: str | None = None,
    title: str | None = None,
    permission: str | None = None,
) -> ScaffoldBundle:
    names = _normalize_name(name)
    page_route = route or f"/{names.kebab}"
    page_title = title or names.label
    page_permission = permission or f"{names.snake}:view"

    files = (
        ScaffoldFile(
            path=f"app/views/{names.snake}.py",
            content=_python_view_content(names.snake, page_route, page_title),
        ),
        ScaffoldFile(
            path=f"templates/pages/{names.snake}.html",
            content=_python_template_content(page_title),
        ),
        ScaffoldFile(
            path=f".cup/snippets/{names.snake}.route.py",
            content=_python_route_snippet(names.snake, page_route),
        ),
        ScaffoldFile(
            path=f".cup/snippets/{names.snake}.data.py",
            content=_python_page_data_snippet(page_title, page_route, page_permission),
        ),
    )
    notes = (
        f"Import `{names.snake}_view` into app/routes.py and paste the route snippet.",
        "Add the nav and permission snippet to app/data.py, then grant the permission to the right users.",
        f"Replace the placeholder `records` state in app/views/{names.snake}.py with real backend data.",
    )
    return ScaffoldBundle(kind="page", name=names.snake, files=files, notes=notes)


def scaffold_action(
    name: str,
    *,
    endpoint: str | None = None,
    success_route: str | None = None,
) -> ScaffoldBundle:
    names = _normalize_name(name)
    action_endpoint = endpoint or f"/api/{names.kebab}"
    next_route = success_route or "/crm/overview"

    files = (
        ScaffoldFile(
            path=f".cup/snippets/{names.snake}.action.py",
            content=_python_action_snippet(names.snake, action_endpoint, next_route),
        ),
        ScaffoldFile(
            path=f".cup/snippets/{names.snake}.server.py",
            content=_python_server_snippet(names.snake, action_endpoint),
        ),
        ScaffoldFile(
            path=f".cup/snippets/{names.snake}.browser.js",
            content=_python_browser_snippet(names.snake, action_endpoint),
        ),
        ScaffoldFile(
            path=f".cup/snippets/{names.snake}.data.py",
            content=_python_action_data_snippet(action_endpoint, next_route),
        ),
    )
    notes = (
        f"Paste the action snippet into app/actions.py and update the permission and payload validation rules for `{action_endpoint}`.",
        "Paste the server snippet into app/server.py so POST requests reach the new action handler.",
        "Add the browser and data snippets so form submissions and CSRF fallback routes stay aligned.",
    )
    return ScaffoldBundle(kind="action", name=names.snake, files=files, notes=notes)


def write_scaffold_bundle(bundle: ScaffoldBundle, root: str | Path, *, force: bool = False) -> list[Path]:
    root_path = Path(root)
    written: list[Path] = []
    for artifact in bundle.files:
        target = root_path / artifact.path
        if target.exists() and not force:
            raise FileExistsError(f"refusing to overwrite existing scaffold file: {target}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(artifact.content, encoding="utf-8")
        written.append(target)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="cup-python", description="Scaffold CUP Python starter artifacts.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scaffold_parser = subparsers.add_parser("scaffold", help="Generate starter-friendly scaffolds.")
    scaffold_subparsers = scaffold_parser.add_subparsers(dest="kind", required=True)

    page_parser = scaffold_subparsers.add_parser("page", help="Generate a route, view, template, and data snippets.")
    page_parser.add_argument("name")
    page_parser.add_argument("--route")
    page_parser.add_argument("--title")
    page_parser.add_argument("--permission")
    page_parser.add_argument("--out", default=".")
    page_parser.add_argument("--force", action="store_true")

    action_parser = scaffold_subparsers.add_parser("action", help="Generate action, server, browser, and data snippets.")
    action_parser.add_argument("name")
    action_parser.add_argument("--endpoint")
    action_parser.add_argument("--success-route")
    action_parser.add_argument("--out", default=".")
    action_parser.add_argument("--force", action="store_true")

    args = parser.parse_args(argv)
    if args.command != "scaffold":
        parser.error("unknown command")

    if args.kind == "page":
        bundle = scaffold_page(
            args.name,
            route=args.route,
            title=args.title,
            permission=args.permission,
        )
    else:
        bundle = scaffold_action(
            args.name,
            endpoint=args.endpoint,
            success_route=args.success_route,
        )

    written = write_scaffold_bundle(bundle, args.out, force=args.force)
    print(f"[cup-python] generated {bundle.kind} scaffold for {bundle.name}")
    for path in written:
        print(f"  wrote {path}")
    for note in bundle.notes:
        print(f"  note: {note}")
    return 0


@dataclass(frozen=True)
class _NameParts:
    snake: str
    kebab: str
    label: str


def _normalize_name(name: str) -> _NameParts:
    snake = re.sub(r"[^a-zA-Z0-9]+", "_", name).strip("_").lower()
    if not snake:
        raise ValueError("name must include at least one letter or number")
    kebab = snake.replace("_", "-")
    label = " ".join(part.capitalize() for part in snake.split("_"))
    return _NameParts(snake=snake, kebab=kebab, label=label)


def _python_view_content(name: str, route: str, title: str) -> str:
    return "\n".join([
        "from __future__ import annotations",
        "",
        "from typing import Any",
        "",
        "from .base import shell_view",
        "",
        "",
        f"def {name}_view(session: dict[str, Any], *, notice: str | None = None, error: str | None = None) -> Any:",
        "    return shell_view(",
        "        session,",
        f'        route="{route}",',
        f'        title="{title}",',
        f'        heading="{title}",',
        '        subheading="Replace this scaffold with the real operator workflow for the page.",',
        f'        page_name="{name}",',
        "        notice=notice,",
        "        error=error,",
        '        page_state={"records": []},',
        "    )",
        "",
    ])


def _python_template_content(title: str) -> str:
    return "\n".join([
        '<section class="table-card">',
        f"  <div class=\"section-title\">{title}</div>",
        '  <p class="table-note">Replace this scaffold with the real page content and data bindings.</p>',
        "",
        "  {% if records %}",
        '    <div class="list">',
        "      {% for record in records %}",
        '        <div class="list-item">',
        "          <div>",
        '            <div class="amount">{{ record.title }}</div>',
        '            <div class="table-note">{{ record.detail }}</div>',
        "          </div>",
        '          <span class="{{ record.status_class }}">{{ record.status }}</span>',
        "        </div>",
        "      {% endfor %}",
        "    </div>",
        "  {% else %}",
        '    <div class="list-item">',
        "      <div>",
        '        <div class="amount">No records yet</div>',
        '        <div class="table-note">Wire state into the generated view module and replace this placeholder.</div>',
        "      </div>",
        "    </div>",
        "  {% endif %}",
        "</section>",
        "",
    ])


def _python_route_snippet(name: str, route: str) -> str:
    return "\n".join([
        "# Add near the other view imports in app/routes.py",
        f"from .views.{name} import {name}_view",
        "",
        "# Add inside resolve_view_for_route()",
        f'if normalized == "{route}":',
        f"    return 200, {name}_view(session, notice=notice, error=error)",
        "",
    ])


def _python_page_data_snippet(title: str, route: str, permission: str) -> str:
    return "\n".join([
        "# Add in app/data.py",
        f'NAV_DEFINITIONS.append({{"href": "{route}", "label": "{title}", "permission": "{permission}", "badge": ""}})',
        f'ROUTE_PERMISSIONS["{route}"] = "{permission}"',
        "",
    ])


def _python_action_snippet(name: str, endpoint: str, success_route: str) -> str:
    handler_name = f"{name}_action"
    return "\n".join([
        "# Add near the other imports in app/actions.py",
        "from .routes import resolve_view_for_route",
        "",
        f"def {handler_name}(session: dict[str, Any], payload: dict[str, Any], *, remote_addr: str) -> ActionResult:",
        f'    """Handle POST {endpoint}. Replace the placeholder validation and business logic."""',
        "    # TODO validate permissions, payload shape, and mutations for this action.",
        f'    status, view = resolve_view_for_route(session, "{success_route}", remote_addr=remote_addr, notice="{name.replace("_", " ").title()} completed.")',
        "    return ActionResult(status=status, view=view)",
        "",
    ])


def _python_server_snippet(name: str, endpoint: str) -> str:
    handler_name = f"{name}_action"
    return "\n".join([
        "# Add inside CRMHandler.do_POST() in app/server.py",
        f'if self.path == "{endpoint}":',
        f"    self.apply_action_result({handler_name}(session, payload, remote_addr=remote_addr))",
        "    return",
        "",
    ])


def _python_browser_snippet(name: str, endpoint: str) -> str:
    return "\n".join([
        "// Add in static/app.js",
        f'FORM_ENDPOINTS.{name} = "{endpoint}";',
        "",
        "// Example form hook",
        f'<form data-form-kind="{name}">',
        '  <input type="hidden" name="csrf_token" value="{{ csrf_token }}" />',
        "  <button type=\"submit\">Submit</button>",
        "</form>",
        "",
    ])


def _python_action_data_snippet(endpoint: str, success_route: str) -> str:
    return "\n".join([
        "# Add in app/data.py so CSRF failures return the right page",
        f'POST_ROUTE_FALLBACKS["{endpoint}"] = "{success_route}"',
        "",
    ])


if __name__ == "__main__":
    raise SystemExit(main())
