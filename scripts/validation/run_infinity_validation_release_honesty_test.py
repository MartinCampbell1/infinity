#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("run_infinity_validation.py")
SPEC = importlib.util.spec_from_file_location("run_infinity_validation", MODULE_PATH)
assert SPEC and SPEC.loader
validation = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validation
SPEC.loader.exec_module(validation)


class ReleaseHonestyTest(unittest.TestCase):
    def test_release_runner_does_not_inject_noop_validation_commands(self) -> None:
        source = MODULE_PATH.read_text(encoding="utf-8")

        self.assertNotIn("process.exit(0)", source)
        self.assertNotIn(
            'shell_env["FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON"] =',
            source,
        )

    def test_release_readiness_keeps_browser_and_critic_gates_separate(self) -> None:
        readiness = validation.build_release_readiness(
            functional_status="passed",
            checks=[
                validation.CheckResult("shell_typecheck", "passed", ""),
                validation.CheckResult("browser_e2e_solo", "passed", ""),
            ],
            browser_e2e={
                "status": "passed",
                "report_path": "/tmp/browser-report.json",
                "skipped_reason": None,
            },
            critic={
                "status": "pending_external_critic",
                "report_path": "/tmp/critic-report-iteration-0.json",
            },
        )

        self.assertEqual(readiness["repo_checks"]["status"], "passed")
        self.assertEqual(readiness["browser_product_e2e"]["status"], "passed")
        self.assertEqual(readiness["critic"]["status"], "pending_external_critic")
        self.assertEqual(readiness["release_readiness"]["status"], "not_final")
        self.assertEqual(
            readiness["release_readiness"]["blocking_reasons"],
            ["critic_not_finalized"],
        )

    def test_release_readiness_allows_final_only_after_completed_passing_critic(self) -> None:
        readiness = validation.build_release_readiness(
            functional_status="passed",
            checks=[
                validation.CheckResult("shell_typecheck", "passed", ""),
                validation.CheckResult("browser_e2e_solo", "passed", ""),
            ],
            browser_e2e={
                "status": "passed",
                "report_path": "/tmp/browser-report.json",
                "skipped_reason": None,
            },
            critic={
                "status": "completed_external_critic",
                "report_path": "/tmp/critic-report-iteration-0.json",
                "pass": True,
                "overall_score": 8.0,
                "min_core_cluster_score": 7.0,
                "unresolved_must_fix": 0,
            },
        )

        self.assertEqual(readiness["release_readiness"]["status"], "final_ready")
        self.assertEqual(readiness["release_readiness"]["blocking_reasons"], [])


if __name__ == "__main__":
    unittest.main()
