from __future__ import annotations

from functools import lru_cache

from .config import TEMPLATE_DIR


@lru_cache(maxsize=None)
def load_template(name: str) -> str:
    return (TEMPLATE_DIR / name).read_text(encoding="utf-8")


def render_shell(page_name: str) -> str:
    shell = load_template("shell.html")
    page = load_template(f"pages/{page_name}.html")
    return shell.replace("<!-- PAGE_CONTENT -->", page)
