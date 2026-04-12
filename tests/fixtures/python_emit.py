import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "adapters" / "python"))

from cup import NavigateAction, UIView  # noqa: E402

view = (
    UIView("<div>{{ title }}</div>")
    .state(title="Hello from Python", items=["Alpha", "Beta"])
    .action("next", NavigateAction("/next"))
    .title("Fixture")
    .route("/fixture")
)

print(view.to_json())
