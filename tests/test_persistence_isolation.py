"""Regression coverage for component-local persistence isolation."""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    "ha-trace-viewer.js",
)


class PersistenceIsolationTest(unittest.TestCase):
    def test_sections_height_is_driven_by_the_dynamic_content(self):
        source = (ROOT / "ha-trace-viewer.js").read_text(encoding="utf-8")
        self.assertIn(
            "getGridOptions() { return { columns: 12, min_columns: 6 }; }",
            source,
        )
        self.assertNotRegex(source, r"getGridOptions\(\).*\brows\s*:")

    def test_persistence_never_uses_a_window_singleton(self):
        for relative_path in SOURCES:
            with self.subTest(path=relative_path):
                source = (ROOT / relative_path).read_text(encoding="utf-8")
                self.assertNotIn("window._haToolsPersistence", source)
                self.assertNotIn("full impl in ha-tools-panel", source)
                self.assertIn("haToolsPersistence", source)


if __name__ == "__main__":
    unittest.main()
