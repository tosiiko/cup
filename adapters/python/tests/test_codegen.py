import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from cup_codegen import scaffold_action, scaffold_page, write_scaffold_bundle


class CupPythonCodegenTests(unittest.TestCase):
    def test_scaffold_page_generates_expected_artifacts(self) -> None:
        bundle = scaffold_page(
            "Account Health",
            route="/crm/account-health",
            title="Account Health",
            permission="accounts:view",
        )

        paths = {artifact.path for artifact in bundle.files}
        self.assertEqual(paths, {
            "app/views/account_health.py",
            "templates/pages/account_health.html",
            ".cup/snippets/account_health.route.py",
            ".cup/snippets/account_health.data.py",
        })
        view_file = next(artifact for artifact in bundle.files if artifact.path.endswith("account_health.py"))
        self.assertIn('route="/crm/account-health"', view_file.content)
        self.assertIn('title="Account Health"', view_file.content)

    def test_scaffold_action_generates_expected_snippets(self) -> None:
        bundle = scaffold_action(
            "sync accounts",
            endpoint="/api/accounts/sync",
            success_route="/crm/companies",
        )

        paths = {artifact.path for artifact in bundle.files}
        self.assertEqual(paths, {
            ".cup/snippets/sync_accounts.action.py",
            ".cup/snippets/sync_accounts.server.py",
            ".cup/snippets/sync_accounts.browser.js",
            ".cup/snippets/sync_accounts.data.py",
        })
        action_file = next(artifact for artifact in bundle.files if artifact.path.endswith(".action.py"))
        self.assertIn('resolve_view_for_route', action_file.content)
        self.assertIn('/crm/companies', action_file.content)

    def test_write_scaffold_bundle_writes_files_and_detects_collisions(self) -> None:
        bundle = scaffold_page("Quarterly Plan")
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            written = write_scaffold_bundle(bundle, root)
            self.assertEqual(len(written), len(bundle.files))
            self.assertTrue((root / "app/views/quarterly_plan.py").exists())

            with self.assertRaises(FileExistsError):
                write_scaffold_bundle(bundle, root)


if __name__ == "__main__":
    unittest.main()
