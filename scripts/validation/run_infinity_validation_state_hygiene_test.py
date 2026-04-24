#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path
import importlib.util


ROOT = Path(__file__).resolve().parents[2]
NEXT_ENV = ROOT / "apps" / "shell" / "apps" / "web" / "next-env.d.ts"
MODULE_PATH = Path(__file__).with_name("run_infinity_validation.py")
SPEC = importlib.util.spec_from_file_location("run_infinity_validation", MODULE_PATH)
assert SPEC and SPEC.loader
validation = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validation
SPEC.loader.exec_module(validation)


class ValidationStateHygieneTest(unittest.TestCase):
    def test_next_env_matches_canonical_next_typed_routes_state(self) -> None:
        self.assertEqual(
            NEXT_ENV.read_text(encoding="utf-8"),
            "\n".join(
                [
                    '/// <reference types="next" />',
                    '/// <reference types="next/image-types/global" />',
                    'import "./.next/types/routes.d.ts";',
                    "",
                    "// NOTE: This file should not be edited",
                    "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
                    "",
                ]
            ),
        )

    def test_validation_generated_packet_directories_are_ignored(self) -> None:
        for generated_path in (
            "handoff-packets/validation/probe/functional-report.json",
            "handoff-packets/browser-e2e/probe/report.json",
            ".local-state/orchestration/probe/state.json",
        ):
            with self.subTest(generated_path=generated_path):
                result = subprocess.run(
                    ["git", "check-ignore", "-q", generated_path],
                    cwd=ROOT,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, generated_path)

    def test_tracked_state_summary_flags_validator_drift(self) -> None:
        before = " M docs/validation/README.md\n"
        unchanged = validation.summarize_tracked_state(before, before)
        changed = validation.summarize_tracked_state(
            before,
            before + "?? handoff-packets/browser-e2e/probe/report.json\n",
        )

        self.assertTrue(unchanged["unchanged"])
        self.assertEqual(unchanged["before_line_count"], 1)
        self.assertEqual(unchanged["after_line_count"], 1)
        self.assertFalse(changed["unchanged"])
        self.assertEqual(
            changed["added_lines"],
            ["?? handoff-packets/browser-e2e/probe/report.json"],
        )


if __name__ == "__main__":
    unittest.main()
