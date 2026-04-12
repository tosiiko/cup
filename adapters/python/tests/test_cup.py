import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from cup import FetchAction, UIView, ValidationError, validate_view


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

    def test_to_json_includes_meta(self) -> None:
        payload = json.loads(UIView("<p>{{ title }}</p>").state(title="Hi").to_json())
        self.assertEqual(payload["meta"]["generator"], "cup-python/0.1.0")


if __name__ == "__main__":
    unittest.main()
