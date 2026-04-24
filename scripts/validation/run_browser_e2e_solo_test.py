#!/usr/bin/env python3
from __future__ import annotations

import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("run_browser_e2e_solo.py")


class BrowserE2ESoloScriptTest(unittest.TestCase):
    def test_task_inspection_gate_tracks_scan_list_task_cards(self) -> None:
        source = SCRIPT.read_text(encoding="utf-8")
        task_gate = source.split("def assert_run_page_has_task_inspection", 1)[1].split(
            "def assert_run_page_has_attempt_inspection",
            1,
        )[0]

        self.assertIn('"Task t"', task_gate)
        self.assertNotIn('"Work unit"', task_gate)


if __name__ == "__main__":
    unittest.main()
