#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "validation" / "finalize_critic_report.py"


class FinalizeCriticReportTest(unittest.TestCase):
    def test_finalizer_refreshes_functional_report_release_readiness(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            run_dir = Path(tmp) / "validation-run"
            run_dir.mkdir()
            critic_json = Path(tmp) / "critic.json"
            critic_json.write_text(
                json.dumps(
                    {
                        "overall_score": 8.1,
                        "cluster_scores": {
                            "entry_and_navigation": 7.4,
                            "user_flow": 7.8,
                            "operator_flow": 7.2,
                            "error_states": 7.0,
                            "visual_consistency": 7.1,
                        },
                        "findings": [],
                        "pass": True,
                    }
                ),
                encoding="utf-8",
            )
            (run_dir / "functional-report.json").write_text(
                json.dumps(
                    {
                        "run_id": "validation-run",
                        "generated_at": "2026-04-24T00:00:00+00:00",
                        "status": "passed",
                        "release_status": "functional-only",
                        "repo_checks": {"status": "passed"},
                        "browser_product_e2e": {"status": "passed"},
                        "critic": {"status": "pending_external_critic"},
                        "release_readiness": {
                            "status": "not_final",
                            "legacy_status": "functional-only",
                            "blocking_reasons": ["critic_not_finalized"],
                        },
                        "browser_e2e": {
                            "status": "passed",
                            "report_path": "/tmp/browser-report.json",
                            "skipped_reason": None,
                        },
                        "checks": [
                            {"name": "shell_typecheck", "status": "passed", "detail": ""},
                            {"name": "browser_e2e_solo", "status": "passed", "detail": ""},
                        ],
                    },
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            (run_dir / "final-validation-summary.md").write_text(
                "# Infinity Functional Validation Summary\n\n"
                "Status: `functional-only`\n"
                "Release readiness: `not_final`\n"
                "Release blocking reasons: `critic_not_finalized`\n",
                encoding="utf-8",
            )

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--run-dir",
                    str(run_dir),
                    "--critic-json",
                    str(critic_json),
                ],
                cwd=ROOT,
                check=True,
            )

            report = json.loads((run_dir / "functional-report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["critic"]["status"], "completed_external_critic")
            self.assertEqual(report["release_readiness"]["status"], "final_ready")
            self.assertEqual(report["release_readiness"]["blocking_reasons"], [])
            self.assertEqual(report["release_status"], "passed-final-release")

            summary = (run_dir / "final-validation-summary.md").read_text(encoding="utf-8")
            self.assertIn("Critic status: `completed_external_critic`", summary)
            self.assertIn("Release readiness: `final_ready`", summary)
            self.assertIn("Release blocking reasons: `none`", summary)


if __name__ == "__main__":
    unittest.main()
