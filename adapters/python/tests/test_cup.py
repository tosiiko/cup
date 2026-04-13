import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from cup import (
    FetchAction,
    PolicyError,
    STARTER_VIEW_POLICY,
    UIView,
    ValidationError,
    validate_view,
    validate_view_policy,
)


class CupPythonTests(unittest.TestCase):
    def test_validate_view_accepts_valid_payload(self) -> None:
        view = (
            UIView("<h1>{{ title }}</h1>")
            .state(title="Hello", items=["A", "B"])
            .action("reload", FetchAction("/api/reload"))
            .title("Home")
            .route("/")
        )

        validate_view(view)

    def test_validate_view_rejects_extra_fields(self) -> None:
        with self.assertRaises(ValidationError):
            validate_view({"template": "<p>Hi</p>", "state": {}, "extra": True})

    def test_validate_view_rejects_cross_type_action_fields(self) -> None:
        with self.assertRaises(ValidationError):
            validate_view({
                "template": "<button data-action='save'>Save</button>",
                "state": {},
                "actions": {
                    "save": {"type": "fetch", "url": "/save", "replace": True},
                },
            })

    def test_validate_view_policy_accepts_starter_safe_view(self) -> None:
        view = (
            UIView("<button data-action='save'>Save</button>")
            .state()
            .action("save", FetchAction("/api/save"))
            .title("Save")
            .route("/records/1")
        )

        validate_view_policy(view, STARTER_VIEW_POLICY)

    def test_validate_view_policy_rejects_safe_filter(self) -> None:
        with self.assertRaises(PolicyError):
            validate_view_policy(
                UIView("<p>{{ content|safe }}</p>").state(content="<strong>Hi</strong>").title("Unsafe").route("/unsafe"),
                STARTER_VIEW_POLICY,
            )

    def test_validate_view_policy_rejects_absolute_action_urls(self) -> None:
        with self.assertRaises(PolicyError):
            validate_view_policy(
                UIView("<button data-action='save'>Save</button>")
                .action("save", FetchAction("https://example.com/save"))
                .title("External")
                .route("/external"),
                STARTER_VIEW_POLICY,
            )

    def test_to_json_includes_meta(self) -> None:
        payload = json.loads(UIView("<p>{{ title }}</p>").state(title="Hi").to_json())
        self.assertEqual(payload["meta"]["generator"], "cup-python/0.3.0")
        self.assertEqual(payload["meta"]["extensions"]["cup.provenance"]["version"], "1")
        self.assertEqual(payload["meta"]["provenance"]["source"], "adapter")
        self.assertEqual(payload["meta"]["provenance"]["validation"]["schema"], "valid")


if __name__ == "__main__":
    unittest.main()
