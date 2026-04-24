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

    def test_primary_run_screenshot_waits_for_loaded_surface(self) -> None:
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def assert_primary_run_surface_ready", source)

        capture_block = source.split('"02-primary-run-created"', 1)[0].rsplit(
            "capture_phase(",
            1,
        )[0]

        self.assertIn('assert_primary_run_surface_ready(page, "primary run created")', capture_block)

    def test_stage_wait_retries_transient_http_timeouts(self) -> None:
        source = SCRIPT.read_text(encoding="utf-8")
        stage_wait = source.split("def wait_for_stage", 1)[1].split(
            "def run_id_from_url",
            1,
        )[0]

        self.assertIn("latest_error", stage_wait)
        self.assertIn("except requests.RequestException", stage_wait)
        self.assertIn("continue", stage_wait)

    def test_work_unit_stage_has_longer_timeout_than_single_api_read(self) -> None:
        source = SCRIPT.read_text(encoding="utf-8")
        work_units_stage = source.split('"04-continuity-work-units"', 1)[1].split(
            "task_graph_detail = snapshot_api",
            1,
        )[0]

        self.assertIn("timeout_seconds=240", work_units_stage)


if __name__ == "__main__":
    unittest.main()
