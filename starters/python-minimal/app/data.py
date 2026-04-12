from __future__ import annotations


NAV_DEFINITIONS = [
    {"href": "/", "label": "Welcome"},
    {"href": "/guide", "label": "Guide"},
]

ROUTE_FALLBACKS = {
    "/api/preferences": "/",
}

FEATURES = [
    {
        "label": "Transport stays thin",
        "detail": "The server owns routes and state. The browser only loads protocol views and posts one form.",
    },
    {
        "label": "Templates live in files",
        "detail": "You can edit the page markup without growing a giant Python string blob.",
    },
    {
        "label": "Starter-safe policy checks",
        "detail": "Responses are validated before JSON leaves the server, so unsafe drift gets caught early.",
    },
]

QUICKSTART_STEPS = [
    {
        "title": "Edit the page templates",
        "detail": "Start in templates/ if you want to change the actual interface first.",
    },
    {
        "title": "Adjust view state",
        "detail": "Use app/views.py to map backend data into a template-friendly shape.",
    },
    {
        "title": "Grow routes and actions",
        "detail": "Add new pages in app/routes.py and new mutations in app/actions.py as the app gets real.",
    },
]

GUIDE_FILES = [
    {
        "path": "app/server.py",
        "detail": "HTTP transport, static asset serving, session loading, and CSRF enforcement.",
    },
    {
        "path": "app/views.py",
        "detail": "Small view builders that shape state for the templates and set title/route metadata.",
    },
    {
        "path": "templates/",
        "detail": "File-based CUP templates for the welcome and guide pages.",
    },
    {
        "path": "static/app.js",
        "detail": "Thin browser bridge for route loads, form posts, and remounting protocol views.",
    },
]


def nav_items(current_route: str) -> list[dict[str, str | bool]]:
    normalized = current_route if current_route.startswith("/") else f"/{current_route}"
    if normalized == "/welcome":
        normalized = "/"
    return [{**item, "active": item["href"] == normalized} for item in NAV_DEFINITIONS]
